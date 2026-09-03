const {
  syncBookingPaymentStatus,
  collectBookingPayment,
} = require(
  "../bookingPaymentService"
);

const {
  reconcileOverdueBookingsWithConnection,
} = require(
  "../bookingStatusService"
);


const ELIGIBLE_STATUSES =
  new Set([
    "confirmed",
    "checked_in",
    "no_show",
  ]);


const PAYMENT_METHODS =
  new Set([
    "cash",
    "card",
    "upi",
    "bank_transfer",
  ]);


function throwHttp(
  status,
  code,
  message
) {
  const error =
    new Error(message);

  error.status =
    status;

  error.code =
    code;

  throw error;
}


function roundMoney(
  value
) {
  return Number(
    Number(
      value || 0
    ).toFixed(2)
  );
}


function normalizeBookingIds(
  bookingIds
) {
  if (
    !Array.isArray(
      bookingIds
    ) ||
    bookingIds.length === 0
  ) {
    return null;
  }


  const normalized =
    [
      ...new Set(
        bookingIds.map(
          Number
        )
      ),
    ];


  if (
    normalized.some(
      (bookingId) =>
        !Number.isSafeInteger(
          bookingId
        ) ||
        bookingId <= 0
    )
  ) {
    throwHttp(
      400,
      "INVALID_GROUP_PAYMENT_BOOKINGS",
      "One or more selected room bookings are invalid."
    );
  }


  return normalized.sort(
    (a, b) =>
      a - b
  );
}


function normalizePaymentMethod(
  method
) {
  const normalized =
    String(
      method || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  if (
    !PAYMENT_METHODS.has(
      normalized
    )
  ) {
    throwHttp(
      400,
      "INVALID_GROUP_PAYMENT_METHOD",
      "Select a valid payment method."
    );
  }


  return normalized;
}


async function collectReservationGroupPayment(
  connection,
  {
    hotelId,
    adminId,
    reservationGroupId,

    amount,
    method,
    transactionId,
    notes,

    bookingIds = null,
  }
) {
  const groupId =
    Number(
      reservationGroupId
    );


  if (
    !Number.isSafeInteger(
      groupId
    ) ||
    groupId <= 0
  ) {
    throwHttp(
      400,
      "INVALID_RESERVATION_GROUP",
      "The reservation group is invalid."
    );
  }


  const paymentAmount =
    roundMoney(
      amount
    );


  if (
    !Number.isFinite(
      paymentAmount
    ) ||
    paymentAmount <= 0
  ) {
    throwHttp(
      400,
      "INVALID_GROUP_PAYMENT_AMOUNT",
      "Enter a valid payment amount greater than zero."
    );
  }


  if (
    paymentAmount >
    9999999999.99
  ) {
    throwHttp(
      400,
      "GROUP_PAYMENT_AMOUNT_TOO_LARGE",
      "The payment amount is too large."
    );
  }


  const normalizedMethod =
    normalizePaymentMethod(
      method
    );


  const normalizedTransactionId =
    String(
      transactionId || ""
    ).trim();


  if (
    normalizedMethod !==
      "cash" &&
    !normalizedTransactionId
  ) {
    throwHttp(
      400,
      "GROUP_PAYMENT_TRANSACTION_ID_REQUIRED",
      "Transaction ID is required for non-cash group payments."
    );
  }


  if (
    normalizedTransactionId.length >
    255
  ) {
    throwHttp(
      400,
      "GROUP_PAYMENT_TRANSACTION_ID_TOO_LONG",
      "Transaction ID is too long."
    );
  }


  const normalizedNotes =
    String(
      notes || ""
    ).trim();


  if (
    normalizedNotes.length >
    500
  ) {
    throwHttp(
      400,
      "GROUP_PAYMENT_NOTES_TOO_LONG",
      "Payment notes cannot exceed 500 characters."
    );
  }


  const selectedBookingIds =
    normalizeBookingIds(
      bookingIds
    );


  /* ============================================================
     LOCK RESERVATION GROUP

     Lock order:
     reservation_group
       -> child bookings
       -> financial settlement/payment ledger
  ============================================================ */

  const [[group]] =
    await connection.query(
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
      [
        hotelId,
        groupId,
      ]
    );


  if (!group) {
    throwHttp(
      404,
      "RESERVATION_GROUP_NOT_FOUND",
      "The reservation group was not found in your hotel."
    );
  }


  /* ============================================================
    RECONCILE CURRENT GROUP LIFECYCLE

    Reservation group is already locked.

    Refresh overdue child bookings before resolving which
    bookings may receive payment.

    Example:
    confirmed -> no_show

    This also ensures No Show payment uses its financial
    settlement rather than the stale original booking state.

    Lock order remains:
    reservation_group
      -> booking rows
      -> settlement/payment ledger
  ============================================================ */

  await reconcileOverdueBookingsWithConnection(
    connection,
    {
      hotelId,
      reservationGroupId:
        groupId,
    }
  );


  /* ============================================================
    LOCK ALL CHILD BOOKINGS

     Lock every child in deterministic booking_id order.
     This prevents payment allocation racing another group action.
  ============================================================ */

  const [groupBookings] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          total_amount

        FROM bookings

        WHERE hotel_id = ?
          AND reservation_group_id = ?

        ORDER BY booking_id ASC

        FOR UPDATE
      `,
      [
        hotelId,
        groupId,
      ]
    );


  if (
    groupBookings.length ===
    0
  ) {
    throwHttp(
      409,
      "RESERVATION_GROUP_EMPTY",
      "This reservation group does not contain any booking records."
    );
  }


  const bookingsById =
    new Map(
      groupBookings.map(
        (booking) => [
          Number(
            booking.booking_id
          ),
          booking,
        ]
      )
    );


  /* ============================================================
     EXPLICIT ROOM SELECTION
  ============================================================ */

  if (
    selectedBookingIds
  ) {
    const invalidSelection =
      selectedBookingIds.find(
        (bookingId) =>
          !bookingsById.has(
            bookingId
          )
      );


    if (
      invalidSelection
    ) {
      throwHttp(
        400,
        "GROUP_PAYMENT_BOOKING_NOT_IN_GROUP",
        "One or more selected bookings do not belong to this reservation group."
      );
    }
  }


  const candidateBookings =
    selectedBookingIds
      ? selectedBookingIds.map(
          (bookingId) =>
            bookingsById.get(
              bookingId
            )
        )
      : groupBookings;


  /*
   * Explicit selection:
   * never silently accept an ineligible room.
   *
   * Whole-group payment:
   * historical/inactive rooms are ignored.
   */
  if (
    selectedBookingIds
  ) {
    const invalidStatusBooking =
      candidateBookings.find(
        (booking) =>
          !ELIGIBLE_STATUSES.has(
            String(
              booking.booking_status ||
              ""
            )
              .trim()
              .toLowerCase()
          )
      );


    if (
      invalidStatusBooking
    ) {
      throwHttp(
        409,
        "GROUP_PAYMENT_BOOKING_NOT_ELIGIBLE",
        `${invalidStatusBooking.booking_code} does not currently allow payment collection.`
      );
    }
  }


  const eligibleBookings =
    candidateBookings.filter(
      (booking) =>
        ELIGIBLE_STATUSES.has(
          String(
            booking.booking_status ||
            ""
          )
            .trim()
            .toLowerCase()
        )
    );


  if (
    eligibleBookings.length ===
    0
  ) {
    throwHttp(
      409,
      "GROUP_PAYMENT_NOT_ALLOWED",
      "No booking in this reservation selection currently allows payment collection."
    );
  }


  /* ============================================================
     RESOLVE REAL OUTSTANDING

     Reuse existing booking payment authority.

     Important:
     No Show uses finalized settlement payable amount rather than
     blindly using bookings.total_amount.
  ============================================================ */

  const payableBookings =
    [];


  for (
    const booking of
    eligibleBookings
  ) {
    const state =
      await syncBookingPaymentStatus(
        connection,
        hotelId,
        Number(
          booking.booking_id
        )
      );


    const outstandingAmount =
      roundMoney(
        Math.max(
          0,
          Number(
            state.outstandingAmount ||
            0
          )
        )
      );


    if (
      outstandingAmount <=
      0.009
    ) {
      continue;
    }


    payableBookings.push({
      bookingId:
        Number(
          booking.booking_id
        ),

      bookingCode:
        booking.booking_code,

      bookingStatus:
        booking.booking_status,

      outstandingAmount,
    });
  }


  const groupOutstanding =
    roundMoney(
      payableBookings.reduce(
        (
          total,
          booking
        ) =>
          total +
          booking.outstandingAmount,
        0
      )
    );


  if (
    groupOutstanding <=
    0.009
  ) {
    throwHttp(
      409,
      "GROUP_PAYMENT_NOT_REQUIRED",
      "The selected reservation bookings have no outstanding payment."
    );
  }


  if (
    paymentAmount >
    groupOutstanding +
      0.009
  ) {
    throwHttp(
      409,
      "GROUP_PAYMENT_EXCEEDS_OUTSTANDING",
      `Only ₹${groupOutstanding.toFixed(2)} is outstanding for the selected reservation bookings.`
    );
  }


  /* ============================================================
     PREVENT EXTERNAL TRANSACTION REUSE

     Existing normal booking payments store transaction_id in
     payments, while Group Payment stores it on the group receipt.
  ============================================================ */

  if (
    normalizedMethod !==
    "cash"
  ) {
    const [[existingBookingPayment]] =
      await connection.query(
        `
          SELECT
            payment_id

          FROM payments

          WHERE hotel_id = ?
            AND transaction_id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          hotelId,
          normalizedTransactionId,
        ]
      );


    if (
      existingBookingPayment
    ) {
      throwHttp(
        409,
        "GROUP_PAYMENT_TRANSACTION_ALREADY_USED",
        "This transaction ID has already been used for another payment."
      );
    }
  }


  /* ============================================================
     CREATE ONE GROUP RECEIPT
  ============================================================ */

  let groupPaymentResult;


  try {
    [
      groupPaymentResult,
    ] =
      await connection.query(
        `
          INSERT INTO reservation_group_payments (
            hotel_id,
            reservation_group_id,

            amount,
            payment_method,
            transaction_id,

            notes,
            created_by_admin_id,
            payment_status
          )

          VALUES (
            ?,
            ?,

            ?,
            ?,
            ?,

            ?,
            ?,
            'success'
          )
        `,
        [
          hotelId,
          groupId,

          paymentAmount,
          normalizedMethod,

          normalizedMethod ===
            "cash"
            ? null
            : normalizedTransactionId,

          normalizedNotes ||
            null,

          adminId,
        ]
      );
  } catch (
    insertError
  ) {
    if (
      insertError?.code ===
        "ER_DUP_ENTRY" &&
      normalizedMethod !==
        "cash"
    ) {
      throwHttp(
        409,
        "GROUP_PAYMENT_TRANSACTION_ALREADY_USED",
        "This transaction ID has already been used for another group payment."
      );
    }

    throw insertError;
  }


  const groupPaymentId =
    Number(
      groupPaymentResult
        .insertId
    );


  /* ============================================================
     DETERMINISTIC ALLOCATION

     booking_id ASC.

     Example:
     BK-1014 due ₹2000
     BK-1015 due ₹2500
     received ₹3000

     Allocation:
     BK-1014 ₹2000
     BK-1015 ₹1000
  ============================================================ */

  let remaining =
    paymentAmount;


  const allocations =
    [];


  for (
    let index = 0;
    index <
      payableBookings.length &&
    remaining > 0.009;
    index += 1
  ) {
    const booking =
      payableBookings[index];


    const allocationAmount =
      roundMoney(
        Math.min(
          remaining,
          booking.outstandingAmount
        )
      );


    if (
      allocationAmount <=
      0.009
    ) {
      continue;
    }


    const allocationNote =
      [
        `Reservation group payment #${groupPaymentId}.`,

        `Allocation ${allocations.length + 1}.`,

        normalizedNotes ||
          null,
      ]
        .filter(
          Boolean
        )
        .join(" ")
        .slice(
          0,
          500
        );


    const paymentResult =
      await collectBookingPayment(
        connection,
        {
          hotelId,
          adminId,

          bookingId:
            booking.bookingId,

          amount:
            allocationAmount,

          method:
            normalizedMethod,

          /*
           * External transaction reference belongs to
           * reservation_group_payments.
           *
           * Child ledger rows are linked by group_payment_id.
           */
          transactionId:
            null,

          notes:
            allocationNote,

          groupPaymentId,
        }
      );


    allocations.push({
      bookingId:
        booking.bookingId,

      bookingCode:
        booking.bookingCode,

      paymentId:
        paymentResult.paymentId,

      allocatedAmount:
        allocationAmount,

      outstandingBefore:
        booking.outstandingAmount,

      outstandingAfter:
        roundMoney(
          paymentResult
            .outstandingAmount
        ),

      paymentStatus:
        paymentResult
          .paymentStatus,
    });


    remaining =
      roundMoney(
        remaining -
        allocationAmount
      );
  }


  if (
    remaining >
    0.009
  ) {
    throwHttp(
      500,
      "GROUP_PAYMENT_ALLOCATION_FAILED",
      "The complete group payment could not be allocated to the selected bookings."
    );
  }


  const outstandingAfter =
    roundMoney(
      Math.max(
        0,
        groupOutstanding -
          paymentAmount
      )
    );


  return {
    groupPaymentId,

    reservationGroupId:
      Number(
        group
          .reservation_group_id
      ),

    groupCode:
      group.group_code,

    amountReceived:
      paymentAmount,

    paymentMethod:
      normalizedMethod,

    transactionId:
      normalizedMethod ===
        "cash"
        ? null
        : normalizedTransactionId,

    selectedBookingIds:
      selectedBookingIds ||
      null,

    outstandingBefore:
      groupOutstanding,

    outstandingAfter,

    allocations,
  };
}


module.exports = {
  collectReservationGroupPayment,
};