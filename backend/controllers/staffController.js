// ============================================================
//  staffController.js — Staff CRUD logic
//  Matches the ALTERed `staff` table (see alter_staff_table.sql):
//    staff_id, staff_code, full_name, email, phone, user_id,
//    department, designation, salary, joining_date,
//    emergency_contact, status
//
//  user_id is optional — only staff who also have a portal
//  login (linked to `users`) will have it set. Most HR-only
//  roles can leave it NULL.
//
//  Adjust the require path below if your db pool file lives
//  somewhere else (e.g. '../config/database').
// ============================================================

const pool = require('../config/db'); // must export a mysql2/promise pool

// ── Helpers ───────────────────────────────────────────────────

// Maps a DB row -> the shape the Staff.js frontend expects
const toClient = (row) => ({
  id: row.staff_id,
  staffId: row.staff_code,
  name: row.full_name,
  dept: row.department,
  designation: row.designation,
  phone: row.phone,
  email: row.email,
  salary: row.salary,
  joinDate: row.joining_date,
  emergencyContact: row.emergency_contact,
  status: row.status,
  userId: row.user_id,
});

// Generates the next staff code, e.g. STF-1001 -> STF-1002
async function generateStaffCode(connection) {
  const [rows] = await connection.query(
    `SELECT staff_code FROM staff ORDER BY staff_id DESC LIMIT 1`
  );
  if (rows.length === 0 || !rows[0].staff_code) return 'STF-1001';
  const lastNum = parseInt(String(rows[0].staff_code).replace(/\D/g, ''), 10) || 1000;
  return `STF-${lastNum + 1}`;
}

function validateStaffPayload(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('Name is required.');
  if (!body.dept || !body.dept.trim()) errors.push('Department is required.');
  if (!body.designation || !body.designation.trim()) errors.push('Designation is required.');
  if (!body.phone || !body.phone.trim()) errors.push('Phone number is required.');
  if (!body.email || !body.email.trim()) errors.push('Email is required.');
  else if (!/^\S+@\S+\.\S+$/.test(body.email)) errors.push('Email is invalid.');
  if (!body.salary || Number(String(body.salary).replace(/[^0-9.]/g, '')) <= 0) errors.push('Salary is required and must be greater than 0.');
  if (!body.joinDate || !String(body.joinDate).trim()) errors.push('Join date is required.');
  if (!body.emergencyContact || !body.emergencyContact.trim()) errors.push('Emergency contact is required.');
  if (!body.status || !['Active', 'On Leave', 'Inactive'].includes(body.status)) {
    errors.push('Status must be Active, On Leave, or Inactive.');
  }
  return errors;
}

// ── Controllers ──────────────────────────────────────────────

// GET /api/staff
exports.getAllStaff = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM staff ORDER BY staff_id DESC`);
    res.json(rows.map(toClient));
  } catch (err) {
    console.error('getAllStaff error:', err);
    res.status(500).json({ message: 'Failed to fetch staff list.' });
  }
};

// GET /api/staff/:id
exports.getStaffById = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM staff WHERE staff_id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Staff member not found.' });
    res.json(toClient(rows[0]));
  } catch (err) {
    console.error('getStaffById error:', err);
    res.status(500).json({ message: 'Failed to fetch staff member.' });
  }
};

// POST /api/staff
exports.createStaff = async (req, res) => {
  const errors = validateStaffPayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(' ') });

  const { name, dept, designation, phone, email, salary, joinDate, status, emergencyContact } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const staffCode = await generateStaffCode(connection);

    const [result] = await connection.query(
      `INSERT INTO staff
        (staff_code, full_name, email, phone, department, designation, salary, joining_date, emergency_contact, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffCode,
        name.trim(),
        email || null,
        phone || null,
        dept,
        designation,
        salary ? Number(String(salary).replace(/[^0-9.]/g, '')) : 0,
        joinDate || null,
        emergencyContact || null,
        status || 'Active',
      ]
    );

    await connection.commit();

    const [rows] = await pool.query(`SELECT * FROM staff WHERE staff_id = ?`, [result.insertId]);
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await connection.rollback();
    console.error('createStaff error:', err);
    res.status(500).json({ message: 'Failed to create staff member.' });
  } finally {
    connection.release();
  }
};

// PUT /api/staff/:id
exports.updateStaff = async (req, res) => {
  const errors = validateStaffPayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(' ') });

  const { name, dept, designation, phone, email, salary, joinDate, status, emergencyContact } = req.body;
  try {
    const [existing] = await pool.query(`SELECT staff_id FROM staff WHERE staff_id = ?`, [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Staff member not found.' });

    await pool.query(
      `UPDATE staff
       SET full_name = ?, email = ?, phone = ?, department = ?, designation = ?,
           salary = ?, joining_date = ?, emergency_contact = ?, status = ?
       WHERE staff_id = ?`,
      [
        name.trim(),
        email || null,
        phone || null,
        dept,
        designation,
        salary ? Number(String(salary).replace(/[^0-9.]/g, '')) : 0,
        joinDate || null,
        emergencyContact || null,
        status || 'Active',
        req.params.id,
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM staff WHERE staff_id = ?`, [req.params.id]);
    res.json(toClient(rows[0]));
  } catch (err) {
    console.error('updateStaff error:', err);
    res.status(500).json({ message: 'Failed to update staff member.' });
  }
};

// DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const [result] = await pool.query(`DELETE FROM staff WHERE staff_id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Staff member not found.' });
    res.json({ message: 'Staff member deleted successfully.' });
  } catch (err) {
    console.error('deleteStaff error:', err);
    res.status(500).json({ message: 'Failed to delete staff member.' });
  }
};