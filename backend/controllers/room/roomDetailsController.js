const db = require("../../config/db").promisePool;

const {
  getRoomFinancialAttribution,
} = require("../../services/room/roomFinancialAttributionService");

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

function logRoomDetailsError(
  operation,
  error
) {
  console.error(
    `[ROOM_DETAILS:${operation}] ${
      error?.code || "UNKNOWN_ERROR"
    }: ${
      error?.message ||
      "Unknown room details error"
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
   VALIDATION
============================================================ */

function parseRoomId(value) {
  const roomId = Number(value);

  if (
    !Number.isSafeInteger(roomId) ||
    roomId <= 0
  ) {
    return null;
  }

  return roomId;
}

/* ============================================================
   RESPONSE MAPPERS
============================================================ */

function mapBookingAssignment(row) {
  if (!row) {
    return null;
  }

  return {
    roomHistoryId: Number(
      row.room_history_id
    ),

    bookingId: Number(
      row.booking_id
    ),

    reservationGroupId: Number(
      row.reservation_group_id
    ),

    bookingCode:
      row.booking_code || "",

    bookingSource:
      row.booking_source || "",

    stayType:
      row.stay_type || "",

    bookingStatus:
      row.booking_status || "",

    paymentStatus:
      row.payment_status || "",

    assignmentStatus:
      row.assignment_status || "",

    assignmentStart:
      row.assignment_start || null,

    assignmentEnd:
      row.assignment_end || null,

    ratePerNight:
      Number(
        row.rate_per_night || 0
      ),

    changeReason:
      row.change_reason || null,

    notes:
      row.notes || null,

    scheduledCheckIn:
      row.check_in || null,

    scheduledCheckOut:
      row.check_out || null,

    actualCheckIn:
      row.actual_check_in || null,

    actualCheckOut:
      row.actual_check_out || null,

    customer: {
      customerId:
        row.customer_id === null
          ? null
          : Number(
              row.customer_id
            ),

      fullName:
        row.customer_name || "",

      phone:
        row.customer_phone || "",

      email:
        row.customer_email || "",
    },

    assignmentScheduleExpired:
      Boolean(
        Number(
          row.assignment_schedule_expired ||
            0
        )
      ),

    plannedStartPassed:
      Boolean(
        Number(
          row.planned_start_passed ||
            0
        )
      ),
  };
}

/* ============================================================
   GET ROOM DETAILS

   GET /api/rooms/:id/details

   Important:
   - hotel_id always comes from authenticated DB user.
   - booking_room_history is the canonical room timeline.
   - room financial attribution is calculated by the dedicated
     roomFinancialAttributionService.
============================================================ */

exports.getRoomDetails = async (
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
    /* ========================================================
       ROOM PROFILE
    ======================================================== */

    const [roomRows] =
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
            AND room_id = ?

          LIMIT 1
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const room = roomRows[0];

    if (!room) {
      return sendError(
        res,
        404,
        "ROOM_NOT_FOUND",
        "The room was not found in your hotel."
      );
    }

    /* ========================================================
       CURRENT ACTIVE ASSIGNMENT

       Current operational assignment means:
       - room history says active
       - booking itself is checked in
       - booking has not actually checked out

       We do NOT discard an assignment only because its planned
       assignment_end is in the past. Instead we return an
       integrity warning so stale lifecycle data is visible.
    ======================================================== */

    const [currentRows] =
      await db.query(
        `
          SELECT
            h.room_history_id,
            h.booking_id,
            h.assignment_status,
            h.assignment_start,
            h.assignment_end,
            h.rate_per_night,
            h.change_reason,
            h.notes,

            b.reservation_group_id,
            b.booking_code,
            b.booking_source,
            b.stay_type,
            b.booking_status,
            b.payment_status,
            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,
            b.customer_id,

            c.full_name
              AS customer_name,

            c.phone
              AS customer_phone,

            c.email
              AS customer_email,

            CASE
              WHEN h.assignment_end <= NOW()
              THEN 1
              ELSE 0
            END
              AS assignment_schedule_expired,

            0
              AS planned_start_passed

          FROM booking_room_history h

          INNER JOIN bookings b
            ON b.hotel_id =
                 h.hotel_id

           AND b.booking_id =
                 h.booking_id

          LEFT JOIN customers c
            ON c.hotel_id =
                 b.hotel_id

           AND c.customer_id =
                 b.customer_id

          WHERE h.hotel_id = ?
            AND h.room_id = ?

            AND h.assignment_status =
                'active'

            AND b.booking_status =
                'checked_in'

            AND b.actual_check_out
                IS NULL

          ORDER BY
            h.assignment_start DESC,
            h.room_history_id DESC

          LIMIT 1
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const currentBooking =
      mapBookingAssignment(
        currentRows[0]
      );

    /* ========================================================
       NEXT PLANNED ASSIGNMENT

       Cancelled / checked-out / no-show bookings are not future
       reservations.

       A planned assignment whose start time already passed can
       still represent a late-arrival situation, so it is
       returned with plannedStartPassed=true instead of being
       hidden.
    ======================================================== */

    const [nextRows] =
      await db.query(
        `
          SELECT
            h.room_history_id,
            h.booking_id,
            h.assignment_status,
            h.assignment_start,
            h.assignment_end,
            h.rate_per_night,
            h.change_reason,
            h.notes,

            b.reservation_group_id,
            b.booking_code,
            b.booking_source,
            b.stay_type,
            b.booking_status,
            b.payment_status,
            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,
            b.customer_id,

            c.full_name
              AS customer_name,

            c.phone
              AS customer_phone,

            c.email
              AS customer_email,

            0
              AS assignment_schedule_expired,

            CASE
              WHEN h.assignment_start < NOW()
              THEN 1
              ELSE 0
            END
              AS planned_start_passed

          FROM booking_room_history h

          INNER JOIN bookings b
            ON b.hotel_id =
                 h.hotel_id

           AND b.booking_id =
                 h.booking_id

          LEFT JOIN customers c
            ON c.hotel_id =
                 b.hotel_id

           AND c.customer_id =
                 b.customer_id

          WHERE h.hotel_id = ?
            AND h.room_id = ?

            AND h.assignment_status =
                'planned'

            AND b.booking_status IN (
              'pending',
              'confirmed'
            )

            AND h.assignment_end > NOW()

          ORDER BY
            h.assignment_start ASC,
            h.room_history_id ASC

          LIMIT 1
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const nextBooking =
      mapBookingAssignment(
        nextRows[0]
      );

    /* ========================================================
       COMPLETE CANONICAL ROOM HISTORY
    ======================================================== */

    const [historyRows] =
      await db.query(
        `
          SELECT
            h.room_history_id,
            h.booking_id,
            h.assignment_status,
            h.assignment_start,
            h.assignment_end,
            h.rate_per_night,
            h.change_reason,
            h.notes,

            b.reservation_group_id,
            b.booking_code,
            b.booking_source,
            b.stay_type,
            b.booking_status,
            b.payment_status,
            b.check_in,
            b.check_out,
            b.actual_check_in,
            b.actual_check_out,
            b.customer_id,

            c.full_name
              AS customer_name,

            c.phone
              AS customer_phone,

            c.email
              AS customer_email,

            CASE
              WHEN
                h.assignment_status = 'active'
                AND h.assignment_end <= NOW()
              THEN 1
              ELSE 0
            END
              AS assignment_schedule_expired,

            CASE
              WHEN
                h.assignment_status = 'planned'
                AND h.assignment_start < NOW()
              THEN 1
              ELSE 0
            END
              AS planned_start_passed

          FROM booking_room_history h

          INNER JOIN bookings b
            ON b.hotel_id =
                 h.hotel_id

           AND b.booking_id =
                 h.booking_id

          LEFT JOIN customers c
            ON c.hotel_id =
                 b.hotel_id

           AND c.customer_id =
                 b.customer_id

          WHERE h.hotel_id = ?
            AND h.room_id = ?

          ORDER BY
            h.assignment_start DESC,
            h.room_history_id DESC
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const history =
      historyRows.map(
        mapBookingAssignment
      );

    /* ========================================================
       ROOM STATISTICS

       Definitions:
       - lifetimeBookings:
         every distinct booking ever assigned to the room,
         including cancelled / no-show reservations.

       - stayedBookings:
         distinct bookings with an active or completed physical
         room assignment.

       - totalNights:
         actual canonical room-assignment duration / 24 hours.
         Room-change segments can therefore be fractional.

       - uniqueGuests:
         guests whose recorded guest stay overlaps an active or
         completed assignment for this physical room.

       - averageStayNights:
         totalNights / stayedBookings.

       Active assignments are capped at assignment_end when that
       scheduled end is already in the past. This prevents stale
       lifecycle rows from generating artificial extra nights.
    ======================================================== */

    const [statsRows] =
      await db.query(
        `
          SELECT
            COUNT(
              DISTINCT h.booking_id
            ) AS lifetime_bookings,

            COUNT(
              DISTINCT CASE
                WHEN h.assignment_status
                     IN (
                       'active',
                       'completed'
                     )
                THEN h.booking_id
                ELSE NULL
              END
            ) AS stayed_bookings,

            ROUND(
              COALESCE(
                SUM(
                  CASE
                    WHEN h.assignment_status
                         IN (
                           'active',
                           'completed'
                         )
                    THEN
                      GREATEST(
                        TIMESTAMPDIFF(
                          SECOND,

                          h.assignment_start,

                          CASE
                            WHEN h.assignment_status =
                                 'active'
                            THEN LEAST(
                              NOW(),
                              h.assignment_end
                            )

                            ELSE h.assignment_end
                          END
                        ),
                        0
                      )

                    ELSE 0
                  END
                ),
                0
              ) / 86400,
              2
            ) AS total_nights,

            COUNT(
              DISTINCT CASE
                WHEN b.booking_status =
                     'cancelled'
                THEN b.booking_id
                ELSE NULL
              END
            ) AS cancellations,

            COUNT(
              DISTINCT CASE
                WHEN b.booking_status =
                     'no_show'
                THEN b.booking_id
                ELSE NULL
              END
            ) AS no_shows

          FROM booking_room_history h

          INNER JOIN bookings b
            ON b.hotel_id =
                 h.hotel_id

           AND b.booking_id =
                 h.booking_id

          WHERE h.hotel_id = ?
            AND h.room_id = ?
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const [guestStatsRows] =
      await db.query(
        `
          SELECT
            COUNT(
              DISTINCT
              CASE
                WHEN bg.customer_id
                     IS NOT NULL
                THEN CONCAT(
                  'CUSTOMER:',
                  bg.customer_id
                )

                ELSE CONCAT(
                  'BOOKING_GUEST:',
                  bg.booking_guest_id
                )
              END
            ) AS unique_guests

          FROM booking_guests bg

          INNER JOIN booking_guest_stays gs
            ON gs.hotel_id =
                 bg.hotel_id

           AND gs.booking_guest_id =
                 bg.booking_guest_id

          WHERE bg.hotel_id = ?

            AND bg.guest_status <>
                'cancelled'

            AND EXISTS (
              SELECT 1

              FROM booking_room_history h

              WHERE h.hotel_id =
                    bg.hotel_id

                AND h.booking_id =
                    bg.booking_id

                AND h.room_id = ?

                AND h.assignment_status
                    IN (
                      'active',
                      'completed'
                    )

                AND gs.check_in_at <
                    CASE
                      WHEN h.assignment_status =
                           'active'
                      THEN LEAST(
                        NOW(),
                        h.assignment_end
                      )

                      ELSE h.assignment_end
                    END

                AND COALESCE(
                      gs.check_out_at,
                      NOW()
                    ) >
                    h.assignment_start
            )
        `,
        [
          hotelId,
          roomId,
        ]
      );

    const rawStats =
      statsRows[0] || {};

    const lifetimeBookings =
      Number(
        rawStats.lifetime_bookings ||
          0
      );

    const stayedBookings =
      Number(
        rawStats.stayed_bookings ||
          0
      );

    const totalNights =
      Number(
        rawStats.total_nights ||
          0
      );

    const stats = {
      lifetimeBookings,

      stayedBookings,

      totalNights,

      averageStayNights:
        stayedBookings > 0
          ? Number(
              (
                totalNights /
                stayedBookings
              ).toFixed(2)
            )
          : 0,

      uniqueGuests:
        Number(
          guestStatsRows[0]
            ?.unique_guests ||
            0
        ),

      cancellations:
        Number(
          rawStats.cancellations ||
            0
        ),

      noShows:
        Number(
          rawStats.no_shows ||
            0
        ),
    };
    /* ========================================================
       ROOM FINANCIAL ATTRIBUTION

       Financial calculations are isolated in the dedicated
       room service. The controller does not duplicate billing
       or allocation rules.
    ======================================================== */

    const financials =
      await getRoomFinancialAttribution(
        hotelId,
        roomId
      );
    /* ========================================================
       DATA INTEGRITY WARNINGS

       These warnings do not mutate data.
       They expose inconsistent lifecycle state so an Admin
       does not receive a misleading Room Details screen.
    ======================================================== */

    const integrityWarnings = [];

    if (
      currentBooking &&
      currentBooking
        .assignmentScheduleExpired
    ) {
      integrityWarnings.push({
        code:
          "ACTIVE_ASSIGNMENT_END_PASSED",

        severity:
          "warning",

        message:
          `Room ${room.room_number} has an active checked-in booking, but its room assignment end time has already passed.`,

        bookingId:
          currentBooking.bookingId,

        bookingCode:
          currentBooking.bookingCode,
      });
    }

    if (
      currentBooking &&
      room.status !== "occupied"
    ) {
      integrityWarnings.push({
        code:
          "ROOM_STATUS_ACTIVE_BOOKING_MISMATCH",

        severity:
          "warning",

        message:
          `Room ${room.room_number} has an active checked-in booking but its room status is "${room.status}".`,

        bookingId:
          currentBooking.bookingId,

        bookingCode:
          currentBooking.bookingCode,
      });
    }

    if (
      !currentBooking &&
      room.status === "occupied"
    ) {
      integrityWarnings.push({
        code:
          "OCCUPIED_WITHOUT_ACTIVE_ASSIGNMENT",

        severity:
          "warning",

        message:
          `Room ${room.room_number} is marked occupied but no active checked-in room assignment was found.`,
      });
    }

    if (
      nextBooking &&
      nextBooking.plannedStartPassed
    ) {
      integrityWarnings.push({
        code:
          "PLANNED_ASSIGNMENT_START_PASSED",

        severity:
          "warning",

        message:
          `The next planned booking for Room ${room.room_number} has a planned start time that has already passed.`,

        bookingId:
          nextBooking.bookingId,

        bookingCode:
          nextBooking.bookingCode,
      });
    }

    /* ========================================================
       RESPONSE
    ======================================================== */

    return res
      .status(200)
      .json({
        success: true,

        data: {
          profile: {
            roomId: Number(
              room.room_id
            ),

            roomNumber:
              room.room_number,

            roomType:
              room.room_type,

            floor:
              room.floor_number ===
              null
                ? null
                : Number(
                    room.floor_number
                  ),

            pricePerNight:
              Number(
                room.price_per_night ||
                  0
              ),

            capacity:
              Number(
                room.capacity || 0
              ),

            maxExtraBeds:
              Number(
                room.max_extra_beds ||
                  0
              ),

            status:
              room.status,

            createdAt:
              room.created_at || null,
          },

          currentBooking,

          nextBooking,

          history,

          stats,

          integrityWarnings,

          financials,
        },
      });
  } catch (error) {
    logRoomDetailsError(
      "GET_ROOM_DETAILS",
      error
    );

    return sendError(
      res,
      500,
      "ROOM_DETAILS_FETCH_FAILED",
      "Room details could not be loaded. Please try again."
    );
  }
};