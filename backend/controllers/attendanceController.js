const pool = require("../config/db").promisePool;

const STATUS_VALUES = ["present", "absent", "half_day", "leave"];

exports.getAttendanceByDate = async (req, res) => {
  const { date } = req.query;
  const hotelId = req.dbUser.hotelId;

  if (!date) {
    return res.status(400).json({ message: "date query param (YYYY-MM-DD) is required." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT s.staff_id, s.staff_code AS staffCode, s.full_name AS name, s.department AS dept,
              a.check_in_time, a.check_out_time, COALESCE(a.status, 'absent') AS status
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
