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
        SELECT COALESCE(SUM(p.amount), 0) AS revenue

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
          COALESCE(SUM(p.amount), 0) AS total

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
  const hotelId = req.dbUser?.hotelId;
  const selectedDate = String(req.query.date || "").trim();

  if (!hotelId) {
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

  if (!isValidDateString(selectedDate)) {
    return sendError(
      res,
      400,
      "INVALID_DASHBOARD_DATE",
      "The selected date is invalid. Use the YYYY-MM-DD format."
    );
  }

  try {
    const [[bookingsRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM bookings
        WHERE hotel_id = ?
      `,
      [hotelId]
    );

    const [roomStatusRows] = await db.query(
      `
        SELECT
          status,
          COUNT(*) AS total

        FROM rooms

        WHERE hotel_id = ?

        GROUP BY status
      `,
      [hotelId]
    );

    const roomStatus = {
      occupied: 0,
      available: 0,
      maintenance: 0,
      cleaning: 0,
    };

    roomStatusRows.forEach((row) => {
      if (
        Object.prototype.hasOwnProperty.call(
          roomStatus,
          row.status
        )
      ) {
        roomStatus[row.status] = Number(row.total || 0);
      }
    });

    const [[revenueRow]] = await db.query(
      `
        SELECT COALESCE(SUM(amount), 0) AS revenue

        FROM payments

        WHERE hotel_id = ?
          AND payment_status = 'success'
          AND DATE(payment_date) = ?
      `,
      [hotelId, selectedDate]
    );

    const [recentBookings] = await db.query(
      `
        SELECT
          b.booking_id,

          CONCAT(
            'BKG-',
            LPAD(b.booking_id, 4, '0')
          ) AS display_id,

          b.booking_code,
          b.check_in,
          b.check_out,
          b.booking_status,

          c.full_name AS customer_name,
          r.room_number

        FROM bookings b

        INNER JOIN customers c
          ON c.hotel_id = b.hotel_id
         AND c.customer_id = b.customer_id

        INNER JOIN rooms r
          ON r.hotel_id = b.hotel_id
         AND r.room_id = b.room_id

        WHERE b.hotel_id = ?
          AND DATE(b.check_in) = ?

        ORDER BY
          b.check_in ASC,
          b.booking_id DESC
      `,
      [hotelId, selectedDate]
    );

    const [monthlyRevenue] = await db.query(
      `
        SELECT
          YEAR(payment_date) AS year,
          MONTH(payment_date) AS month,
          COALESCE(SUM(amount), 0) AS total

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
      [hotelId]
    );

    const [monthlyBookings] = await db.query(
      `
        SELECT
          YEAR(check_in) AS year,
          MONTH(check_in) AS month,
          COUNT(*) AS total

        FROM bookings

        WHERE hotel_id = ?
          AND check_in >= DATE_SUB(
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
      [hotelId]
    );

    const [[roomCountRow]] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM rooms
        WHERE hotel_id = ?
      `,
      [hotelId]
    );

    const totalRooms = Number(roomCountRow.total || 0);
    const monthlyOccupancy = [];
    const now = new Date();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const monthStartDate = new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1
      );

      const monthEndDate = new Date(
        monthStartDate.getFullYear(),
        monthStartDate.getMonth() + 1,
        0
      );

      const monthStart = toSqlDate(monthStartDate);
      const monthEnd = toSqlDate(monthEndDate);

      const [[occupancyRow]] = await db.query(
        `
          SELECT
            COUNT(DISTINCT room_id) AS occupied_rooms

          FROM bookings

          WHERE hotel_id = ?
            AND booking_status IN (
              'confirmed',
              'checked_in',
              'checked_out'
            )
            AND check_in < DATE_ADD(
              ?,
              INTERVAL 1 DAY
            )
            AND check_out >= ?
        `,
        [hotelId, monthEnd, monthStart]
      );

      const occupiedRooms = Number(
        occupancyRow.occupied_rooms || 0
      );

      monthlyOccupancy.push({
        year: monthStartDate.getFullYear(),
        month: monthStartDate.getMonth() + 1,

        total:
          totalRooms === 0
            ? 0
            : Math.round(
                (occupiedRooms / totalRooms) * 100
              ),
      });
    }

    return res.status(200).json({
      success: true,

      stats: {
        totalBookings: Number(bookingsRow.total || 0),

        occupiedRooms: roomStatus.occupied,
        availableRooms: roomStatus.available,
        maintenanceRooms: roomStatus.maintenance,
        cleaningRooms: roomStatus.cleaning,

        /*
         * Final rooms table has no "reserved" room status.
         * It remains zero so the existing dashboard UI does not break.
         */
        reservedRooms: 0,

        todaysRevenue: Number(revenueRow.revenue || 0),

        monthlyRevenue,
        monthlyBookings,
        monthlyOccupancy,
        recentBookings,
      },
    });
  } catch (error) {
    logDashboardError("GET_ADMIN_DAILY_STATS", error);

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