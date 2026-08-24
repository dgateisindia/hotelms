/* ============================================================
   BOOKING ROOM SERVICE

   Purpose:
   - Lock selected hotel rooms
   - Validate room capacity / operational availability
   - Prevent double booking
   - Maintain booking room assignment history

   Important:
   Every function receives the active transaction connection.
============================================================ */


/* ============================================================
   SERVICE ERROR
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


/* ============================================================
   LOAD ROOMS FOR BOOKING

   forUpdate = true
   → final booking/edit transaction
   → room rows are locked

   forUpdate = false
   → pricing preview only
   → no unnecessary database row locks
============================================================ */

async function loadRooms(
  connection,
  hotelId,
  items,
  {
    forUpdate = false,
  } = {}
) {
  const roomIds = [
    ...new Set(
      (
        Array.isArray(items)
          ? items
          : []
      ).map(
        (item) =>
          Number(
            item?.roomId
          )
      )
    ),
  ]
    .filter(
      (roomId) =>
        Number.isSafeInteger(
          roomId
        ) &&
        roomId > 0
    )
    .sort(
      (a, b) =>
        a - b
    );


  if (!roomIds.length) {
    throwHttp(
      400,
      "ROOM_SELECTION_REQUIRED",
      "At least one valid room is required."
    );
  }


  const placeholders =
    roomIds
      .map(() => "?")
      .join(", ");


  const [rooms] =
    await connection.query(
      `
        SELECT
          room_id,
          room_number,
          room_type,
          floor_number,
          capacity,
          status,
          price_per_night

        FROM rooms

        WHERE hotel_id = ?
          AND room_id IN (${placeholders})

        ORDER BY room_id ASC

        ${
          forUpdate
            ? "FOR UPDATE"
            : ""
        }
      `,
      [
        hotelId,
        ...roomIds,
      ]
    );


  if (
    rooms.length !==
    roomIds.length
  ) {
    throwHttp(
      404,
      "ROOM_NOT_FOUND",
      "One or more selected rooms were not found in this hotel."
    );
  }


  const roomMap =
    new Map(
      rooms.map(
        (room) => [
          Number(
            room.room_id
          ),
          room,
        ]
      )
    );


  for (
    const item of
      items
  ) {
    const room =
      roomMap.get(
        Number(
          item.roomId
        )
      );


    if (!room) {
      throwHttp(
        404,
        "ROOM_NOT_FOUND",
        "The selected room was not found in this hotel."
      );
    }


    if (
      room.status ===
      "maintenance"
    ) {
      throwHttp(
        409,
        "ROOM_UNAVAILABLE",
        `Room ${room.room_number} is under maintenance and cannot be booked.`
      );
    }


    if (
      Number(
        item.totalGuests
      ) >
      Number(
        room.capacity
      )
    ) {
      throwHttp(
        400,
        "ROOM_CAPACITY_EXCEEDED",
        `Room ${room.room_number} allows a maximum of ${room.capacity} guest(s).`
      );
    }
  }


  return roomMap;
}


/* ============================================================
   FINAL TRANSACTION ROOM LOCK
============================================================ */

async function lockRooms(
  connection,
  hotelId,
  items
) {
  return loadRooms(
    connection,
    hotelId,
    items,
    {
      forUpdate: true,
    }
  );
}


/* ============================================================
   READ-ONLY ROOM DATA FOR PRICING PREVIEW
============================================================ */

async function getRoomsForPricing(
  connection,
  hotelId,
  items
) {
  return loadRooms(
    connection,
    hotelId,
    items,
    {
      forUpdate: false,
    }
  );
}


/* ============================================================
   PREVENT DOUBLE BOOKING

   booking_room_history is authoritative.

   bookings.room_id is checked only as a fallback for
   legacy bookings without room-history rows.
============================================================ */

async function ensureNoOverlap(
  connection,
  hotelId,
  items,
  excludeBookingId = null
) {
  for (
    const item of items
  ) {
    const historyParams = [
      hotelId,
      item.roomId,
      item.checkOut,
      item.checkIn,
    ];


    let historyExclude =
      "";


    if (
      excludeBookingId
    ) {
      historyExclude =
        "AND b.booking_id <> ?";

      historyParams.push(
        excludeBookingId
      );
    }


    const [historyConflicts] =
      await connection.query(
        `
          SELECT
            b.booking_id

          FROM booking_room_history h

          INNER JOIN bookings b
            ON b.hotel_id =
              h.hotel_id

           AND b.booking_id =
              h.booking_id

          WHERE h.hotel_id = ?
            AND h.room_id = ?

            AND b.booking_status <>
              'cancelled'

            AND h.assignment_status <>
              'cancelled'

            AND h.assignment_start < ?
            AND h.assignment_end > ?

            ${historyExclude}

          LIMIT 1

          FOR UPDATE
        `,
        historyParams
      );


    if (
      historyConflicts.length
    ) {
      throwHttp(
        409,
        "ROOM_BOOKING_CONFLICT",
        "Room is not available for the selected dates."
      );
    }


    /*
     * Legacy safety fallback.
     *
     * Only bookings without any booking_room_history
     * row are checked here.
     */
    const legacyParams = [
      hotelId,
      item.roomId,
      item.checkOut,
      item.checkIn,
    ];


    let legacyExclude =
      "";


    if (
      excludeBookingId
    ) {
      legacyExclude =
        "AND b.booking_id <> ?";

      legacyParams.push(
        excludeBookingId
      );
    }


    const [legacyConflicts] =
      await connection.query(
        `
          SELECT
            b.booking_id

          FROM bookings b

          WHERE b.hotel_id = ?
            AND b.room_id = ?

            AND b.booking_status <>
              'cancelled'

            AND b.check_in < ?
            AND b.check_out > ?

            ${legacyExclude}

            AND NOT EXISTS (
              SELECT 1

              FROM booking_room_history h

              WHERE h.hotel_id =
                    b.hotel_id

                AND h.booking_id =
                    b.booking_id
            )

          LIMIT 1

          FOR UPDATE
        `,
        legacyParams
      );


    if (
      legacyConflicts.length
    ) {
      throwHttp(
        409,
        "ROOM_BOOKING_CONFLICT",
        "Room is not available for the selected dates."
      );
    }
  }
}


/* ============================================================
   INITIAL ROOM ASSIGNMENT HISTORY
============================================================ */

async function createInitialRoomHistory(
  connection,
  {
    hotelId,
    bookingId,
    roomId,
    checkIn,
    checkOut,
    ratePerNight,
    adminId,
  }
) {
  await connection.query(
    `
      INSERT INTO booking_room_history (
        hotel_id,
        booking_id,
        room_id,
        assignment_start,
        assignment_end,
        assignment_status,
        rate_per_night,
        change_reason,
        notes,
        changed_by_admin_id
      )

      VALUES (
        ?, ?, ?, ?, ?,
        'planned',
        ?,
        'initial_booking',
        'Initial room assignment',
        ?
      )
    `,
    [
      hotelId,
      bookingId,
      roomId,
      checkIn,
      checkOut,
      ratePerNight,
      adminId,
    ]
  );
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  lockRooms,

  getRoomsForPricing,

  ensureNoOverlap,

  createInitialRoomHistory,
};