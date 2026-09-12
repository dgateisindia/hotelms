const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  collectBookingPayment:
    collectBookingPaymentService,
} = require(
  "../../services/bookingPaymentService"
);

const {
  refundNoShowOverpayment:
    refundNoShowOverpaymentService,
} = require(
  "../../services/bookingPayments/noShowRefundService"
);

const {
  refundCancellationOverpayment:
    refundCancellationOverpaymentService,
} = require(
  "../../services/bookingPayments/cancellationRefundService"
);

const {
  collectReservationGroupPayment:
    collectReservationGroupPaymentService,
} = require(
  "../../services/bookingPayments/groupPaymentService"
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

exports.collectReservationGroupPayment = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);


  const reservationGroupId =
    parsePositiveInteger(
      req.params.groupId
    );


  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }


  if (!reservationGroupId) {
    return sendError(
      res,
      400,
      "INVALID_RESERVATION_GROUP_ID",
      "The reservation group ID is invalid."
    );
  }


  const connection =
    await db.getConnection();


  try {
    await connection
      .beginTransaction();


    const result =
      await collectReservationGroupPaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          reservationGroupId,

          amount:
            req.body?.amount,

          method:
            req.body?.payment_method,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,

          bookingIds:
            req.body?.booking_ids,
        }
      );


    await connection
      .commit();


    return res
      .status(201)
      .json({
        success: true,

        message:
          "Reservation group payment collected successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback()
      .catch(
        () => {}
      );


    logBookingError(
      "COLLECT_GROUP_PAYMENT",
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


    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "DUPLICATE_TRANSACTION_REFERENCE",
        "This payment transaction reference has already been used."
      );
    }


    return sendError(
      res,
      500,
      "GROUP_PAYMENT_COLLECTION_FAILED",
      "The reservation group payment could not be recorded. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   COLLECT BOOKING PAYMENT

   Financial source of truth:
   payments table.

   Allowed:
   confirmed
   checked_in
   no_show — only against a finalized No Show settlement
============================================================ */

exports.collectBookingPayment = async (
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
      await connection.commit();

      return sendError(
        res,
        409,
        automaticClosure.code,
        automaticClosure.message
      );
    }


    const result =
      await collectBookingPaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          amount:
            req.body?.amount,

          method:
            req.body?.payment_method,

          stage:
            req.body?.payment_stage,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,
        }
      );


    await connection.commit();


    return res
      .status(201)
      .json({
        success: true,

        message:
          "Payment collected successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "COLLECT_PAYMENT",
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


    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "DUPLICATE_TRANSACTION_REFERENCE",
        "This transaction reference has already been used."
      );
    }


    return sendError(
      res,
      500,
      "PAYMENT_COLLECTION_FAILED",
      "The payment could not be recorded. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   REFUND NO-SHOW OVERPAYMENT

   Backend calculates the exact refundable amount.
   Client only chooses refund method/reference/notes.
============================================================ */

exports.refundNoShowOverpayment = async (
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
    await connection.beginTransaction();

    const result =
      await refundNoShowOverpaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          method:
            req.body?.refund_method,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,
        }
      );

    await connection.commit();

    return res
      .status(201)
      .json({
        success: true,

        message:
          "No Show refund processed successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection.rollback();

    logBookingError(
      "REFUND_NO_SHOW_OVERPAYMENT",
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

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "DUPLICATE_TRANSACTION_REFERENCE",
        "This refund transaction reference has already been used."
      );
    }

    return sendError(
      res,
      500,
      "NO_SHOW_REFUND_FAILED",
      "The No Show refund could not be processed. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   REFUND CANCELLATION OVERPAYMENT

   Backend calculates the exact refundable amount.
   Client only chooses refund method/reference/notes.
============================================================ */

exports.refundCancellationOverpayment = async (
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
    await connection.beginTransaction();

    const result =
      await refundCancellationOverpaymentService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          method:
            req.body?.refund_method,

          transactionId:
            req.body?.transaction_id,

          notes:
            req.body?.notes,
        }
      );

    await connection.commit();

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Cancellation refund processed successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection.rollback();

    logBookingError(
      "REFUND_CANCELLATION_OVERPAYMENT",
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

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "DUPLICATE_TRANSACTION_REFERENCE",
        "This refund transaction reference has already been used."
      );
    }

    return sendError(
      res,
      500,
      "CANCELLATION_REFUND_FAILED",
      "The cancellation refund could not be processed. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECKOUT RESERVATION GROUP

   booking_ids omitted / empty:
   → checkout every currently checked-in room in the group

   booking_ids supplied:
   → checkout exactly those selected checked-in rooms

   One transaction:
   any child checkout failure rolls back the complete operation.
============================================================ */
