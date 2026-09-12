const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  checkoutReservationGroup:
    checkoutReservationGroupService,
} = require(
  "../../services/bookingCheckout/groupCheckoutService"
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

exports.checkoutReservationGroup = async (
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
      await checkoutReservationGroupService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          groupId:
            reservationGroupId,

          bookingIds:
            req.body?.booking_ids,
        }
      );


    await connection
      .commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          result.scope ===
          "selected"
            ? "Selected rooms checked out successfully."
            : "Reservation group checked out successfully.",

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
      "CHECKOUT_RESERVATION_GROUP",
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
      "GROUP_CHECKOUT_FAILED",
      "The reservation group could not be checked out. Please try again."
    );
  } finally {
    connection.release();
  }
};

/* ============================================================
   CHECKOUT BOOKING

   Dedicated operational lifecycle action.

   checked_in
      ↓
   checked_out

   Checkout is blocked while payment is outstanding.
============================================================ */

