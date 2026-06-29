// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.User_id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.User_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email and password are required.',
      });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password.',
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      accessToken,
      user: { id: user.User_id, fullName: user.full_name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, statusCode: 500, message: 'Server error.' });
  }
};

exports.register = async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    console.log('Register Body:', req.body);

    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists.',
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO users (full_name, email, phone, password, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, hashedPassword, 'admin', 'active']
    );

    console.log('Inserted User ID:', result.insertId);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
    });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.refreshToken = (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, statusCode: 401, message: 'No refresh token provided.' });
  }

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, statusCode: 403, message: 'Invalid or expired refresh token.' });
    }

    try {
      const [users] = await db.query('SELECT role FROM users WHERE User_id = ?', [decoded.id]);
      const user = users[0];

      if (!user) {
        return res.status(403).json({ success: false, statusCode: 403, message: 'User not found.' });
      }

      const newAccessToken = jwt.sign(
        { id: decoded.id, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
      );

      return res.status(200).json({ success: true, statusCode: 200, accessToken: newAccessToken });
    } catch (dbErr) {
      console.error('Refresh token DB error:', dbErr);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  });
};

// ---- Super Admin / Admin registration (separate `admins` table) ----

exports.registerSuperAdmin = async (req, res) => {
  const { full_name, email, password, confirmPassword } = req.body;

  if (!full_name || !email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingAdmin] = await connection.query('SELECT admin_id FROM admins WHERE email = ?', [email]);
    if (existingAdmin.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const [superAdmins] = await connection.query("SELECT admin_id FROM admins WHERE role = 'super_admin'");
    if (superAdmins.length > 0) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Super admin already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [userResult] = await connection.query(
      "INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, 'super_admin', 'active')",
      [full_name, email, hashedPassword]
    );
    const userId = userResult.insertId;

    await connection.query(
      "INSERT INTO admins (user_id, email, password, role) VALUES (?, ?, ?, 'super_admin')",
      [userId, email, hashedPassword]
    );

    await connection.commit();
    return res.status(201).json({ success: true, message: 'Super admin registered successfully.' });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    console.error('Super admin registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
};

// ---- Super Admin creates a Hotel ----
exports.createHotel = async (req, res) => {
  const {
    hotel_name, hotel_type, hotel_desc, star_rating,
    year_established, gst_number, pan_number, business_reg_number,
  } = req.body;

  if (!hotel_name) {
    return res.status(400).json({ success: false, message: 'Hotel name is required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO hotels
        (hotel_name, hotel_type, hotel_desc, star_rating, year_established,
         gst_number, pan_number, business_reg_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [hotel_name, hotel_type, hotel_desc, star_rating, year_established,
       gst_number, pan_number, business_reg_number]
    );

    return res.status(201).json({
      success: true,
      hotel_id: result.insertId,
      message: 'Hotel created successfully.',
    });
  } catch (err) {
    console.error('createHotel error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ---- Super Admin creates an Admin (replaces self-registration) ----
exports.registerAdmin = async (req, res) => {
  const { full_name, email, phone, hotel_id } = req.body;

  if (!full_name || !email || !hotel_id) {
    return res.status(400).json({
      success: false,
      message: 'full_name, email, and hotel_id are required.',
    });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingAdmin] = await connection.query('SELECT admin_id FROM admins WHERE email = ?', [email]);
    if (existingAdmin.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, email, phone, password, role, status)
       VALUES (?, ?, ?, ?, 'admin', 'active')`,
      [full_name, email, phone || null, hashedPassword]
    );
    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO admins (user_id, email, password, role, hotel_id, created_by, must_change_password)
       VALUES (?, ?, ?, 'admin', ?, ?, true)`,
      [userId, email, hashedPassword, hotel_id, req.user.id]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Admin created successfully.',
      temp_password: tempPassword,
    });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    console.error('registerAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
};
exports.createRoom = async (req, res) => {

    const {
        room_number,
        room_type,
        Floor,
        capacity,
        price,
        status
    } = req.body;

    await db.query(`
INSERT INTO rooms
(room_number, room_type, Floor_number, capacity, price_per_night, status)
VALUES (?, ?, ?, ?, ?, ?)
`, [
  roomNo,
  type,
  floor,
  capacity,
  price,
  status
]);

    res.status(201).json({
        success: true,
        message: "Room added successfully"
    });

};