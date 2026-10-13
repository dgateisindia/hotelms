const {
  replaceInvoiceItems,
} = require("./finalizedSettlementInvoiceService");


const TERMINAL_BOOKING_STATUSES = new Set([
  "checked_out",
  "cancelled",
  "no_show",
  "expired",
]);


function throwHttp(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}


function positiveId(value, label) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throwHttp(
      400,
      `INVALID_${String(label).trim().toUpperCase().replace(/\s+/g, "_")}`,
      `${label} is invalid.`
    );
  }

  return id;
}


function roundMoney(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}


function invoiceStatus(totalAmount, netPaid) {
  const total = Math.max(0, roundMoney(totalAmount));
  const paid = roundMoney(netPaid);

  if (total <= 0 || paid >= total) {
    return "paid";
  }

  if (paid > 0) {
    return "partial";
  }

  return "unpaid";
}


function buildGroupInvoiceNumber(groupId) {
  return `INV-${Date.now()}-RG-${groupId}`;
}


function buildBookingLine(booking) {
  const total = Math.max(
    0,
    roundMoney(booking.invoice_total)
  );

  const roomLabel =
    booking.room_number
      ? `Room ${booking.room_number}`
      : `Room #${booking.room_id}`;

  const roomType =
    String(booking.room_type || "").trim();

  const bookingCode =
    booking.booking_code ||
    `Booking ${booking.booking_id}`;

  const description = [
    roomLabel,
    roomType,
    bookingCode,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    itemCode: `booking_${booking.booking_id}`,
    description,
    quantity: 1,
    unitRate: total,
    lineAmount: total,
    sourceType: "booking",
    sourceId: Number(booking.booking_id),
  };
}


/*
 * ============================================================
 * ENSURE CONSOLIDATED RESERVATION-GROUP INVOICE
 *
 * Caller owns transaction.
 *
 * This service NEVER:
 * - begins/commits/rolls back a transaction
 * - creates payments
 * - creates refunds
 * - changes booking totals
 * - deletes child booking invoices
 *
 * The group invoice is a customer-facing document over the
 * existing canonical booking financial records.
 * ============================================================
 */
async function ensureReservationGroupInvoiceWithConnection(
  connection,
  {
    hotelId,
    reservationGroupId,
  }
) {
  const hId = positiveId(hotelId, "Hotel ID");
  const gId = positiveId(
    reservationGroupId,
    "Reservation Group ID"
  );


  /* ==========================================================
     1. LOCK RESERVATION GROUP
  ========================================================== */

  const [[group]] = await connection.query(
    `
      SELECT
        reservation_group_id,
        group_code,
        customer_id

      FROM reservation_groups

      WHERE hotel_id = ?
        AND reservation_group_id = ?

      LIMIT 1
      FOR UPDATE
    `,
    [hId, gId]
  );


  if (!group) {
    throwHttp(
      404,
      "RESERVATION_GROUP_NOT_FOUND",
      "The reservation group was not found in your hotel."
    );
  }


  /* ==========================================================
     2. LOCK CHILD BOOKINGS + THEIR BOOKING INVOICES

     Group checkout already locks child bookings in booking_id
     order. We preserve the same deterministic order here.
  ========================================================== */

  const [bookings] = await connection.query(
    `
      SELECT
        b.booking_id,
        b.booking_code,
        b.room_id,
        b.booking_status,

        r.room_number,
        r.room_type,

        i.invoice_id,
        i.invoice_number,

        i.room_charges AS invoice_room_charges,
        i.food_charges AS invoice_food_charges,
        i.laundry_charges AS invoice_laundry_charges,
        i.extra_service_charges AS invoice_extra_service_charges,
        i.tax_amount AS invoice_tax_amount,

        i.total_amount AS invoice_total,
        i.customer_facing AS child_customer_facing

      FROM bookings b

      LEFT JOIN rooms r
        ON r.hotel_id = b.hotel_id
       AND r.room_id = b.room_id

      LEFT JOIN invoices i
        ON i.hotel_id = b.hotel_id
       AND i.booking_id = b.booking_id
       AND i.invoice_scope = 'booking'

      WHERE b.hotel_id = ?
        AND b.reservation_group_id = ?

      ORDER BY b.booking_id ASC

      FOR UPDATE
    `,
    [hId, gId]
  );


  if (bookings.length === 0) {
    throwHttp(
      409,
      "RESERVATION_GROUP_EMPTY",
      "This reservation group does not contain any room bookings."
    );
  }


  /*
   * Single-room reservation groups continue using their normal
   * booking invoice. Do not create a duplicate group invoice.
   */
  if (bookings.length < 2) {
    return {
      created: false,
      ready: false,
      reason: "single_booking_group",
      reservationGroupId: gId,
      groupCode: group.group_code,
      bookingCount: bookings.length,
    };
  }


  /* ==========================================================
     3. GROUP MUST BE FINANCIALLY TERMINAL

     Partial group checkout must remain valid. If one room is
     still confirmed/checked-in/pending, simply wait.
  ========================================================== */

  const nonTerminalBooking = bookings.find((booking) => {
    const status = String(
      booking.booking_status || ""
    )
      .trim()
      .toLowerCase();

    return !TERMINAL_BOOKING_STATUSES.has(status);
  });


  if (nonTerminalBooking) {
    return {
      created: false,
      ready: false,
      reason: "group_not_terminal",
      reservationGroupId: gId,
      groupCode: group.group_code,
      bookingCount: bookings.length,
      blockingBookingId: Number(
        nonTerminalBooking.booking_id
      ),
      blockingBookingCode:
        nonTerminalBooking.booking_code || null,
      blockingBookingStatus:
        nonTerminalBooking.booking_status || null,
    };
  }


  /* ==========================================================
     4. EVERY CHILD MUST HAVE ITS CANONICAL BOOKING INVOICE

     Child invoices are the financial truth used to compose the
     consolidated customer-facing document.
  ========================================================== */

  const missingInvoice = bookings.find(
    (booking) => !booking.invoice_id
  );


  if (missingInvoice) {
    return {
      created: false,
      ready: false,
      reason: "child_invoice_missing",
      reservationGroupId: gId,
      groupCode: group.group_code,
      bookingCount: bookings.length,
      blockingBookingId: Number(
        missingInvoice.booking_id
      ),
      blockingBookingCode:
        missingInvoice.booking_code || null,
    };
  }


  /* ==========================================================
     5. EXISTING GROUP INVOICE

     The unique (hotel_id, reservation_group_id) key provides
     DB-level exactly-one protection.

     If already present, make sure child invoices stay internal.
  ========================================================== */

  const [[existingInvoice]] = await connection.query(
    `
      SELECT
        invoice_id,
        invoice_number,
        total_amount,
        paid_amount,
        pending_amount,
        invoice_status,
        customer_facing

      FROM invoices

      WHERE hotel_id = ?
        AND reservation_group_id = ?
        AND invoice_scope = 'reservation_group'

      LIMIT 1
      FOR UPDATE
    `,
    [hId, gId]
  );


  if (existingInvoice) {
    await connection.query(
      `
        UPDATE invoices

        SET customer_facing = 0

        WHERE hotel_id = ?
          AND invoice_scope = 'booking'
          AND booking_id IN (
            ${bookings.map(() => "?").join(", ")}
          )
      `,
      [
        hId,
        ...bookings.map(
          (booking) => Number(booking.booking_id)
        ),
      ]
    );


    return {
      created: false,
      ready: true,
      reason: "already_exists",

      reservationGroupId: gId,
      groupCode: group.group_code,
      bookingCount: bookings.length,

      invoiceId: Number(
        existingInvoice.invoice_id
      ),

      invoiceNumber:
        existingInvoice.invoice_number,

      totalAmount: Number(
        existingInvoice.total_amount
      ),

      paidAmount: Number(
        existingInvoice.paid_amount
      ),

      pendingAmount: Number(
        existingInvoice.pending_amount
      ),

      invoiceStatus:
        existingInvoice.invoice_status,
    };
  }


  /* ==========================================================
     6. CONSOLIDATED TOTAL

     IMPORTANT:
     Sum canonical CHILD INVOICE totals, not booking.total_amount.

     This preserves checkout / cancellation / no-show settlement
     truth exactly as finalized by existing billing services.
  ========================================================== */

  const totalAmount = roundMoney(
    bookings.reduce(
      (sum, booking) =>
        sum +
        Math.max(
          0,
          Number(booking.invoice_total || 0)
        ),
      0
    )
  );


  /*
   * Group header charge buckets must remain consistent with
   * chk_invoices_total:
   *
   * total_amount =
   *   room_charges +
   *   food_charges +
   *   laundry_charges +
   *   extra_service_charges +
   *   tax_amount
   *
   * Child invoices remain the canonical financial source.
   */

  const groupRoomCharges =
    roundMoney(
      bookings.reduce(
        (sum, booking) =>
          sum +
          Math.max(
            0,
            Number(
              booking.invoice_room_charges ||
              0
            )
          ),
        0
      )
    );


  const groupFoodCharges =
    roundMoney(
      bookings.reduce(
        (sum, booking) =>
          sum +
          Math.max(
            0,
            Number(
              booking.invoice_food_charges ||
              0
            )
          ),
        0
      )
    );


  const groupLaundryCharges =
    roundMoney(
      bookings.reduce(
        (sum, booking) =>
          sum +
          Math.max(
            0,
            Number(
              booking.invoice_laundry_charges ||
              0
            )
          ),
        0
      )
    );


  const groupExtraServiceCharges =
    roundMoney(
      bookings.reduce(
        (sum, booking) =>
          sum +
          Math.max(
            0,
            Number(
              booking.invoice_extra_service_charges ||
              0
            )
          ),
        0
      )
    );


  const groupTaxAmount =
    roundMoney(
      bookings.reduce(
        (sum, booking) =>
          sum +
          Math.max(
            0,
            Number(
              booking.invoice_tax_amount ||
              0
            )
          ),
        0
      )
    );


  const groupComponentTotal =
    roundMoney(
      groupRoomCharges +
      groupFoodCharges +
      groupLaundryCharges +
      groupExtraServiceCharges +
      groupTaxAmount
    );


  if (
    Math.abs(
      groupComponentTotal -
      totalAmount
    ) > 0.009
  ) {
    throwHttp(
      500,
      "GROUP_INVOICE_COMPONENT_TOTAL_MISMATCH",
      "The consolidated invoice component total does not match the child invoice total."
    );
  }


  /* ==========================================================
     7. EXISTING PAYMENT / REFUND LEDGER TRUTH

     No new payment is created for the consolidated invoice.
  ========================================================== */

  const [[paymentSummary]] = await connection.query(
    `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN p.transaction_type = 'payment'
                THEN p.amount

              WHEN p.transaction_type = 'refund'
                THEN -p.amount

              ELSE 0
            END
          ),
          0
        ) AS net_paid

      FROM payments p

      INNER JOIN bookings b
        ON b.hotel_id = p.hotel_id
       AND b.booking_id = p.booking_id

      WHERE p.hotel_id = ?
        AND b.reservation_group_id = ?
        AND p.payment_status = 'success'
    `,
    [hId, gId]
  );


  const netPaid = roundMoney(
    paymentSummary?.net_paid || 0
  );

  const paidAmount = roundMoney(
    Math.min(
      Math.max(0, netPaid),
      totalAmount
    )
  );

  const pendingAmount = roundMoney(
    Math.max(
      0,
      totalAmount - paidAmount
    )
  );

  const status = invoiceStatus(
    totalAmount,
    netPaid
  );


  /* ==========================================================
     8. CREATE EXACTLY ONE GROUP INVOICE

     The detailed component/tax breakdown remains preserved in
     internal child invoices.

     Group invoice items already contain each child's FINAL total,
     therefore tax/components are intentionally not added again
     at group header level.
  ========================================================== */

  const invoiceNumber =
    buildGroupInvoiceNumber(gId);


  const [insertResult] = await connection.query(
    `
      INSERT INTO invoices (
        hotel_id,
        booking_id,
        reservation_group_id,
        invoice_scope,
        customer_facing,
        invoice_number,

        room_charges,
        food_charges,
        laundry_charges,
        extra_service_charges,
        tax_amount,

        total_amount,
        paid_amount,
        pending_amount,
        invoice_status
      )

      VALUES (
        ?,
        NULL,
        ?,
        'reservation_group',
        1,
        ?,

        ?,
        ?,
        ?,
        ?,
        ?,

        ?,
        ?,
        ?,
        ?
      )
    `,
    [
      hId,
      gId,
      invoiceNumber,

      groupRoomCharges,
      groupFoodCharges,
      groupLaundryCharges,
      groupExtraServiceCharges,
      groupTaxAmount,

      totalAmount,
      paidAmount,
      pendingAmount,
      status,
    ]
  );


  const invoiceId =
    Number(insertResult.insertId);


  if (!invoiceId) {
    throwHttp(
      500,
      "GROUP_INVOICE_CREATE_FAILED",
      "The consolidated reservation invoice could not be created."
    );
  }


  /* ==========================================================
     9. ONE CUSTOMER-FACING LINE PER CHILD BOOKING

     invoice_items already provides the canonical generic
     source_type/source_id relation, so no duplicate link table.
  ========================================================== */

  const items =
    bookings.map(
      buildBookingLine
    );


  await replaceInvoiceItems(
    connection,
    {
      hotelId: hId,
      invoiceId,
      items,
    }
  );


  const itemTotal = roundMoney(
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.lineAmount || 0),
      0
    )
  );


  if (
    Math.abs(
      itemTotal - totalAmount
    ) > 0.009
  ) {
    throwHttp(
      500,
      "GROUP_INVOICE_ITEM_TOTAL_MISMATCH",
      "The consolidated invoice item total does not match the invoice total."
    );
  }


  /* ==========================================================
     10. CHILD BOOKING INVOICES BECOME INTERNAL

     They remain immutable financial history.
     They are NOT deleted.
     They simply stop being customer-facing.
  ========================================================== */

  const [internalizeResult] =
    await connection.query(
      `
        UPDATE invoices

        SET customer_facing = 0

        WHERE hotel_id = ?
          AND invoice_scope = 'booking'
          AND booking_id IN (
            ${bookings.map(() => "?").join(", ")}
          )
      `,
      [
        hId,
        ...bookings.map(
          (booking) => Number(booking.booking_id)
        ),
      ]
    );


  return {
    created: true,
    ready: true,

    reservationGroupId: gId,
    groupCode: group.group_code,
    customerId: Number(group.customer_id),

    bookingCount: bookings.length,

    bookingIds: bookings.map(
      (booking) => Number(booking.booking_id)
    ),

    childInvoiceIds: bookings.map(
      (booking) => Number(booking.invoice_id)
    ),

    internalizedChildInvoiceCount:
      Number(
        internalizeResult.affectedRows || 0
      ),

    invoiceId,
    invoiceNumber,

    totalAmount,
    netPaid,
    paidAmount,
    pendingAmount,
    invoiceStatus: status,

    items,
  };
}


module.exports = {
  ensureReservationGroupInvoiceWithConnection,
};