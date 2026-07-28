// ============================================================
//  attendanceController.js
//  Matches the schema:
//    attendance(attendance_id PK, staff_id FK -> staff.staff_id,
//               attendance_date DATE, check_in_time TIME,
//               check_out_time TIME,
//               status ENUM('present','absent','half_day','leave'))
//
//  NOTE: adjust the pool import path below and the staff-table
//  column names (staff_code / name / dept) to match your actual
//  staffController.js / staff table — these are assumed to line
//  up with what Staff.js already reads (s.dept, s.name, etc).
// ============================================================

const pool = require('../config/db').promisePool;
const STATUS_VALUES = ['present', 'absent', 'half_day', 'leave'];

// ── GET /api/attendance?date=YYYY-MM-DD ─────────────────────
// Returns one row PER STAFF MEMBER for the given date. Staff with
// no attendance row yet for that date come back with status
// 'absent' and null times, so the UI always shows the full roster.
exports.getAttendanceByDate = async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'date query param (YYYY-MM-DD) is required.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         s.staff_id,
         s.staff_code   AS staffCode,
         s.full_name    AS name,
         s.department   AS dept,
         a.check_in_time,
         a.check_out_time,
         COALESCE(a.status, 'absent') AS status
       FROM staff s
       LEFT JOIN attendance a
         ON a.staff_id = s.staff_id
        AND a.attendance_date = ?
       ORDER BY s.staff_id ASC`,
      [date]
    );
    res.json(rows);
  } catch (err) {
    console.error('getAttendanceByDate error:', err);
    res.status(500).json({ message: 'Failed to load attendance.' });
  }
};

// ── PUT /api/attendance/:staff_id ───────────────────────────
// Upserts the attendance row for that staff member + date.
// Body: { attendance_date, check_in_time, check_out_time, status }
exports.upsertAttendance = async (req, res) => {
  const { staff_id } = req.params;
  const { attendance_date, check_in_time, check_out_time, status } = req.body;

  if (!attendance_date) {
    return res.status(400).json({ message: 'attendance_date is required.' });
  }
  if (!STATUS_VALUES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${STATUS_VALUES.join(', ')}` });
  }

  try {
    const [staffRows] = await pool.query('SELECT staff_id FROM staff WHERE staff_id = ?', [staff_id]);
    if (staffRows.length === 0) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    const [existing] = await pool.query(
      'SELECT attendance_id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
      [staff_id, attendance_date]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE attendance
         SET check_in_time = ?, check_out_time = ?, status = ?
         WHERE attendance_id = ?`,
        [check_in_time || null, check_out_time || null, status, existing[0].attendance_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance (staff_id, attendance_date, check_in_time, check_out_time, status)
         VALUES (?, ?, ?, ?, ?)`,
        [staff_id, attendance_date, check_in_time || null, check_out_time || null, status]
      );
    }

    const [[updated]] = await pool.query(
      `SELECT
         s.staff_id, s.staff_code AS staffCode, s.full_name AS name, s.department AS dept,
         a.check_in_time, a.check_out_time, a.status
       FROM staff s
       LEFT JOIN attendance a
         ON a.staff_id = s.staff_id AND a.attendance_date = ?
       WHERE s.staff_id = ?`,
      [attendance_date, staff_id]
    );

    res.json(updated);
  } catch (err) {
    console.error('upsertAttendance error:', err);
    res.status(500).json({ message: 'Failed to save attendance.' });
  }
};