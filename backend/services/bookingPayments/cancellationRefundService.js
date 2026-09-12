const {
  getLockedPaymentState,
} = require("../bookingPaymentService");


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


function positiveInteger(
  value
) {
  const number =
    Number(value);

  return (
    Number.isSafeInteger(number) &&
    number > 0
  )
    ? number
    : null;
}


function normalizeRefundMethod(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}


/* ============================================================
   REFUND CANCELLATION OVERPAYMENT

   Example:

   Original booking = ₹4,000
   Cancellation payable = ₹1,000
   Net paid = ₹2,500

   Exact backend refund = ₹1,500

   Client never controls refund amount.

   Permanent lock order:
   booking
     -> cancellation settlement
     -> payment ledger
============================================================ */

async function refundCancellationOverpayment(
  connection,
  {
    hotelId,
    adminId,
    bookingId,

    method,
    transactionId,
    notes,
  }
) {
  const safeHotelId =
    positiveInteger(
      hotelId
    );

  const safeAdminId =
    positiveInteger(
      adminId
    );

  const safeBookingId =
    positiveInteger(
      bookingId
    );


  if (
    !safeHotelId ||
    !safeAdminId ||
    !safeBookingId
  ) {
    throwHttp(
      500,
      "INVALID_CANCELLATION_REFUND_CONTEXT",
      "A valid hotel, admin and booking are required for the refund."
    );
  }


  /* ==========================================================
     REFUND INPUT
  ========================================================== */

  const refundMethod =
    normalizeRefundMethod(
      method
    );


  const allowedMethods =
    new Set([
      "cash",
      "card",
      "upi",
      "bank_transfer",
    ]);


  if (
    !allowedMethods.has(
      refundMethod
    )
  ) {
    throwHttp(
      400,
      "INVALID_REFUND_METHOD",
      "Select a valid refund method."
    );
  }


  const normalizedTransactionId =
    String(
      transactionId || ""
    ).trim();


  if (
    refundMethod !==
      "cash" &&
    !normalizedTransactionId
  ) {
    throwHttp(
      400,
      "REFUND_TRANSACTION_ID_REQUIRED",
      "Transaction ID is required for non-cash refunds."
    );
  }


  if (
    normalizedTransactionId.length >
    255
  ) {
    throwHttp(
      400,
      "REFUND_TRANSACTION_ID_TOO_LONG",
      "Refund transaction ID is too long."
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
      "REFUND_NOTES_TOO_LONG",
      "Refund notes cannot exceed 500 characters."
    );
  }


  /* ==========================================================
     LOCK BOOKING FIRST
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          total_amount,

          cancellation_source,
          cancellation_reason,
          cancelled_at

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        safeHotelId,
        safeBookingId,
      ]
    );


  if (!booking) {
    throwHttp(
      404,
      "BOOKING_NOT_FOUND",
      "The booking was not found."
    );
  }


  if (
    booking.booking_status !==
    "cancelled"
  ) {
    throwHttp(
      409,
      "CANCELLATION_REFUND_NOT_ALLOWED",
      "A cancellation refund can only be processed for a cancelled reservation."
    );
  }


  /* ==========================================================
     LOCK FINALIZED CANCELLATION SETTLEMENT
  ========================================================== */

  const [[settlement]] =
    await connection.query(
      `
        SELECT
          settlement_id,
          settlement_status,

          original_total_amount,
          final_payable_amount

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type =
            'cancellation'

        LIMIT 1

        FOR UPDATE
      `,
      [
        safeHotelId,
        safeBookingId,
      ]
    );


  if (!settlement) {
    throwHttp(
      409,
      "CANCELLATION_SETTLEMENT_MISSING",
      "The cancellation financial settlement is not available."
    );
  }


  if (
    settlement
      .settlement_status !==
      "finalized" ||
    settlement
      .final_payable_amount ===
      null
  ) {
    throwHttp(
      409,
      "CANCELLATION_FINANCIAL_REVIEW_REQUIRED",
      "The cancellation financial settlement must be finalized before refunding an overpayment."
    );
  }


  const originalAmount =
    Number(
      settlement
        .original_total_amount
    );


  const finalPayable =
    Number(
      settlement
        .final_payable_amount
    );


  if (
    !Number.isFinite(
      originalAmount
    ) ||
    !Number.isFinite(
      finalPayable
    ) ||
    originalAmount < 0 ||
    finalPayable < 0 ||
    finalPayable >
      originalAmount +
      0.009
  ) {
    throwHttp(
      500,
      "INVALID_CANCELLATION_SETTLEMENT",
      "The cancellation financial settlement contains an invalid payable amount."
    );
  }


  /* ==========================================================
     CALCULATE EXACT REFUND FROM PAYMENT LEDGER

     Client NEVER sends refund amount.
  ========================================================== */

  const currentState =
    await getLockedPaymentState(
      connection,
      safeHotelId,
      safeBookingId,
      finalPayable
    );


  const currentNetPaid =
    Math.max(
      0,
      Number(
        currentState
          .netPaid ||
        0
      )
    );


  const requiredRefund =
    Number(
      Math.max(
        0,
        currentNetPaid -
        finalPayable
      ).toFixed(2)
    );


  if (
    requiredRefund <=
    0.009
  ) {
    throwHttp(
      409,
      "CANCELLATION_REFUND_NOT_REQUIRED",
      "This cancelled booking has no refundable overpayment."
    );
  }


  /* ==========================================================
     AUDIT NOTE
  ========================================================== */

  const auditNote =
    [
      "Cancellation settlement overpayment refund.",

      `Final cancellation payable: ₹${finalPayable.toFixed(
        2
      )}.`,

      `Previous net paid: ₹${currentNetPaid.toFixed(
        2
      )}.`,

      `Refund due: ₹${requiredRefund.toFixed(
        2
      )}.`,

      booking
        .cancellation_source
        ? `Cancellation source: ${booking.cancellation_source}.`
        : null,

      normalizedNotes ||
        null,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(
        0,
        500
      );


  /* ==========================================================
     RECORD REFUND
  ========================================================== */

  const [result] =
    await connection.query(
      `
        INSERT INTO payments (
          hotel_id,
          booking_id,

          transaction_type,
          payment_stage,

          amount,
          payment_method,
          transaction_id,

          created_by_admin_id,
          notes,

          payment_status
        )

        VALUES (
          ?,
          ?,

          'refund',
          'other',

          ?,
          ?,
          ?,

          ?,
          ?,

          'success'
        )
      `,
      [
        safeHotelId,
        safeBookingId,

        requiredRefund,
        refundMethod,

        refundMethod ===
          "cash"
          ? null
          : normalizedTransactionId,

        safeAdminId,
        auditNote,
      ]
    );


  /* ==========================================================
     VERIFY FINAL LEDGER

     After exact refund:
     net paid must equal final cancellation payable.
  ========================================================== */

  const finalState =
    await getLockedPaymentState(
      connection,
      safeHotelId,
      safeBookingId,
      finalPayable
    );


  const updatedNetPaid =
    Number(
      finalState
        .netPaid ||
      0
    );


  if (
    Math.abs(
      updatedNetPaid -
      finalPayable
    ) >
    0.009
  ) {
    throwHttp(
      500,
      "CANCELLATION_REFUND_RECONCILIATION_FAILED",
      "The cancellation refund could not be reconciled with the final payable amount."
    );
  }


  /* ==========================================================
     SYNC BOOKING PAYMENT STATUS
  ========================================================== */

  await connection.query(
    `
      UPDATE bookings

      SET
        payment_status = ?,
        updated_by_admin_id = ?

      WHERE hotel_id = ?
        AND booking_id = ?
    `,
    [
      finalState
        .paymentStatus,

      safeAdminId,
      safeHotelId,
      safeBookingId,
    ]
  );


  return {
    refundPaymentId:
      Number(
        result.insertId
      ),

    bookingId:
      Number(
        booking.booking_id
      ),

    bookingCode:
      booking.booking_code,

    settlementId:
      Number(
        settlement
          .settlement_id
      ),

    originalBookingAmount:
      originalAmount,

    finalPayableAmount:
      finalPayable,

    previousNetPaid:
      currentNetPaid,

    refundAmount:
      requiredRefund,

    updatedNetPaid,

    outstandingAmount:
      Number(
        Math.max(
          0,
          finalState
            .outstandingAmount
        ).toFixed(2)
      ),

    paymentStatus:
      finalState
        .paymentStatus,

    refundMethod,

    transactionId:
      refundMethod ===
        "cash"
        ? null
        : normalizedTransactionId,
  };
}


module.exports = {
  refundCancellationOverpayment,
};