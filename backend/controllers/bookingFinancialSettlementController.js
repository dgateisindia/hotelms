const db =
  require("../config/db")
    .promisePool;

const {
  parsePositiveInteger,
} = require(
  "../services/bookingValidation"
);

const {
  getFinancialSettlementReviewWithConnection,

  finalizeFinancialSettlementReviewWithConnection,
} = require(
  "../services/bookingFinancialSettlementReviewService"
);


/* ============================================================
   RESPONSE HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res
    .status(status)
    .json({
      success: false,
      code,
      message,
    });
}


function logSettlementError(
  operation,
  error
) {
  console.error(
    `[BOOKING_FINANCIAL_SETTLEMENT:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown financial settlement error"
    }`
  );
}


function getAdminContext(req) {
  const hotelId =
    Number(
      req.dbUser?.hotelId
    );

  const adminId =
    Number(
      req.dbUser?.adminId
    );


  if (
    !Number.isSafeInteger(
      hotelId
    ) ||
    hotelId <= 0 ||
    !Number.isSafeInteger(
      adminId
    ) ||
    adminId <= 0
  ) {
    return null;
  }


  return {
    hotelId,
    adminId,
  };
}


/* ============================================================
   RESPONSE SERIALIZER
============================================================ */

function serializeReview(
  review
) {
  if (!review) {
    return null;
  }


  return {
    booking_id:
      review.bookingId,

    booking_code:
      review.bookingCode,

    booking_status:
      review.bookingStatus,

    booking_payment_status:
      review.bookingPaymentStatus ??
      review.paymentStatus ??
      null,

    settlement_id:
      review.settlementId,

    settlement_type:
      review.settlementType,

    settlement_label:
      review.settlementLabel,

    settlement_status:
      review.settlementStatus,

    policy_snapshot_id:
      review.policySnapshotId ??
      null,

    original_total_amount:
      review.originalTotalAmount,

    charge_basis_amount:
      review.chargeBasisAmount ??
      null,

    calculation_mode:
      review.calculationMode ??
      null,

    charge_method:
      review.chargeMethod ??
      null,

    charge_value:
      review.chargeValue ??
      null,

    final_payable_amount:
      review.finalPayableAmount ??
      null,

    gross_paid:
      review.grossPaid ??
      null,

    refunded_amount:
      review.refundedAmount ??
      null,

    net_paid:
      review.netPaid ??
      null,

    outstanding_amount:
      review.outstandingAmount ??
      null,

    overpaid_amount:
      review.overpaidAmount ??
      null,

    collection_required:
      review.collectionRequired ??
      null,

    refund_required:
      review.refundRequired ??
      null,

    reviewed_by_type:
      review.reviewedByType ??
      null,

    reviewed_by_id:
      review.reviewedById ??
      null,

    reviewed_at:
      review.reviewedAt ??
      null,

    review_notes:
      review.reviewNotes ??
      null,
  };
}


/* ============================================================
   GET FINANCIAL SETTLEMENT REVIEW

   Supports:
   no_show
   cancelled

   Settlement type comes from booking lifecycle.
============================================================ */

exports.getFinancialSettlementReview = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    const result =
      await getFinancialSettlementReviewWithConnection(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,

          forUpdate:
            false,
        }
      );


    return res
      .status(200)
      .json({
        success: true,

        data:
          serializeReview(
            result
          ),
      });
  } catch (error) {
    logSettlementError(
      "GET_REVIEW",
      error
    );


    if (
      error?.status &&
      error?.code
    ) {
      return sendError(
        res,
        error.status,
        error.code,
        error.message
      );
    }


    return sendError(
      res,
      500,
      "FINANCIAL_SETTLEMENT_REVIEW_LOAD_FAILED",
      "The financial settlement review could not be loaded."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   FINALIZE FINANCIAL SETTLEMENT REVIEW

   Admin supplies:
   - final payable
   - mandatory audit notes

   Payment/refund is NOT created here.

   After finalization:
   outstanding → existing Collect Payment flow
   overpayment → existing lifecycle Refund flow
============================================================ */

exports.finalizeFinancialSettlementReview = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const bookingId =
    parsePositiveInteger(
      req.params.id
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await finalizeFinancialSettlementReviewWithConnection(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          finalPayableAmount:
            req.body
              ?.final_payable_amount,

          reviewNotes:
            req.body
              ?.review_notes,
        }
      );


    await connection
      .commit();


    let message =
      "Financial settlement review finalized successfully.";


    if (
      result.refundRequired
    ) {
      message =
        "Financial settlement finalized. A refund is due.";
    } else if (
      result.collectionRequired
    ) {
      message =
        "Financial settlement finalized. A balance remains to be collected.";
    }


    return res
      .status(200)
      .json({
        success: true,
        message,

        data:
          serializeReview(
            result
          ),
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logSettlementError(
      "FINALIZE_REVIEW",
      error
    );


    if (
      error?.status &&
      error?.code
    ) {
      return sendError(
        res,
        error.status,
        error.code,
        error.message
      );
    }


    return sendError(
      res,
      500,
      "FINANCIAL_SETTLEMENT_REVIEW_FINALIZE_FAILED",
      "The financial settlement review could not be finalized."
    );
  } finally {
    connection.release();
  }
};