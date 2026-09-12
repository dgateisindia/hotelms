const db = require("../config/db").promisePool;

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

function logDashboardError(operation, error) {
  console.error(
    `[DASHBOARD:${operation}] ${error.code || "UNKNOWN_ERROR"}: ${
      error.message || "Unknown dashboard error"
    }`
  );
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toSqlDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/*
 * GET /api/dashboard/super-admin-stats
 *
 * A Super Admin can see data only from hotels created by that
 * Super Admin.
 */
const getSuperAdminStats = async (req, res) => {
  const superadminId = req.dbUser?.superadminId;

  if (!superadminId) {
    return sendError(
      res,
      403,
      "SUPER_ADMIN_CONTEXT_MISSING",
      "Your Super Admin account could not be identified. Please sign in again."
    );
  }

  try {
    const [[bookingsRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM bookings b
        INNER JOIN hotels h
          ON h.hotel_id = b.hotel_id
        WHERE h.superadmin_id = ?
      `,
      [superadminId]
    );

    const [[roomsRow]] = await db.query(
      `
        SELECT
          SUM(
            CASE
              WHEN r.status = 'occupied' THEN 1
              ELSE 0
            END
          ) AS occupied,

          SUM(
            CASE
              WHEN r.status = 'available' THEN 1
              ELSE 0
            END
          ) AS available

        FROM rooms r

        INNER JOIN hotels h
          ON h.hotel_id = r.hotel_id

        WHERE h.superadmin_id = ?
      `,
      [superadminId]
    );

    const [[revenueRow]] = await db.query(
      `
        SELECT COALESCE(SUM(CASE
          WHEN p.transaction_type='payment' THEN p.amount
          WHEN p.transaction_type='refund' THEN -p.amount
          ELSE 0
        END),0) AS revenue

        FROM payments p

        INNER JOIN hotels h
          ON h.hotel_id = p.hotel_id

        WHERE h.superadmin_id = ?
          AND p.payment_status = 'success'
          AND DATE(p.payment_date) = CURDATE()
      `,
      [superadminId]
    );

    const [monthlyRevenue] = await db.query(
      `
        SELECT
          YEAR(p.payment_date) AS year,
          MONTH(p.payment_date) AS month,
          COALESCE(SUM(CASE
            WHEN p.transaction_type='payment' THEN p.amount
            WHEN p.transaction_type='refund' THEN -p.amount
            ELSE 0
          END),0) AS total

        FROM payments p

        INNER JOIN hotels h
          ON h.hotel_id = p.hotel_id

        WHERE h.superadmin_id = ?
          AND p.payment_status = 'success'
          AND p.payment_date >= DATE_SUB(
            CURDATE(),
            INTERVAL 7 MONTH
          )

        GROUP BY
          YEAR(p.payment_date),
          MONTH(p.payment_date)

        ORDER BY
          YEAR(p.payment_date),
          MONTH(p.payment_date)
      `,
      [superadminId]
    );

    return res.status(200).json({
      success: true,

      stats: {
        totalBookings: Number(bookingsRow.total || 0),
        occupiedRooms: Number(roomsRow.occupied || 0),
        availableRooms: Number(roomsRow.available || 0),
        todaysRevenue: Number(revenueRow.revenue || 0),
        monthlyRevenue,
      },
    });
  } catch (error) {
    logDashboardError("GET_SUPER_ADMIN_STATS", error);

    return sendError(
      res,
      500,
      "DASHBOARD_STATS_FETCH_FAILED",
      "Super Admin dashboard statistics could not be loaded. Please try again."
    );
  }
};

/*
 * GET /api/dashboard/admins-status
 *
 * Returns only Admins created under hotels owned by the
 * authenticated Super Admin.
 */
const getAdminsStatus = async (req, res) => {
  const superadminId = req.dbUser?.superadminId;

  if (!superadminId) {
    return sendError(
      res,
      403,
      "SUPER_ADMIN_CONTEXT_MISSING",
      "Your Super Admin account could not be identified. Please sign in again."
    );
  }

  try {
    const [admins] = await db.query(
      `
        SELECT
          a.admin_id AS id,

          CONCAT(
            'ADM-',
            LPAD(a.admin_id, 4, '0')
          ) AS display_id,

          a.full_name AS name,
          a.email,
          a.role,
          a.status,

          NULL AS last_login,

          a.hotel_id,

          CONCAT(
            'HT-',
            LPAD(a.hotel_id, 4, '0')
          ) AS hotel_display_id,

          h.hotel_name

        FROM admins a

        INNER JOIN hotels h
          ON h.hotel_id = a.hotel_id
         AND h.superadmin_id = a.superadmin_id

        WHERE a.superadmin_id = ?

        ORDER BY
          a.created_at DESC,
          a.admin_id DESC
      `,
      [superadminId]
    );

    return res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    logDashboardError("GET_ADMINS_STATUS", error);

    return sendError(
      res,
      500,
      "ADMIN_LIST_FETCH_FAILED",
      "Admin accounts could not be loaded. Please try again."
    );
  }
};

/*
 * GET /api/dashboard/admin-daily-stats?date=YYYY-MM-DD
 *
 * An Admin can see operational data only from the hotel
 * attached to that Admin account.
 */

const getAdminDailyStats = async (req, res) => {
  const hotelId = Number(
    req.dbUser?.hotelId
  );

  const selectedDate = String(
    req.query.date || ""
  ).trim();


  /* ==========================================================
     VALIDATION
  ========================================================== */

  if (
    !Number.isSafeInteger(hotelId) ||
    hotelId <= 0
  ) {
    return sendError(
      res,
      403,
      "HOTEL_CONTEXT_MISSING",
      "Your account is not linked to a hotel. Please contact the Super Admin."
    );
  }


  if (!selectedDate) {
    return sendError(
      res,
      400,
      "DASHBOARD_DATE_REQUIRED",
      "Please select a date to load the dashboard statistics."
    );
  }


  if (
    !isValidDateString(
      selectedDate
    )
  ) {
    return sendError(
      res,
      400,
      "INVALID_DASHBOARD_DATE",
      "The selected date is invalid. Use the YYYY-MM-DD format."
    );
  }


  try {

    /* ========================================================
       BOOKING SUMMARY

       totalBookings:
       All bookings of this hotel.

       bookingsForDate:
       Bookings CREATED on selected date.

       arrivalsForDate:
       Non-cancelled bookings scheduled to check in.

       departuresForDate:
       Non-cancelled bookings scheduled to check out.
    ======================================================== */

    const [[bookingSummary]] =
      await db.query(
        `
          SELECT
            COUNT(*) AS total_bookings,

            SUM(
              CASE
                WHEN created_at >= ?
                 AND created_at < DATE_ADD(
                   ?,
                   INTERVAL 1 DAY
                 )
                THEN 1
                ELSE 0
              END
            ) AS bookings_for_date,

            SUM(
              CASE
                WHEN check_in >= ?
                 AND check_in < DATE_ADD(
                   ?,
                   INTERVAL 1 DAY
                 )
                 AND booking_status <> 'cancelled'
                THEN 1
                ELSE 0
              END
            ) AS arrivals_for_date,

            SUM(
              CASE
                WHEN check_out >= ?
                 AND check_out < DATE_ADD(
                   ?,
                   INTERVAL 1 DAY
                 )
                 AND booking_status <> 'cancelled'
                THEN 1
                ELSE 0
              END
            ) AS departures_for_date

          FROM bookings

          WHERE hotel_id = ?
        `,
        [
          selectedDate,
          selectedDate,

          selectedDate,
          selectedDate,

          selectedDate,
          selectedDate,

          hotelId,
        ]
      );


    /* ========================================================
       CURRENT ROOM STATUS
    ======================================================== */

    const [roomStatusRows] =
      await db.query(
        `
          SELECT
            status,
            COUNT(*) AS total

          FROM rooms

          WHERE hotel_id = ?

          GROUP BY status
        `,
        [
          hotelId,
        ]
      );


    const roomStatus = {
      occupied: 0,
      available: 0,
      maintenance: 0,
      cleaning: 0,
    };


    roomStatusRows.forEach(
      (row) => {
        if (
          Object.prototype
            .hasOwnProperty.call(
              roomStatus,
              row.status
            )
        ) {
          roomStatus[
            row.status
          ] = Number(
            row.total || 0
          );
        }
      }
    );


    /* ========================================================
       REVENUE FOR SELECTED DATE
    ======================================================== */

    const [[revenueRow]] =
      await db.query(
        `
          SELECT
            COALESCE(
              SUM(CASE
                WHEN transaction_type='payment' THEN amount
                WHEN transaction_type='refund' THEN -amount
                ELSE 0
              END),
              0
            ) AS revenue

          FROM payments

          WHERE hotel_id = ?
            AND payment_status = 'success'
            AND payment_date >= ?
            AND payment_date < DATE_ADD(
              ?,
              INTERVAL 1 DAY
            )
        `,
        [
          hotelId,
          selectedDate,
          selectedDate,
        ]
      );


    /* ========================================================
       ARRIVALS

       Kept in recentBookings too for temporary compatibility
       with the current old Dashboard.js.
    ======================================================== */

    const [todayArrivals] =
      await db.query(
        `
          SELECT
            b.booking_id,

            CONCAT(
              'BKG-',
              LPAD(
                b.booking_id,
                4,
                '0'
              )
            ) AS display_id,

            b.booking_code,
            DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in,
            DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
            b.booking_status,
            b.payment_status,
            b.total_guests,
            b.total_amount,

            c.full_name
              AS customer_name,

            c.phone
              AS customer_phone,

            r.room_number,
            r.room_type

          FROM bookings b

          INNER JOIN customers c
            ON c.hotel_id =
              b.hotel_id
           AND c.customer_id =
              b.customer_id

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          WHERE b.hotel_id = ?

            AND b.check_in >= ?

            AND b.check_in < DATE_ADD(
              ?,
              INTERVAL 1 DAY
            )

            AND b.booking_status
              <> 'cancelled'

          ORDER BY
            b.check_in ASC,
            b.booking_id DESC
        `,
        [
          hotelId,
          selectedDate,
          selectedDate,
        ]
      );


    /* ========================================================
       DEPARTURES
    ======================================================== */

    const [todayDepartures] =
      await db.query(
        `
          SELECT
            b.booking_id,

            CONCAT(
              'BKG-',
              LPAD(
                b.booking_id,
                4,
                '0'
              )
            ) AS display_id,

            b.booking_code,
            DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in,
            DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
            b.booking_status,
            b.payment_status,
            b.total_guests,
            b.total_amount,

            c.full_name
              AS customer_name,

            c.phone
              AS customer_phone,

            r.room_number,
            r.room_type

          FROM bookings b

          INNER JOIN customers c
            ON c.hotel_id =
              b.hotel_id
           AND c.customer_id =
              b.customer_id

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          WHERE b.hotel_id = ?

            AND b.check_out >= ?

            AND b.check_out < DATE_ADD(
              ?,
              INTERVAL 1 DAY
            )

            AND b.booking_status
              <> 'cancelled'

          ORDER BY
            b.check_out ASC,
            b.booking_id DESC
        `,
        [
          hotelId,
          selectedDate,
          selectedDate,
        ]
      );


    /* ========================================================
       LATEST BOOKINGS

       Actual recently-created bookings, independent of
       selected arrival date.
    ======================================================== */

    const [latestBookings] =
      await db.query(
        `
          SELECT
            b.booking_id,

            CONCAT(
              'BKG-',
              LPAD(
                b.booking_id,
                4,
                '0'
              )
            ) AS display_id,

            b.booking_code,
            DATE_FORMAT(b.check_in,'%Y-%m-%d') AS check_in,
            DATE_FORMAT(b.check_out,'%Y-%m-%d') AS check_out,
            b.booking_status,
            b.payment_status,
            b.total_amount,
            b.created_at,

            c.full_name
              AS customer_name,

            r.room_number

          FROM bookings b

          INNER JOIN customers c
            ON c.hotel_id =
              b.hotel_id
           AND c.customer_id =
              b.customer_id

          INNER JOIN rooms r
            ON r.hotel_id =
              b.hotel_id
           AND r.room_id =
              b.room_id

          WHERE b.hotel_id = ?

          ORDER BY
            b.created_at DESC,
            b.booking_id DESC

          LIMIT 6
        `,
        [
          hotelId,
        ]
      );


    /* ========================================================
       MONTHLY REVENUE
    ======================================================== */

    const [monthlyRevenue] =
      await db.query(
        `
          SELECT
            YEAR(payment_date)
              AS year,

            MONTH(payment_date)
              AS month,

            COALESCE(
              SUM(CASE
                WHEN transaction_type='payment' THEN amount
                WHEN transaction_type='refund' THEN -amount
                ELSE 0
              END),
              0
            ) AS total

          FROM payments

          WHERE hotel_id = ?
            AND payment_status = 'success'
            AND payment_date >= DATE_SUB(
              CURDATE(),
              INTERVAL 7 MONTH
            )

          GROUP BY
            YEAR(payment_date),
            MONTH(payment_date)

          ORDER BY
            YEAR(payment_date),
            MONTH(payment_date)
        `,
        [
          hotelId,
        ]
      );


    /* ========================================================
       MONTHLY BOOKINGS
    ======================================================== */

    const [monthlyBookings] =
      await db.query(
        `
          SELECT
            YEAR(check_in)
              AS year,

            MONTH(check_in)
              AS month,

            COUNT(*)
              AS total

          FROM bookings

          WHERE hotel_id = ?

            AND booking_status
              <> 'cancelled'

            AND check_in >=
              DATE_SUB(
                CURDATE(),
                INTERVAL 7 MONTH
              )

          GROUP BY
            YEAR(check_in),
            MONTH(check_in)

          ORDER BY
            YEAR(check_in),
            MONTH(check_in)
        `,
        [
          hotelId,
        ]
      );


    /* ========================================================
       TOTAL ROOMS
    ======================================================== */

    const [[roomCountRow]] =
      await db.query(
        `
          SELECT
            COUNT(*) AS total

          FROM rooms

          WHERE hotel_id = ?
        `,
        [
          hotelId,
        ]
      );


    const totalRooms =
      Number(
        roomCountRow
          ?.total || 0
      );


    /* ========================================================
       MONTHLY OCCUPANCY

       Room-night occupancy:

       occupied room nights
       --------------------- x 100
       total possible room nights
    ======================================================== */

    const monthlyOccupancy = [];

    const now =
      new Date();


    for (
      let offset = 6;
      offset >= 0;
      offset -= 1
    ) {
      const monthStartDate =
        new Date(
          now.getFullYear(),
          now.getMonth() -
            offset,
          1
        );


      const monthEndDate =
        new Date(
          monthStartDate
            .getFullYear(),

          monthStartDate
            .getMonth() + 1,

          0
        );


      const monthStart =
        toSqlDate(
          monthStartDate
        );


      const monthEnd =
        toSqlDate(
          monthEndDate
        );


      const daysInMonth =
        monthEndDate.getDate();


      const [[occupancyRow]] =
        await db.query(
          `
            SELECT
              COALESCE(
                SUM(
                  GREATEST(
                    DATEDIFF(
                      LEAST(
                        DATE(check_out),
                        DATE_ADD(
                          ?,
                          INTERVAL 1 DAY
                        )
                      ),

                      GREATEST(
                        DATE(check_in),
                        ?
                      )
                    ),
                    0
                  )
                ),
                0
              ) AS occupied_room_nights

            FROM bookings

            WHERE hotel_id = ?

              AND booking_status IN (
                'confirmed',
                'checked_in',
                'checked_out'
              )

              AND check_in <
                DATE_ADD(
                  ?,
                  INTERVAL 1 DAY
                )

              AND check_out > ?
          `,
          [
            monthEnd,
            monthStart,

            hotelId,

            monthEnd,
            monthStart,
          ]
        );


      const occupiedRoomNights =
        Number(
          occupancyRow
            ?.occupied_room_nights ||
          0
        );


      const possibleRoomNights =
        totalRooms *
        daysInMonth;


      const occupancyPercentage =
        possibleRoomNights === 0
          ? 0
          : Math.min(
              100,
              Math.round(
                (
                  occupiedRoomNights /
                  possibleRoomNights
                ) * 100
              )
            );


      monthlyOccupancy.push({
        year:
          monthStartDate
            .getFullYear(),

        month:
          monthStartDate
            .getMonth() + 1,

        total:
          occupancyPercentage,
      });
    }


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res
      .status(200)
      .json({
        success: true,

        stats: {
          selectedDate,

          /* Backward compatible */
          totalBookings:
            Number(
              bookingSummary
                ?.total_bookings ||
              0
            ),

          /* New dashboard KPIs */
          bookingsForDate:
            Number(
              bookingSummary
                ?.bookings_for_date ||
              0
            ),

          arrivalsForDate:
            Number(
              bookingSummary
                ?.arrivals_for_date ||
              0
            ),

          departuresForDate:
            Number(
              bookingSummary
                ?.departures_for_date ||
              0
            ),

          occupiedRooms:
            roomStatus.occupied,

          availableRooms:
            roomStatus.available,

          maintenanceRooms:
            roomStatus.maintenance,

          cleaningRooms:
            roomStatus.cleaning,

          reservedRooms: 0,

          todaysRevenue:
            Number(
              revenueRow
                ?.revenue ||
              0
            ),

          revenueForDate:
            Number(
              revenueRow
                ?.revenue ||
              0
            ),

          roomStatus: {
            occupied:
              roomStatus.occupied,

            available:
              roomStatus.available,

            maintenance:
              roomStatus.maintenance,

            cleaning:
              roomStatus.cleaning,

            total:
              totalRooms,
          },

          monthlyRevenue,
          monthlyBookings,
          monthlyOccupancy,

          /*
           * Temporary compatibility:
           * old Dashboard.js expects recentBookings to contain
           * bookings arriving on selectedDate.
           */
          recentBookings:
            todayArrivals,

          /* New dashboard lists */
          todayArrivals,
          todayDepartures,
          latestBookings,
        },
      });

  } catch (error) {
    logDashboardError(
      "GET_ADMIN_DAILY_STATS",
      error
    );


    return sendError(
      res,
      500,
      "ADMIN_DASHBOARD_FETCH_FAILED",
      "The hotel dashboard data could not be loaded. Please try again."
    );
  }
};


module.exports = {
  getSuperAdminStats,
  getAdminsStatus,
  getAdminDailyStats,
};