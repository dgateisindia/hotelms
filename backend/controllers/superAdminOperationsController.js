"use strict";

const db = require("../config/db").promisePool;

const GROUPS = Object.freeze({
  rooms: ["available", "occupied", "cleaning", "maintenance"],
  bookings: [
    "pending", "confirmed", "checked_in", "checked_out",
    "cancelled", "no_show", "expired"
  ],
  housekeeping: ["pending", "in_progress", "completed", "cancelled"],
  maintenance: ["pending", "in_progress", "completed", "cancelled"],
  customerRequests: ["pending", "approved", "declined"],
  serviceRequests: ["pending", "in_progress", "completed", "cancelled"],
});

const GROUP_QUERIES = Object.freeze({
  rooms:
    "SELECT t.status AS status, COUNT(*) AS total " +
    "FROM rooms t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.status",

  bookings:
    "SELECT t.booking_status AS status, COUNT(*) AS total " +
    "FROM bookings t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.booking_status",

  housekeeping:
    "SELECT t.task_status AS status, COUNT(*) AS total " +
    "FROM housekeeping_tasks t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.task_status",

  maintenance:
    "SELECT t.task_status AS status, COUNT(*) AS total " +
    "FROM maintenance_tasks t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.task_status",

  customerRequests:
    "SELECT t.status AS status, COUNT(*) AS total " +
    "FROM customer_requests t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.status",

  serviceRequests:
    "SELECT t.request_status AS status, COUNT(*) AS total " +
    "FROM service_requests t JOIN hotels h ON h.hotel_id = t.hotel_id " +
    "WHERE t.hotel_id = ? AND h.superadmin_id = ? GROUP BY t.request_status",
});

const RECENT_QUERIES = Object.freeze({
  recentBookings: `
    SELECT
      b.booking_id AS id,
      b.booking_code AS code,
      b.booking_status AS status,
      b.stay_type AS stayType,
      b.check_in AS checkIn,
      b.check_out AS checkOut,
      r.room_number AS roomNumber
    FROM bookings b
    JOIN hotels h ON h.hotel_id = b.hotel_id
    LEFT JOIN rooms r
      ON r.room_id = b.room_id AND r.hotel_id = b.hotel_id
    WHERE b.hotel_id = ? AND h.superadmin_id = ?
    ORDER BY b.created_at DESC, b.booking_id DESC
    LIMIT 8
  `,

  openHousekeeping: `
    SELECT
      t.housekeeping_task_id AS id,
      t.task_type AS type,
      t.task_status AS status,
      r.room_number AS roomNumber,
      t.created_at AS createdAt
    FROM housekeeping_tasks t
    JOIN hotels h ON h.hotel_id = t.hotel_id
    LEFT JOIN rooms r
      ON r.room_id = t.room_id AND r.hotel_id = t.hotel_id
    WHERE t.hotel_id = ? AND h.superadmin_id = ?
      AND t.task_status IN ('pending', 'in_progress')
    ORDER BY t.created_at DESC, t.housekeeping_task_id DESC
    LIMIT 8
  `,

  openMaintenance: `
    SELECT
      t.maintenance_task_id AS id,
      t.issue_title AS title,
      t.priority,
      t.task_status AS status,
      r.room_number AS roomNumber,
      t.created_at AS createdAt
    FROM maintenance_tasks t
    JOIN hotels h ON h.hotel_id = t.hotel_id
    LEFT JOIN rooms r
      ON r.room_id = t.room_id AND r.hotel_id = t.hotel_id
    WHERE t.hotel_id = ? AND h.superadmin_id = ?
      AND t.task_status IN ('pending', 'in_progress')
    ORDER BY t.created_at DESC, t.maintenance_task_id DESC
    LIMIT 8
  `,
});

function statusTotals(rows, knownStatuses) {
  const totals = Object.fromEntries(
    knownStatuses.map((status) => [status, 0])
  );

  let total = 0;

  for (const row of rows) {
    const count = Math.max(0, Number(row.total) || 0);

    if (Object.prototype.hasOwnProperty.call(totals, row.status)) {
      totals[row.status] += count;
    }

    total += count;
  }

  return { total, ...totals };
}

async function getHotelOperationsOverview(req, res) {
  const ownerId = Number(req.dbUser?.superadminId);

  if (
    req.dbUser?.role !== "super_admin" ||
    !Number.isSafeInteger(ownerId) ||
    ownerId <= 0
  ) {
    return res.status(403).json({
      success: false,
      message: "Super Admin access required.",
    });
  }

  const matched = /^HT-([0-9]{4,})$/.exec(
    String(req.params?.hotelDisplayId || "")
  );

  const hotelId = matched ? Number(matched[1]) : NaN;

  if (!Number.isSafeInteger(hotelId) || hotelId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid hotel ID.",
    });
  }

  try {
    const [owned] = await db.query(
      "SELECT hotel_id, hotel_name, status " +
      "FROM hotels WHERE hotel_id = ? AND superadmin_id = ? LIMIT 1",
      [hotelId, ownerId]
    );

    if (owned.length !== 1) {
      return res.status(404).json({
        success: false,
        message: "Hotel not found in your portfolio.",
      });
    }

    const groupKeys = Object.keys(GROUP_QUERIES);
    const recentKeys = Object.keys(RECENT_QUERIES);
    const keys = [...groupKeys, ...recentKeys];

    const results = await Promise.all(
      keys.map((key) =>
        db.query(
          GROUP_QUERIES[key] || RECENT_QUERIES[key],
          [hotelId, ownerId]
        )
      )
    );

    const data = {};

    keys.forEach((key, index) => {
      const rows = results[index][0];

      data[key] = GROUPS[key]
        ? statusTotals(rows, GROUPS[key])
        : rows;
    });

    return res.status(200).json({
      success: true,
      data: {
        hotel: {
          displayId: `HT-${String(hotelId).padStart(4, "0")}`,
          name: owned[0].hotel_name,
          status: owned[0].status,
        },
        generatedAt: new Date().toISOString(),
        ...data,
      },
    });
  } catch (error) {
    console.error("[SA5A_OPERATIONS_OVERVIEW]", error);

    return res.status(500).json({
      success: false,
      message: "Operations overview unavailable.",
    });
  }
}

module.exports = { getHotelOperationsOverview };