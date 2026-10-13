const pool = require("../config/db").promisePool;

const STATUS_VALUES = ["present", "absent", "half_day", "leave"];

exports.getAttendanceByDate = async (req, res) => {
  const { date } = req.query;
  const hotelId = req.dbUser.hotelId;

  // ATTENDANCE-A5:
  // Authenticated hotel-scoped attendance range.
  // Unmarked entries are not automatically considered absent.

  if (req.query.start !== undefined || req.query.end !== undefined) {
    const { start, end } = req.query;

    const valid = (value) => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const ms = Date.parse(`${value}T00:00:00.000Z`);

      return (
        Number.isFinite(ms) &&
        new Date(ms).toISOString().slice(0, 10) === value
      );
    };

    if (!valid(start) || !valid(end)) {
      return res.status(400).json({
        message: "Valid start and end dates (YYYY-MM-DD) are required."
      });
    }

    const duration =
      Math.round(
        (
          Date.parse(`${end}T00:00:00Z`) -
          Date.parse(`${start}T00:00:00Z`)
        ) / 86400000
      ) + 1;

    if (duration < 1 || duration > 31) {
      return res.status(400).json({
        message: "Attendance range must contain 1 to 31 days."
      });
    }

    try {
      const [staff] = await pool.query(
        `SELECT
           staff_id,
           staff_code AS staffCode,
           full_name AS name,
           department AS dept
         FROM staff
         WHERE hotel_id = ?
         ORDER BY staff_id ASC`,
        [hotelId]
      );

      const [records] = await pool.query(
        `SELECT
           a.staff_id,
           DATE_FORMAT(a.attendance_date, '%Y-%m-%d')
             AS attendance_date,
           a.check_in_time,
           a.check_out_time,
           a.status
         FROM attendance a
         INNER JOIN staff s
           ON s.staff_id = a.staff_id
          AND s.hotel_id = a.hotel_id
         WHERE a.hotel_id = ?
           AND s.hotel_id = ?
           AND a.attendance_date BETWEEN ? AND ?
         ORDER BY a.attendance_date ASC, a.staff_id ASC`,
        [hotelId, hotelId, start, end]
      );

      return res.json({
        start,
        end,
        staff,
        records
      });
    } catch (err) {
      console.error("getAttendanceRange error:", err);

      return res.status(500).json({
        message: "Failed to load attendance range."
      });
    }
  }

  if (!date) {
    return res.status(400).json({ message: "date query param (YYYY-MM-DD) is required." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT s.staff_id, s.staff_code AS staffCode, s.full_name AS name, s.department AS dept,
              a.check_in_time, a.check_out_time, COALESCE(a.status, 'absent') AS status,
              CASE WHEN a.attendance_id IS NULL THEN 0 ELSE 1 END AS isMarked
       FROM staff s
       LEFT JOIN attendance a
         ON a.staff_id = s.staff_id
        AND a.hotel_id = s.hotel_id
        AND a.attendance_date = ?
       WHERE s.hotel_id = ?
       ORDER BY s.staff_id ASC`,
      [date, hotelId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("getAttendanceByDate error:", err);
    return res.status(500).json({ message: "Failed to load attendance." });
  }
};

exports.upsertAttendance = async (req, res) => {
  const { staff_id } = req.params;
  const { attendance_date, check_in_time, check_out_time, status } = req.body;
  const hotelId = req.dbUser.hotelId;

  if (!attendance_date) {
    return res.status(400).json({ message: "attendance_date is required." });
  }

  if (!STATUS_VALUES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${STATUS_VALUES.join(", ")}` });
  }

  try {
    const [staffRows] = await pool.query(
      "SELECT staff_id FROM staff WHERE staff_id = ? AND hotel_id = ?",
      [staff_id, hotelId]
    );

    if (staffRows.length === 0) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    const [existing] = await pool.query(
      "SELECT attendance_id FROM attendance WHERE hotel_id = ? AND staff_id = ? AND attendance_date = ?",
      [hotelId, staff_id, attendance_date]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE attendance
         SET check_in_time = ?, check_out_time = ?, status = ?
         WHERE attendance_id = ? AND hotel_id = ?`,
        [check_in_time || null, check_out_time || null, status, existing[0].attendance_id, hotelId]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance
         (hotel_id, staff_id, attendance_date, check_in_time, check_out_time, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [hotelId, staff_id, attendance_date, check_in_time || null, check_out_time || null, status]
      );
    }

    const [[updated]] = await pool.query(
      `SELECT s.staff_id, s.staff_code AS staffCode, s.full_name AS name, s.department AS dept,
              a.check_in_time, a.check_out_time, a.status
       FROM staff s
       LEFT JOIN attendance a
         ON a.staff_id = s.staff_id
        AND a.hotel_id = s.hotel_id
        AND a.attendance_date = ?
       WHERE s.staff_id = ? AND s.hotel_id = ?`,
      [attendance_date, staff_id, hotelId]
    );

    return res.json(updated);
  } catch (err) {
    console.error("upsertAttendance error:", err);
    return res.status(500).json({ message: "Failed to save attendance." });
  }
};
