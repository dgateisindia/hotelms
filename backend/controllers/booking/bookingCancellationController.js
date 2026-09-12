const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  cancelBooking:
    cancelBookingService,
} = require(
  "../../services/bookingCancellationService"
);

const {
  reconcileOverdueBookingsWithConnection,
} = require(
  "../../services/bookingStatusService"
);
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


function logBookingError(
  operation,
  error
) {
  console.error(
    `[BOOKING:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown booking error"
    }`
  );
}

async function reconcileBookingBeforeAction(
  connection,
  {
    hotelId,
    bookingId,
  }
) {
  const result =
    await reconcileOverdueBookingsWithConnection(
      connection,
      {
        hotelId,
        bookingId,
      }
    );


  if (!result?.changed) {
    return null;
  }


  if (
    Number(
      result.noShowCount || 0
    ) > 0
  ) {
    return {
      code:
        "BOOKING_BECAME_NO_SHOW",

      message:
        "This reservation is now marked No Show because its configured no-show time passed without any check-in.",
    };
  }


  if (
    Number(
      result.expiredCount || 0
    ) > 0
  ) {
    return {
      code:
        "BOOKING_EXPIRED",

      message:
        "This pending reservation has expired because its stay window passed without becoming an active stay.",
    };
  }


  return {
    code:
      "BOOKING_LIFECYCLE_CLOSED",

    message:
      "This reservation is no longer open for this action.",
  };
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
   PAYMENT HELPERS
============================================================ */

exports.cancelBooking = async (
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


    /*
     * Prevent stale confirmed reservations from being
     * cancelled after they have already crossed into
     * No Show / Expired lifecycle.
     */
    const automaticClosure =
      await reconcileBookingBeforeAction(
        connection,
        {
          hotelId:
            context.hotelId,

          bookingId,
        }
      );


    if (automaticClosure) {
      await connection
        .commit();


      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await cancelBookingService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          cancellationSource:
            req.body
              ?.cancellation_source,

          cancellationReason:
            req.body
              ?.cancellation_reason,
        }
      );


    await connection
      .commit();


    let message =
      "Booking cancelled successfully.";


    if (
      result
        .financialReviewRequired
    ) {
      message =
        "Booking cancelled. The cancellation financial settlement requires review.";
    } else if (
      result
        .refundReviewRequired
    ) {
      message =
        "Booking cancelled. A refund is due based on the cancellation settlement.";
    } else if (
      Number(
        result
          .outstandingAmount ||
        0
      ) > 0.009
    ) {
      message =
        "Booking cancelled. A cancellation charge remains outstanding.";
    }


    return res
      .status(200)
      .json({
        success: true,
        message,

        data: {
          booking_id:
            result.bookingId,

          booking_code:
            result.bookingCode,

          booking_status:
            result.bookingStatus,

          cancellation_source:
            result
              .cancellationSource,

          cancellation_reason:
            result
              .cancellationReason,

          cancelled_at:
            result.cancelledAt,

          cancelled_by_admin_id:
            result
              .cancelledByAdminId,

          original_total_amount:
            result
              .originalTotalAmount,

          settlement_id:
            result.settlementId,

          settlement_status:
            result
              .settlementStatus,

          final_payable_amount:
            result
              .finalPayableAmount,

          financial_review_required:
            result
              .financialReviewRequired,

          gross_paid:
            result.grossPaid,

          refunded_amount:
            result
              .refundedAmount,

          net_paid:
            result.netPaid,

          outstanding_amount:
            result
              .outstandingAmount,

          overpaid_amount:
            result
              .overpaidAmount,

          refund_review_required:
            result
              .refundReviewRequired,

          payment_status:
            result.paymentStatus,
        },
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "CANCEL_BOOKING",
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
      "BOOKING_CANCEL_FAILED",
      "The booking could not be cancelled. Please try again."
    );
  } finally {
    connection.release();
  }
};


/* ============================================================
   DELETE BOOKING

   Hard delete only for a clean pending draft.

   History-bearing booking must be preserved.
============================================================ */
