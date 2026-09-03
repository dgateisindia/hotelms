const {
  syncBookingPaymentStatus,
} = require(
  "./bookingPaymentService"
);


const SETTLEMENT_BY_STATUS = {
  no_show: {
    type: "no_show",
    label: "No Show",
  },

  cancelled: {
    type: "cancellation",
    label: "Cancellation",
  },
};


/* ============================================================
   HELPERS
============================================================ */

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


function money(
  value
) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount)
  ) {
    return null;
  }

  return Number(
    amount.toFixed(2)
  );
}


function normalizeNotes(
  value
) {
  return String(value || "")
    .trim();
}


function getSettlementConfig(
  bookingStatus
) {
  return (
    SETTLEMENT_BY_STATUS[
      String(
        bookingStatus || ""
      )
        .trim()
        .toLowerCase()
    ] ||
    null
  );
}


/* ============================================================
   GET FINANCIAL SETTLEMENT REVIEW

   Supported lifecycle statuses:
   no_show   -> no_show settlement
   cancelled -> cancellation settlement

   Settlement type is derived from booking lifecycle.
   Client never chooses settlement type.
============================================================ */

async function getFinancialSettlementReviewWithConnection(
  connection,
  {
    hotelId,
    bookingId,
    forUpdate = false,
  }
) {
  const hId =
    positiveId(
      hotelId,
      "Hotel ID"
    );

  const bId =
    positiveId(
      bookingId,
      "Booking ID"
    );


  /* ==========================================================
     LOCK / READ BOOKING FIRST
  ========================================================== */

  const [[booking]] =
    await connection.query(
      `
        SELECT
          booking_id,
          booking_code,
          booking_status,
          total_amount,
          payment_status

        FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?

        LIMIT 1

        ${
          forUpdate
            ? "FOR UPDATE"
            : ""
        }
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
      "The booking was not found."
    );
  }


  const config =
    getSettlementConfig(
      booking.booking_status
    );


  if (!config) {
    throwHttp(
      409,
      "FINANCIAL_SETTLEMENT_REVIEW_NOT_ALLOWED",
      "Financial settlement review is available only for No Show or cancelled bookings."
    );
  }


  /* ==========================================================
     READ MATCHING LIFECYCLE SETTLEMENT
  ========================================================== */

  const [[settlement]] =
    await connection.query(
      `
        SELECT
          settlement_id,
          settlement_type,
          settlement_status,

          policy_snapshot_id,

          original_total_amount,
          charge_basis_amount,

          calculation_mode,
          charge_method,
          charge_value,

          final_payable_amount,

          created_by_type,
          created_by_id,

          reviewed_by_type,
          reviewed_by_id,
          reviewed_at,
          review_notes,

          created_at,
          updated_at

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type = ?

        LIMIT 1

        ${
          forUpdate
            ? "FOR UPDATE"
            : ""
        }
      `,
      [
        hId,
        bId,
        config.type,
      ]
    );


  if (!settlement) {
    throwHttp(
      409,
      "FINANCIAL_SETTLEMENT_MISSING",
      `The ${config.label} financial settlement is not available.`
    );
  }


  const bookingTotal =
    money(
      booking.total_amount
    );

  const originalTotal =
    money(
      settlement
        .original_total_amount
    );


  if (
    bookingTotal === null ||
    originalTotal === null ||
    bookingTotal < 0 ||
    originalTotal < 0
  ) {
    throwHttp(
      500,
      "INVALID_SETTLEMENT_TOTAL",
      "The financial settlement contains an invalid original amount."
    );
  }


  if (
    Math.abs(
      bookingTotal -
      originalTotal
    ) > 0.009
  ) {
    throwHttp(
      500,
      "SETTLEMENT_TOTAL_MISMATCH",
      "The settlement original amount does not match the preserved booking amount."
    );
  }


  return {
    hotelId:
      hId,

    bookingId:
      bId,

    bookingCode:
      booking.booking_code,

    bookingStatus:
      booking.booking_status,

    bookingPaymentStatus:
      booking.payment_status,

    settlementId:
      Number(
        settlement
          .settlement_id
      ),

    settlementType:
      settlement
        .settlement_type,

    settlementLabel:
      config.label,

    settlementStatus:
      settlement
        .settlement_status,

    policySnapshotId:
      settlement
        .policy_snapshot_id
        ? Number(
            settlement
              .policy_snapshot_id
          )
        : null,

    originalTotalAmount:
      originalTotal,

    chargeBasisAmount:
      settlement
        .charge_basis_amount ===
        null
        ? null
        : money(
            settlement
              .charge_basis_amount
          ),

    calculationMode:
      settlement
        .calculation_mode,

    chargeMethod:
      settlement
        .charge_method,

    chargeValue:
      settlement
        .charge_value ===
        null
        ? null
        : Number(
            settlement
              .charge_value
          ),

    finalPayableAmount:
      settlement
        .final_payable_amount ===
        null
        ? null
        : money(
            settlement
              .final_payable_amount
          ),

    reviewNotes:
      settlement
        .review_notes ||
      null,

    reviewedByType:
      settlement
        .reviewed_by_type ||
      null,

    reviewedById:
      settlement
        .reviewed_by_id
        ? Number(
            settlement
              .reviewed_by_id
          )
        : null,

    reviewedAt:
      settlement
        .reviewed_at ||
      null,
  };
}


/* ============================================================
   FINALIZE MANUAL FINANCIAL REVIEW

   Important:
   - booking lifecycle is already closed/no-show
   - original booking total is immutable
   - admin chooses FINAL payable only
   - client cannot choose settlement type
   - no payment/refund is automatically created
   - payment ledger is reconciled after finalization

   Controller owns transaction.
============================================================ */

async function finalizeFinancialSettlementReviewWithConnection(
  connection,
  {
    hotelId,
    adminId,
    bookingId,

    finalPayableAmount,
    reviewNotes,
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


  const finalPayable =
    money(
      finalPayableAmount
    );


  if (
    finalPayable === null ||
    finalPayable < 0
  ) {
    throwHttp(
      400,
      "INVALID_FINAL_PAYABLE_AMOUNT",
      "Enter a valid final payable amount."
    );
  }


  const normalizedNotes =
    normalizeNotes(
      reviewNotes
    );


  /*
   * Manual financial decisions must always leave an
   * audit explanation.
   */
  if (!normalizedNotes) {
    throwHttp(
      400,
      "FINANCIAL_REVIEW_NOTES_REQUIRED",
      "Enter review notes explaining the final settlement amount."
    );
  }


  if (
    normalizedNotes.length >
    500
  ) {
    throwHttp(
      400,
      "FINANCIAL_REVIEW_NOTES_TOO_LONG",
      "Financial review notes cannot exceed 500 characters."
    );
  }


  /* ==========================================================
     LOCK ORDER:
     booking -> settlement
  ========================================================== */

  const review =
    await getFinancialSettlementReviewWithConnection(
      connection,
      {
        hotelId:
          hId,

        bookingId:
          bId,

        forUpdate:
          true,
      }
    );


  if (
    review.settlementStatus ===
    "finalized"
  ) {
    throwHttp(
      409,
      "FINANCIAL_SETTLEMENT_ALREADY_FINALIZED",
      "This financial settlement has already been finalized and cannot be changed."
    );
  }


  if (
    review.settlementStatus !==
    "manual_review_required"
  ) {
    throwHttp(
      409,
      "FINANCIAL_SETTLEMENT_NOT_REVIEWABLE",
      "This financial settlement is not waiting for manual review."
    );
  }


  if (
    finalPayable >
    review.originalTotalAmount +
      0.009
  ) {
    throwHttp(
      400,
      "FINAL_PAYABLE_EXCEEDS_BOOKING_TOTAL",
      "The final payable amount cannot exceed the original booking amount."
    );
  }


  /* ==========================================================
     PRESERVE WHY REVIEW WAS TRIGGERED

     review_notes initially contains the automatic/manual
     review reason generated when settlement was created.

     After review it contains:
     Admin decision + original review trigger.
  ========================================================== */

  const previousReviewReason =
    normalizeNotes(
      review.reviewNotes
    );


  const reviewTrigger =
    previousReviewReason
      ? `Review trigger: ${previousReviewReason}`
      : "";


  const adminDecision =
    `Admin decision: ${normalizedNotes}`;


  /*
  * Preserve the original review trigger first.
  * If the combined audit text exceeds the DB limit, only the
  * tail of the admin explanation is truncated.
  */
  const auditNotes =
    [
      reviewTrigger,
      adminDecision,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(
        0,
        500
      );


  const [updateResult] =
    await connection.query(
      `
        UPDATE booking_financial_settlements

        SET
          settlement_status =
            'finalized',

          final_payable_amount = ?,

          reviewed_by_type =
            'admin',

          reviewed_by_id = ?,

          reviewed_at = NOW(),

          review_notes = ?

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type = ?
          AND settlement_status =
            'manual_review_required'
      `,
      [
        finalPayable,
        aId,
        auditNotes,

        hId,
        bId,
        review.settlementType,
      ]
    );


  if (
    updateResult.affectedRows !==
    1
  ) {
    throwHttp(
      409,
      "FINANCIAL_SETTLEMENT_CHANGED",
      "The financial settlement changed before the review could be finalized. Refresh and try again."
    );
  }


  /* ==========================================================
     RECONCILE PAYMENT STATUS AGAINST NEW FINAL PAYABLE
  ========================================================== */

  const paymentState =
    await syncBookingPaymentStatus(
      connection,
      hId,
      bId
    );


  const netPaid =
    Number(
      paymentState
        ?.netPaid ||
      0
    );


  const outstandingAmount =
    Number(
      Math.max(
        0,
        finalPayable -
          Math.max(
            0,
            netPaid
          )
      ).toFixed(2)
    );


  const overpaidAmount =
    Number(
      Math.max(
        0,
        netPaid -
          finalPayable
      ).toFixed(2)
    );


  /* ==========================================================
     LOAD CANONICAL REVIEW TIMESTAMP
  ========================================================== */

  const [[finalizedSettlement]] =
    await connection.query(
      `
        SELECT
          settlement_id,
          settlement_status,
          final_payable_amount,

          reviewed_by_type,
          reviewed_by_id,
          reviewed_at,
          review_notes

        FROM booking_financial_settlements

        WHERE hotel_id = ?
          AND booking_id = ?
          AND settlement_type = ?

        LIMIT 1
      `,
      [
        hId,
        bId,
        review.settlementType,
      ]
    );


  return {
    bookingId:
      bId,

    bookingCode:
      review.bookingCode,

    bookingStatus:
      review.bookingStatus,

    settlementId:
      Number(
        finalizedSettlement
          .settlement_id
      ),

    settlementType:
      review.settlementType,

    settlementLabel:
      review.settlementLabel,

    settlementStatus:
      finalizedSettlement
        .settlement_status,

    originalTotalAmount:
      review.originalTotalAmount,

    finalPayableAmount:
      Number(
        finalizedSettlement
          .final_payable_amount
      ),

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

    paymentStatus:
      paymentState
        ?.paymentStatus ||
      null,

    collectionRequired:
      outstandingAmount >
      0.009,

    refundRequired:
      overpaidAmount >
      0.009,

    reviewedByType:
      finalizedSettlement
        .reviewed_by_type,

    reviewedById:
      Number(
        finalizedSettlement
          .reviewed_by_id
      ),

    reviewedAt:
      finalizedSettlement
        .reviewed_at,

    reviewNotes:
      finalizedSettlement
        .review_notes,
  };
}


module.exports = {
  getFinancialSettlementReviewWithConnection,
  finalizeFinancialSettlementReviewWithConnection,
};