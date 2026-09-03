const {
  getLockedPaymentState,
  syncBookingPaymentStatus,
} = require("./bookingPaymentService");

const {
  ensureCancellationSettlementWithConnection,
} = require("./cancellationSettlementService");


const VALID_SOURCES =
  new Set([
    "customer",
    "hotel",
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


function positiveId(
  value,
  label
) {
  const id =
    Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throwHttp(
      400,
      `INVALID_${String(label)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")}`,
      `${label} is invalid.`
    );
  }

  return id;
}


function normalizeSource(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeReason(
  value
) {
  return String(value || "")
    .trim();
}


function parseSnapshot(
  value
) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(value);

    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}


/* ============================================================
   CANCEL BOOKING

   Pre-arrival lifecycle only:
   pending / confirmed → cancelled

   Controller owns transaction.

   Rules:
   - explicit customer / hotel source
   - booking-time policy decides reason requirement
   - expected guests → cancelled
   - checked-in guest state blocks cancellation
   - room-history planned assignment → cancelled
   - original booking total is preserved
   - cancellation settlement decides final payable
   - finalized settlement synchronizes payment status
   - manual-review settlement still allows cancellation but
     financial collection/refund remains blocked until review
============================================================ */

async function cancelBooking(
  connection,
  {
    hotelId,
    adminId,
    bookingId,
    cancellationSource,
    cancellationReason,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const aId =
    positiveId(
      adminId,
      "Admin ID"
    );

  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );

  const source =
    normalizeSource(
      cancellationSource
    );

  const reason =
    normalizeReason(
      cancellationReason
    );


  if (
    !VALID_SOURCES.has(
      source
    )
  ) {
    throwHttp(
      400,
      "INVALID_CANCELLATION_SOURCE",
      "Select whether this cancellation was requested by the customer or initiated by the hotel."
    );
  }


  if (
    reason.length > 500
  ) {
    throwHttp(
      400,
      "CANCELLATION_REASON_TOO_LONG",
      "Cancellation reason cannot exceed 500 characters."
    );
  }


  /* ==========================================================
     LOCK BOOKING
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          room_id,
          total_amount,
          payment_status

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found in your hotel."
    );
  }


  if (
    booking.booking_status ===
    "cancelled"
  ) {
    throwHttp(
      409,
      "BOOKING_ALREADY_CANCELLED",
      "This booking is already cancelled."
    );
  }


  if (
    ![
      "pending",
      "confirmed",
    ].includes(
      booking.booking_status
    )
  ) {
    const message =
      booking.booking_status ===
      "checked_in"
        ? "A checked-in stay cannot be cancelled. Use the checkout or early-checkout workflow."
        : booking.booking_status ===
          "checked_out"
          ? "A checked-out booking cannot be cancelled."
          : "This booking is no longer eligible for cancellation.";

    throwHttp(
      409,
      "BOOKING_CANCELLATION_NOT_ALLOWED",
      message
    );
  }


  /* ==========================================================
     BOOKING-TIME POLICY

     Missing/invalid old snapshot:
     reason defaults to required for safer audit.
  ========================================================== */

  const [[snapshotRow]] =
    await connection.query(
      `
        SELECT
          snapshot_id,
          policy_snapshot

        FROM booking_policy_snapshots

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  const snapshot =
    parseSnapshot(
      snapshotRow
        ?.policy_snapshot
    );


  const requireReason =
    snapshot
      ?.cancellation
      ?.require_reason !==
    false;


  if (
    requireReason &&
    !reason
  ) {
    throwHttp(
      400,
      "CANCELLATION_REASON_REQUIRED",
      "Enter a cancellation reason."
    );
  }


  /* ==========================================================
     LOCK GUEST ALLOCATIONS

     A pending/confirmed reservation must never contain an
     actively checked-in guest.
  ========================================================== */

  const [guests] =
    await connection.query(
      `
        SELECT
          booking_guest_id,
          guest_status

        FROM booking_guests

        WHERE hotel_id = ?
          AND booking_id = ?

        ORDER BY
          booking_guest_id ASC

        FOR UPDATE
      `,
      [
        hId,
        bId,
      ]
    );


  if (
    guests.some(
      (guest) =>
        guest.guest_status ===
        "checked_in"
    )
  ) {
    throwHttp(
      409,
      "CANCELLATION_GUEST_STATE_INVALID",
      "A checked-in guest exists on this reservation. Use the operational checkout workflow instead."
    );
  }


  /* ==========================================================
     CANCEL BOOKING
  ========================================================== */

  await connection.query(
    `
      UPDATE bookings

      SET
        booking_status =
          'cancelled',

        total_guests = 0,

        cancellation_source = ?,
        cancellation_reason = ?,
        cancelled_at = NOW(),
        cancelled_by_admin_id = ?,

        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
        AND booking_status IN (
          'pending',
          'confirmed'
        )
    `,
    [
      source,
      reason || null,
      aId,
      aId,
      hId,
      bId,
    ]
  );


  /* ==========================================================
     EXPECTED GUESTS NEVER ARRIVED

     Do not invent actual checkout timestamps.
  ========================================================== */

  await connection.query(
    `
      UPDATE booking_guests

      SET
        guest_status =
          'cancelled',

        actual_check_out =
          NULL,

        checked_out_by_admin_id =
          NULL

      WHERE hotel_id = ?
        AND booking_id = ?
        AND guest_status =
          'expected'
    `,
    [
      hId,
      bId,
    ]
  );


  /* ==========================================================
     RELEASE FUTURE ROOM ASSIGNMENT

     Physical room state is not changed here.
  ========================================================== */

  await connection.query(
    `
      UPDATE booking_room_history

      SET
        assignment_status =
          'cancelled',

        changed_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
        AND assignment_status IN (
          'planned',
          'active'
        )
    `,
    [
      aId,
      hId,
      bId,
    ]
  );


  /* ==========================================================
     FINANCIAL SETTLEMENT
  ========================================================== */

  const settlementResult =
    await ensureCancellationSettlementWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,
      }
    );


  const settlement =
    settlementResult
      .settlement;


  const finalized =
    settlement
      ?.settlement_status ===
      "finalized" &&
    settlement
      ?.final_payable_amount !==
      null &&
    settlement
      ?.final_payable_amount !==
      undefined;


  let paymentState;


  if (finalized) {
    /*
     * syncBookingPaymentStatus now resolves cancellation
     * final payable from the settlement.
     */
    paymentState =
      await syncBookingPaymentStatus(
        connection,
        hId,
        bId
      );
  } else {
    /*
     * Financial target is unknown during manual review.
     * Read ledger totals only; do not invent payable/outstanding.
     */
    paymentState =
      await getLockedPaymentState(
        connection,
        hId,
        bId,
        Number(
          booking.total_amount
        )
      );
  }


  const finalPayable =
    finalized
      ? Number(
          settlement
            .final_payable_amount
        )
      : null;


  const netPaid =
    Number(
      paymentState
        ?.netPaid ||
        0
    );


  const overpaidAmount =
    finalized
      ? Number(
          Math.max(
            0,
            netPaid -
              finalPayable
          ).toFixed(2)
        )
      : null;


  const outstandingAmount =
    finalized
      ? Number(
          Math.max(
            0,
            finalPayable -
              Math.max(
                0,
                netPaid
              )
          ).toFixed(2)
        )
      : null;


  /* ==========================================================
     LOAD CANONICAL CANCELLATION TIMESTAMP
  ========================================================== */

  const [[cancelledBooking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          payment_status,

          cancellation_source,
          cancellation_reason,
          cancelled_at,
          cancelled_by_admin_id

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1
      `,
      [
        hId,
        bId,
      ]
    );


  return {
    bookingId:
      Number(
        cancelledBooking
          .booking_id
      ),

    bookingCode:
      cancelledBooking
        .booking_code,

    bookingStatus:
      cancelledBooking
        .booking_status,

    cancellationSource:
      cancelledBooking
        .cancellation_source,

    cancellationReason:
      cancelledBooking
        .cancellation_reason,

    cancelledAt:
      cancelledBooking
        .cancelled_at,

    cancelledByAdminId:
      Number(
        cancelledBooking
          .cancelled_by_admin_id
      ),

    originalTotalAmount:
      Number(
        booking.total_amount
      ),

    settlementId:
      settlement
        ?.settlement_id
        ? Number(
            settlement
              .settlement_id
          )
        : null,

    settlementStatus:
      settlement
        ?.settlement_status ||
      null,

    finalPayableAmount:
      finalPayable,

    financialReviewRequired:
      !finalized,

    grossPaid:
      Number(
        paymentState
          ?.grossPaid ||
        0
      ),

    refundedAmount:
      Number(
        paymentState
          ?.refunded ||
        0
      ),

    netPaid,

    outstandingAmount,

    overpaidAmount,

    refundReviewRequired:
      finalized &&
      overpaidAmount >
        0.009,

    paymentStatus:
      finalized
        ? paymentState
            ?.paymentStatus ||
          cancelledBooking
            .payment_status
        : cancelledBooking
            .payment_status,
  };
}


module.exports = {
  cancelBooking,
};