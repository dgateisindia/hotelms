const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  checkInBooking:
    checkInBookingLifecycle,

  extendStayBooking:
    extendStayBookingLifecycle,

  checkoutBooking:
    checkoutBookingLifecycle,
} = require(
  "../../services/bookingLifecycleService"
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

exports.checkInBooking = async (
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
      await checkInBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Guest checked in successfully.",

        data: result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "CHECK_IN_BOOKING",
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
      "BOOKING_CHECK_IN_FAILED",
      "The guest could not be checked in. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECK IN INDIVIDUAL GUEST

   Supports:
   - New arriving guest
   - Existing expected guest
   - First guest activates the room booking
   - Later guests may check into the same occupied room
============================================================ */

exports.extendStayBooking = async (
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
      await extendStayBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          newCheckOut:
            req.body
              ?.new_check_out,

          reason:
            req.body
              ?.reason,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Stay extended successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "EXTEND_STAY",
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
      "STAY_EXTENSION_FAILED",
      "The stay could not be extended. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   COLLECT RESERVATION GROUP PAYMENT

   One customer receipt may be allocated across one or more
   child room bookings.

   Financial source of truth remains:
   reservation_group_payments -> receipt
   payments                   -> booking ledger

   All allocations run inside ONE transaction.
============================================================ */

exports.checkoutBooking = async (
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
      await checkoutBookingLifecycle(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,
        }
      );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Guest checked out successfully.",

        data:
          result,
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "CHECKOUT_BOOKING",
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
      "BOOKING_CHECKOUT_FAILED",
      "The guest could not be checked out. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CANCEL BOOKING

   Pre-arrival only:
   pending / confirmed → cancelled

   Business logic lives in bookingCancellationService.
============================================================ */

