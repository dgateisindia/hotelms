// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.User_id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' } // short-lived
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.User_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // long-lived
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

const isMatch = password === user.password;    if (!isMatch) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password.',
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Send refresh token as httpOnly cookie — frontend JS never touches it directly
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      accessToken, // frontend stores this in memory
      user: { id: user.User_id, fullName: user.full_name, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, statusCode: 500, message: 'Server error.' });
  }
};
//creating Register function to register new user
exports.register = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      password,
    } = req.body;

    console.log('Register Body:', req.body);

    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    const [existingUser] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists.',
      });
    }

    const [result] = await db.query(
      `INSERT INTO users (
        full_name,
        email,
        phone,
        password,
        role,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        phone,
        password,
        'admin',
        'active',
      ]
    );

    console.log('Inserted User ID:', result.insertId);

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
    });
  } catch (error) {
    console.error('Register Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};
//Refresh token startpoint
exports.refreshToken = (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, statusCode: 401, message: 'No refresh token provided.' });
  }

  jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, statusCode: 403, message: 'Invalid or expired refresh token.' });
    }

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' }
    );

    return res.status(200).json({ success: true, statusCode: 200, accessToken: newAccessToken });
  });
};