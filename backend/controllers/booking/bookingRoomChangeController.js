const db =
  require("../../config/db").promisePool;

const {
  parsePositiveInteger,
} = require(
  "../../services/bookingValidation"
);

const {
  changeCheckedInRoom:
    changeCheckedInRoomService,
} = require(
  "../../services/bookingRoomChangeService"
);

const {
  startTemporaryRoomChange:
    startTemporaryRoomChangeService,
} = require(
  "../../services/booking/room-change/temporaryMoveService"
);

const {
  markOriginalRoomReady:
    markOriginalRoomReadyService,
} = require(
  "../../services/booking/room-change/originalRoomReadyService"
);

const {
  returnToOriginalRoom:
    returnToOriginalRoomService,
} = require(
  "../../services/booking/room-change/returnOriginalRoomService"
);

const {
  stayInReplacementRoom:
    stayInReplacementRoomService,
} = require(
  "../../services/booking/room-change/stayReplacementService"
);

/* ============================================================
   RESPONSE / CONTEXT HELPERS
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
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0 ||
    !Number.isSafeInteger(adminId) ||
    adminId <= 0
  ) {
    return null;
  }

  return {
    hotelId,
    adminId,
  };
}

function logRoomChangeError(
  operation,
  error
) {
  console.error(
    `[BOOKING:ROOM_CHANGE:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown room-change error"
    }`
  );
}

/* ============================================================
   PERMANENT ROOM CHANGE
============================================================ */

exports.changeBookingRoom = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);

  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  const bookingId =
    parsePositiveInteger(
      req.params.id
    );

  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }

  const newRoomId =
    parsePositiveInteger(
      req.body?.new_room_id
    );

  if (!newRoomId) {
    return sendError(
      res,
      400,
      "INVALID_TARGET_ROOM_ID",
      "Select a valid replacement room."
    );
  }

  let connection;

  try {
    connection =
      await db.getConnection();

    await connection
      .beginTransaction();

    const result =
      await changeCheckedInRoomService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          newRoomId,

          changeSource:
            req.body?.change_source,

          reason:
            req.body?.reason,

          reasonCategory:
            req.body?.reason_category,

          customRatePerNight:
            req.body?.custom_rate_per_night,
        }
      );

    await connection.commit();

    return res
      .status(200)
      .json({
        success: true,

        message:
          `Room changed successfully from Room ${result.oldRoom.roomNumber} to Room ${result.newRoom.roomNumber}.`,

        data: result,
      });
  } catch (error) {
    if (connection) {
      await connection
        .rollback()
        .catch(() => {});
    }

    logRoomChangeError(
      "PERMANENT",
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
      "BOOKING_ROOM_CHANGE_FAILED",
      "The room could not be changed. Please try again."
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/* ============================================================
   START TEMPORARY ROOM CHANGE
============================================================ */

exports.startTemporaryBookingRoomChange =
  async (
    req,
    res
  ) => {
    const context =
      getAdminContext(req);

    if (!context) {
      return sendError(
        res,
        403,
        "HOTEL_CONTEXT_MISSING",
        "Your Admin account is not linked to a valid hotel."
      );
    }

    const bookingId =
      parsePositiveInteger(
        req.params.id
      );

    if (!bookingId) {
      return sendError(
        res,
        400,
        "INVALID_BOOKING_ID",
        "The booking ID is invalid."
      );
    }

    const replacementRoomId =
      parsePositiveInteger(
        req.body?.replacement_room_id
      );

    if (!replacementRoomId) {
      return sendError(
        res,
        400,
        "INVALID_REPLACEMENT_ROOM_ID",
        "Select a valid replacement room."
      );
    }

    let connection;

    try {
      connection =
        await db.getConnection();

      await connection
        .beginTransaction();

      const result =
        await startTemporaryRoomChangeService(
          connection,
          {
            hotelId:
              context.hotelId,

            adminId:
              context.adminId,

            bookingId,

            replacementRoomId,

            changeSource:
              req.body?.change_source,

            reason:
              req.body?.reason,

            reasonCategory:
              req.body?.reason_category,
          }
        );

      await connection.commit();

      return res
        .status(200)
        .json({
          success: true,

          message:
            `Temporary room change started from Room ${result.originalRoom.roomNumber} to Room ${result.replacementRoom.roomNumber}.`,

          data: result,
        });
    } catch (error) {
      if (connection) {
        await connection
          .rollback()
          .catch(() => {});
      }

      logRoomChangeError(
        "START_TEMPORARY",
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
        "TEMPORARY_ROOM_CHANGE_FAILED",
        "The temporary room change could not be started. Please try again."
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

/* ============================================================
   MARK ORIGINAL ROOM READY
============================================================ */

exports.markOriginalBookingRoomReady =
  async (
    req,
    res
  ) => {
    const context =
      getAdminContext(req);

    if (!context) {
      return sendError(
        res,
        403,
        "HOTEL_CONTEXT_MISSING",
        "Your Admin account is not linked to a valid hotel."
      );
    }

    const bookingId =
      parsePositiveInteger(
        req.params.id
      );

    if (!bookingId) {
      return sendError(
        res,
        400,
        "INVALID_BOOKING_ID",
        "The booking ID is invalid."
      );
    }

    let connection;

    try {
      connection =
        await db.getConnection();

      await connection
        .beginTransaction();

      const result =
        await markOriginalRoomReadyService(
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
            `Original Room ${result.originalRoom.roomNumber} is ready. The temporary room change is awaiting resolution.`,

          data: result,
        });
    } catch (error) {
      if (connection) {
        await connection
          .rollback()
          .catch(() => {});
      }

      logRoomChangeError(
        "ORIGINAL_READY",
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
        "MARK_ORIGINAL_ROOM_READY_FAILED",
        "The original room could not be marked ready. Please try again."
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

/* ============================================================
   RETURN TO ORIGINAL ROOM
============================================================ */

exports.returnBookingToOriginalRoom =
  async (
    req,
    res
  ) => {
    const context =
      getAdminContext(req);

    if (!context) {
      return sendError(
        res,
        403,
        "HOTEL_CONTEXT_MISSING",
        "Your Admin account is not linked to a valid hotel."
      );
    }

    const bookingId =
      parsePositiveInteger(
        req.params.id
      );

    if (!bookingId) {
      return sendError(
        res,
        400,
        "INVALID_BOOKING_ID",
        "The booking ID is invalid."
      );
    }

    let connection;

    try {
      connection =
        await db.getConnection();

      await connection
        .beginTransaction();

      const result =
        await returnToOriginalRoomService(
          connection,
          {
            hotelId:
              context.hotelId,

            adminId:
              context.adminId,

            bookingId,

            resolutionNotes:
              req.body?.resolution_notes,
          }
        );

      await connection.commit();

      return res
        .status(200)
        .json({
          success: true,

          message:
            `Guest returned successfully to original Room ${result.originalRoom.roomNumber}.`,

          data: result,
        });
    } catch (error) {
      if (connection) {
        await connection
          .rollback()
          .catch(() => {});
      }

      logRoomChangeError(
        "RETURN_ORIGINAL",
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
        "RETURN_TO_ORIGINAL_ROOM_FAILED",
        "The guest could not be returned to the original room. Please try again."
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

/* ============================================================
   STAY IN REPLACEMENT ROOM
============================================================ */

exports.stayInReplacementRoom = async (
  req,
  res
) => {
  const context =
    getAdminContext(req);

  if (!context) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  const bookingId =
    parsePositiveInteger(
      req.params.id
    );

  if (!bookingId) {
    return sendError(
      res,
      400,
      "INVALID_BOOKING_ID",
      "The booking ID is invalid."
    );
  }

  let connection;

  try {
    connection =
      await db.getConnection();

    await connection
      .beginTransaction();

    const result =
      await stayInReplacementRoomService(
        connection,
        {
          hotelId:
            context.hotelId,

          adminId:
            context.adminId,

          bookingId,

          resolutionNotes:
            req.body?.resolution_notes,

          customRatePerNight:
            req.body
              ?.custom_rate_per_night,
        }
      );

    await connection.commit();

    return res
      .status(200)
      .json({
        success: true,

        message:
          `Guest will remain in replacement Room ${result.replacementRoom.roomNumber}.`,

        data: result,
      });
  } catch (error) {
    if (connection) {
      await connection
        .rollback()
        .catch(() => {});
    }

    logRoomChangeError(
      "STAY_REPLACEMENT",
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
      "STAY_REPLACEMENT_FAILED",
      "The temporary room change could not be resolved as Stay Replacement. Please try again."
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};