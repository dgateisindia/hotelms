const db = require("../config/db").promisePool;

const ROOM_STATUSES = new Set([
  "available",
  "occupied",
  "maintenance",
  "cleaning",
]);

/* ============================================================
   RESPONSE / LOG HELPERS
============================================================ */

function sendError(
  res,
  status,
  code,
  message
) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

function logRoomError(
  operation,
  error
) {
  console.error(
    `[ROOM:${operation}] ${
      error?.code ||
      "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown room error"
    }`
  );
}

/* ============================================================
   TRUSTED HOTEL CONTEXT
============================================================ */

function getHotelId(req) {
  const hotelId = Number(
    req.dbUser?.hotelId
  );

  if (
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0
  ) {
    return null;
  }

  return hotelId;
}

/* ============================================================
   VALIDATION HELPERS
============================================================ */

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    Number.isSafeInteger(parsedValue) &&
    parsedValue > 0
  ) {
    return parsedValue;
  }

  return null;
}

function parseRoomId(value) {
  return parsePositiveInteger(value);
}

function parseFloor(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const floor = Number(value);

  if (
    !Number.isSafeInteger(floor) ||
    floor < 0
  ) {
    return {
      value: null,
      error:
        "Floor must be a whole number greater than or equal to 0.",
    };
  }

  return {
    value: floor,
    error: "",
  };
}

function parseCapacity(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const directNumber = Number(value);

  if (
    Number.isSafeInteger(directNumber) &&
    directNumber >= 1
  ) {
    return directNumber;
  }

  /*
   * Temporary compatibility with current frontend:
   *
   * "2 Adults" -> 2
   * "2 Adults + 1 Child" -> 3
   * "4 Adults + 2 Child" -> 6
   *
   * Final DB stores numeric total capacity.
   */
  const numericParts =
    String(value).match(/\d+/g);

  if (!numericParts) {
    return null;
  }

  const totalCapacity =
    numericParts.reduce(
      (total, part) =>
        total + Number(part),
      0
    );

  if (
    !Number.isSafeInteger(
      totalCapacity
    ) ||
    totalCapacity < 1
  ) {
    return null;
  }

  return totalCapacity;
}

function parseMaxExtraBeds(
  value,
  capacity
) {
  /*
   * null means:
   * field was not supplied.
   *
   * CREATE:
   * backend will use 0.
   *
   * UPDATE:
   * existing DB value will be preserved.
   */
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const parsedValue =
    Number(value);

  if (
    !Number.isSafeInteger(
      parsedValue
    ) ||
    parsedValue < 0
  ) {
    return {
      value: null,
      error:
        "Maximum extra beds must be a whole number greater than or equal to 0.",
    };
  }

  if (
    parsedValue >
    capacity
  ) {
    return {
      value: null,
      error:
        "Maximum extra beds cannot exceed the room guest capacity.",
    };
  }

  return {
    value: parsedValue,
    error: "",
  };
}

function parsePrice(value) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const price = Number(value);

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 99999999.99
  ) {
    return null;
  }

  return price;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validateRoomPayload(body) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};

  const roomNo = String(
    source.roomNo || ""
  ).trim();

  if (!roomNo) {
    return {
      error:
        "Room number is required.",
    };
  }

  if (roomNo.length > 20) {
    return {
      error:
        "Room number must not exceed 20 characters.",
    };
  }

  const roomType = String(
    source.type || ""
  ).trim();

  if (!roomType) {
    return {
      error:
        "Room type is required.",
    };
  }

  if (roomType.length > 100) {
    return {
      error:
        "Room type must not exceed 100 characters.",
    };
  }

  const floorResult =
    parseFloor(source.floor);

  if (floorResult.error) {
    return {
      error: floorResult.error,
    };
  }

  const capacity =
    parseCapacity(
      source.capacity
    );

  if (!capacity) {
    return {
      error:
        "Room capacity must be at least 1 guest.",
    };
  }

  const maxExtraBedsResult =
    parseMaxExtraBeds(
      source.maxExtraBeds ??
        source.max_extra_beds,
      capacity
    );

  if (
    maxExtraBedsResult.error
  ) {
    return {
      error:
        maxExtraBedsResult.error,
    };
  }

  const price =
    parsePrice(source.price);

  if (price === null) {
    return {
      error:
        "Price per night must be a valid non-negative amount.",
    };
  }

  const status =
    normalizeStatus(
      source.status ||
        "available"
    );

  if (!ROOM_STATUSES.has(status)) {
    return {
      error:
        "Room status must be available, occupied, maintenance, or cleaning.",
    };
  }

  return {
    error: "",

    value: {
      roomNo,
      roomType,
      floor: floorResult.value,
      capacity,
      maxExtraBeds:
        maxExtraBedsResult.value,
      price,
      status,
    },
  };
}

function isValidDateValue(value) {
  const input = String(
    value || ""
  ).trim();

  if (!input) {
    return false;
  }

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      input
    );

  if (dateOnlyMatch) {
    const year = Number(
      dateOnlyMatch[1]
    );

    const month = Number(
      dateOnlyMatch[2]
    );

    const day = Number(
      dateOnlyMatch[3]
    );

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() ===
        month - 1 &&
      date.getUTCDate() === day
    );
  }

  return Number.isFinite(
    Date.parse(input)
  );
}

function compareDateValues(
  firstValue,
  secondValue
) {
  return (
    Date.parse(firstValue) -
    Date.parse(secondValue)
  );
}

/* ============================================================
   CREATE ROOM
============================================================ */

exports.createRoom = async (
  req,
  res
) => {
  const hotelId = getHotelId(req);

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  const validation =
    validateRoomPayload(
      req.body
    );

  if (validation.error) {
    return sendError(
      res,
      400,
      "INVALID_ROOM_DETAILS",
      validation.error
    );
  }

  const room = validation.value;

  try {
    const [result] =
      await db.query(
        `
          INSERT INTO rooms (
            hotel_id,
            room_number,
            room_type,
            floor_number,
            capacity,
            max_extra_beds,
            price_per_night,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          hotelId,
          room.roomNo,
          room.roomType,
          room.floor,
          room.capacity,
          room.maxExtraBeds ??
            0,
          room.price,
          room.status,
        ]
      );

    return res
      .status(201)
      .json({
        success: true,
        message:
          "Room added successfully.",

        roomId:
          Number(result.insertId),
      });
  } catch (error) {
    logRoomError(
      "CREATE_ROOM",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "ROOM_NUMBER_EXISTS",
        "This room number already exists in your hotel."
      );
    }

    return sendError(
      res,
      500,
      "ROOM_CREATE_FAILED",
      "The room could not be created. Please try again."
    );
  }
};

/* ============================================================
   GET HOTEL ROOMS

   Response remains an array because current Rooms.js uses:
   res.data.map(...)
============================================================ */

exports.getRooms = async (
  req,
  res
) => {
  const hotelId = getHotelId(req);

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  try {
    const [rooms] =
      await db.query(
        `
          SELECT
            room_id,
            room_number,
            room_type,
            floor_number,
            price_per_night,
            capacity,
            max_extra_beds,
            status,
            created_at

          FROM rooms

          WHERE hotel_id = ?

          ORDER BY room_id DESC
        `,
        [hotelId]
      );

    return res
      .status(200)
      .json(rooms);
  } catch (error) {
    logRoomError(
      "GET_ROOMS",
      error
    );

    return sendError(
      res,
      500,
      "ROOM_LIST_FETCH_FAILED",
      "Rooms could not be loaded. Please try again."
    );
  }
};

/* ============================================================
   UPDATE ROOM
============================================================ */

exports.updateRoom = async (
  req,
  res
) => {
  const hotelId = getHotelId(req);

  const roomId = parseRoomId(
    req.params.id
  );

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!roomId) {
    return sendError(
      res,
      400,
      "INVALID_ROOM_ID",
      "The room ID is invalid."
    );
  }

  const validation =
    validateRoomPayload(
      req.body
    );

  if (validation.error) {
    return sendError(
      res,
      400,
      "INVALID_ROOM_DETAILS",
      validation.error
    );
  }

  const room = validation.value;

  try {
    const [result] =
      await db.query(
        `
          UPDATE rooms

          SET
            room_number = ?,
            room_type = ?,
            floor_number = ?,
            capacity = ?,
            max_extra_beds =
              COALESCE(
                ?,
                max_extra_beds
              ),
            price_per_night = ?,
            status = ?

          WHERE room_id = ?
            AND hotel_id = ?
        `,
        [
          room.roomNo,
          room.roomType,
          room.floor,
          room.capacity,
          room.maxExtraBeds,
          room.price,
          room.status,
          roomId,
          hotelId,
        ]
      );

    if (
      result.affectedRows === 0
    ) {
      return sendError(
        res,
        404,
        "ROOM_NOT_FOUND",
        "The room was not found in your hotel."
      );
    }

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Room updated successfully.",
      });
  } catch (error) {
    logRoomError(
      "UPDATE_ROOM",
      error
    );

    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return sendError(
        res,
        409,
        "ROOM_NUMBER_EXISTS",
        "This room number already exists in your hotel."
      );
    }

    return sendError(
      res,
      500,
      "ROOM_UPDATE_FAILED",
      "The room could not be updated. Please try again."
    );
  }
};

/* ============================================================
   DELETE ROOM
============================================================ */

exports.deleteRoom = async (
  req,
  res
) => {
  const hotelId = getHotelId(req);

  const roomId = parseRoomId(
    req.params.id
  );

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  if (!roomId) {
    return sendError(
      res,
      400,
      "INVALID_ROOM_ID",
      "The room ID is invalid."
    );
  }

  try {
    const [result] =
      await db.query(
        `
          DELETE FROM rooms

          WHERE room_id = ?
            AND hotel_id = ?
        `,
        [
          roomId,
          hotelId,
        ]
      );

    if (
      result.affectedRows === 0
    ) {
      return sendError(
        res,
        404,
        "ROOM_NOT_FOUND",
        "The room was not found in your hotel."
      );
    }

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Room deleted successfully.",
      });
  } catch (error) {
    logRoomError(
      "DELETE_ROOM",
      error
    );

    if (
      error?.code ===
        "ER_ROW_IS_REFERENCED_2" ||
      error?.code ===
        "ER_ROW_IS_REFERENCED"
    ) {
      return sendError(
        res,
        409,
        "ROOM_IN_USE",
        "This room cannot be deleted because it is already linked to hotel records. Change its status instead."
      );
    }

    return sendError(
      res,
      500,
      "ROOM_DELETE_FAILED",
      "The room could not be deleted. Please try again."
    );
  }
};

/* ============================================================
   GET AVAILABLE ROOMS

   GET:
   /api/rooms/available?checkIn=...&checkOut=...

   checkOut is kept optional for backward compatibility.
 
  Current Booking Desk normally sends both checkIn
  and checkOut.
============================================================ */

exports.getAvailableRooms = async (
  req,
  res
) => {
  const hotelId = getHotelId(req);

  if (!hotelId) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your Admin account is not linked to a valid hotel."
    );
  }

  const checkIn = String(
    req.query.checkIn || ""
  ).trim();

  const checkOut = String(
    req.query.checkOut || ""
  ).trim();

  if (!checkIn) {
    return sendError(
      res,
      400,
      "CHECK_IN_REQUIRED",
      "checkIn query parameter is required."
    );
  }

  if (!isValidDateValue(checkIn)) {
    return sendError(
      res,
      400,
      "INVALID_CHECK_IN",
      "checkIn must contain a valid date or date-time."
    );
  }

  if (
    checkOut &&
    !isValidDateValue(checkOut)
  ) {
    return sendError(
      res,
      400,
      "INVALID_CHECK_OUT",
      "checkOut must contain a valid date or date-time."
    );
  }

  if (
    checkOut &&
    compareDateValues(
      checkOut,
      checkIn
    ) <= 0
  ) {
    return sendError(
      res,
      400,
      "INVALID_STAY_DATES",
      "checkOut must be later than checkIn."
    );
  }

  let excludeBookingId = 0;

  if (
    req.query.excludeBookingId !==
      undefined &&
    req.query.excludeBookingId !==
      null &&
    String(
      req.query.excludeBookingId
    ).trim() !== ""
  ) {
    excludeBookingId =
      parsePositiveInteger(
        req.query.excludeBookingId
      );

    if (!excludeBookingId) {
      return sendError(
        res,
        400,
        "INVALID_EXCLUDED_BOOKING_ID",
        "excludeBookingId must be a valid positive integer."
      );
    }
  }

  try {
    let query;
    let params;


    if (checkOut) {
      /*
      * booking_room_history is the authoritative
      * room-assignment timeline.
      *
      * The second NOT EXISTS is only a safety fallback
      * for legacy bookings that do not have room history.
      */
      query = `
        SELECT
          r.room_id,
          r.room_number,
          r.room_type,
          r.floor_number,
          r.price_per_night,
          r.capacity,
          r.max_extra_beds,
          r.status,
          r.created_at

        FROM rooms r

        WHERE r.hotel_id = ?
          AND r.status <> 'maintenance'


          /* --------------------------------------------
            AUTHORITATIVE ROOM HISTORY
          --------------------------------------------- */

          AND NOT EXISTS (
            SELECT 1

            FROM booking_room_history h

            INNER JOIN bookings b
              ON b.hotel_id =
                h.hotel_id

            AND b.booking_id =
                h.booking_id

            WHERE h.hotel_id = ?
              AND h.room_id =
                  r.room_id

              AND b.booking_status <>
                  'cancelled'

              AND h.assignment_status <>
                  'cancelled'

              AND b.booking_id <> ?

              AND h.assignment_start < ?
              AND h.assignment_end > ?
          )


          /* --------------------------------------------
            LEGACY FALLBACK

            Only bookings without any room-history row
            are checked here.
          --------------------------------------------- */

          AND NOT EXISTS (
            SELECT 1

            FROM bookings b

            WHERE b.hotel_id = ?
              AND b.room_id =
                  r.room_id

              AND b.booking_status <>
                  'cancelled'

              AND b.booking_id <> ?

              AND b.check_in < ?
              AND b.check_out > ?

              AND NOT EXISTS (
                SELECT 1

                FROM booking_room_history h

                WHERE h.hotel_id =
                      b.hotel_id

                  AND h.booking_id =
                      b.booking_id
              )
          )

        ORDER BY
          r.room_number ASC
      `;


      params = [
        hotelId,

        /* room history */
        hotelId,
        excludeBookingId,
        checkOut,
        checkIn,

        /* legacy fallback */
        hotelId,
        excludeBookingId,
        checkOut,
        checkIn,
      ];
    } else {
      /*
      * Compatibility mode:
      * when check-out is not supplied, any assignment
      * ending after the requested check-in blocks the room.
      */
      query = `
        SELECT
          r.room_id,
          r.room_number,
          r.room_type,
          r.floor_number,
          r.price_per_night,
          r.capacity,
          r.max_extra_beds,
          r.status,
          r.created_at

        FROM rooms r

        WHERE r.hotel_id = ?
          AND r.status <> 'maintenance'


          /* --------------------------------------------
            AUTHORITATIVE ROOM HISTORY
          --------------------------------------------- */

          AND NOT EXISTS (
            SELECT 1

            FROM booking_room_history h

            INNER JOIN bookings b
              ON b.hotel_id =
                h.hotel_id

            AND b.booking_id =
                h.booking_id

            WHERE h.hotel_id = ?
              AND h.room_id =
                  r.room_id

              AND b.booking_status <>
                  'cancelled'

              AND h.assignment_status <>
                  'cancelled'

              AND b.booking_id <> ?

              AND h.assignment_end > ?
          )


          /* --------------------------------------------
            LEGACY FALLBACK
          --------------------------------------------- */

          AND NOT EXISTS (
            SELECT 1

            FROM bookings b

            WHERE b.hotel_id = ?
              AND b.room_id =
                  r.room_id

              AND b.booking_status <>
                  'cancelled'

              AND b.booking_id <> ?

              AND b.check_out > ?

              AND NOT EXISTS (
                SELECT 1

                FROM booking_room_history h

                WHERE h.hotel_id =
                      b.hotel_id

                  AND h.booking_id =
                      b.booking_id
              )
          )

        ORDER BY
          r.room_number ASC
      `;


      params = [
        hotelId,

        /* room history */
        hotelId,
        excludeBookingId,
        checkIn,

        /* legacy fallback */
        hotelId,
        excludeBookingId,
        checkIn,
      ];
    }


    const [rooms] =
      await db.query(
        query,
        params
      );

    return res
      .status(200)
      .json({
        success: true,
        data: rooms,
      });
  } catch (error) {
    logRoomError(
      "GET_AVAILABLE_ROOMS",
      error
    );

    return sendError(
      res,
      500,
      "AVAILABLE_ROOMS_FETCH_FAILED",
      "Available rooms could not be loaded. Please try again."
    );
  }
};