const bcrypt = require('bcryptjs');
const db = require('../config/db');

const ALLOWED_STAFF_ROLES = ['admin', 'receptionist', 'housekeeping', 'accountant'];

// POST /api/users/create-admin  (super_admin only)
const createStaffUser = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;

    if (!full_name || !email || !phone || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected' });
    }

    const [existing] = await db.query('SELECT User_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO users (full_name, email, phone, password, role, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [full_name, email, phone, hashedPassword, role, req.user.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      user: { id: result.insertId, full_name, email, role }
    });
  } catch (err) {
    console.error('createStaffUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating staff account' });
  }
};

// GET /api/users/staff  (super_admin only)
const getStaffUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT User_id AS id, full_name, email, role, status, created_at
       FROM users WHERE role != 'customer' AND role != 'super_admin'`
    );
    return res.status(200).json({ success: true, users: rows });
  } catch (err) {
    console.error('getStaffUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching staff list' });
  }
};

module.exports = { createStaffUser, getStaffUsers };