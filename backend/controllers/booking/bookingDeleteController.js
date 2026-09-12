const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
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

exports.deleteBooking = async (
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


    const [[booking]] =
      await connection.query(
        `
          SELECT
            booking_id,
            booking_status,
            source_request_id

          FROM bookings

          WHERE hotel_id = ?
            AND booking_id = ?

          FOR UPDATE
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (!booking) {
      throwHttp(
        404,
        "BOOKING_NOT_FOUND",
        "The booking was not found in your hotel."
      );
    }


    const [[paymentSummary]] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS paymentCount

          FROM payments

          WHERE hotel_id = ?
            AND booking_id = ?
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    const [[adjustmentSummary]] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS adjustmentCount

          FROM booking_adjustments

          WHERE hotel_id = ?
            AND booking_id = ?
        `,
        [
          context.hotelId,
          bookingId,
        ]
      );


    if (
      booking.booking_status !==
        "pending" ||
      booking.source_request_id !==
        null ||
      Number(
        paymentSummary
          .paymentCount ||
        0
      ) > 0 ||
      Number(
        adjustmentSummary
          .adjustmentCount ||
        0
      ) > 0
    ) {
      throwHttp(
        409,
        "BOOKING_HISTORY_MUST_BE_PRESERVED",
        "This booking contains operational or financial history and cannot be deleted. Cancel it instead."
      );
    }


    /*
     * booking_room_history is ON DELETE CASCADE,
     * therefore draft room history is removed safely.
     */
    await connection.query(
      `
        DELETE FROM bookings

        WHERE hotel_id = ?
          AND booking_id = ?
      `,
      [
        context.hotelId,
        bookingId,
      ]
    );


    await connection.commit();


    return res
      .status(200)
      .json({
        success: true,

        message:
          "Pending booking deleted successfully.",
      });
  } catch (error) {
    await connection
      .rollback();


    logBookingError(
      "DELETE_BOOKING",
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
        "ER_ROW_IS_REFERENCED_2" ||
      error?.code ===
        "ER_ROW_IS_REFERENCED"
    ) {
      return sendError(
        res,
        409,
        "BOOKING_IN_USE",
        "This booking is linked to hotel records and cannot be deleted."
      );
    }


    return sendError(
      res,
      500,
      "BOOKING_DELETE_FAILED",
      "The booking could not be deleted. Please try again."
    );
  } finally {
    connection.release();
  }
};
