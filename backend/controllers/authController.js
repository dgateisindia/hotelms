//const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const nodemailer = require("nodemailer");

// ============================================================
//  LOGIN
// ============================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 400 — Missing fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email and password are required.'
      });
    }

    // Find user
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    // 404 — User not found
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User account not found.'
      });
    }

    const user = users[0];

    // 403 — Account inactive (only applies if your users table has a status column)
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: 'Your account is inactive. Please contact support.'
      });
    }

    // 401 — Wrong password (plain text check; bcrypt currently disabled)
    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid email or password.'
      });
    }

    // 200 — Login success
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      user: {
        id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);

    // 500 — Server/database error
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Internal Server Error'
    });
  }
};

// ============================================================
//  REGISTER
// ============================================================
exports.register = async (req, res) => {
  try {
    // TODO: implement register logic
    res.json({ message: 'Register endpoint' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ============================================================
//  FORGOT PASSWORD
// ============================================================
exports.forgotPassword = async (req, res) => {
  try {
    // TODO: implement forgot password logic
    res.json({ message: 'Forgot password endpoint' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ============================================================
//  SEND OTP
// ============================================================
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email is required.'
      });
    }

    console.log("Email received:", email);

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    console.log("Generated OTP:", otp);

    const expiry = new Date(
      Date.now() + 5 * 60 * 1000
    );

    const [result] = await db.query(
      "UPDATE users SET otp=?, otp_expiry=? WHERE email=?",
      [otp, expiry, email]
    );

    console.log("Rows affected:", result.affectedRows);

    // 404 — No user with that email
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'User account not found.'
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP is ${otp}`
    });

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "OTP Sent"
    });

  } catch (error) {
    console.error("OTP Error:", error);

    res.status(500).json({
      success: false,
      statusCode: 500,
      message: error.message
    });
  }
};

// ============================================================
//  VERIFY OTP
// ============================================================
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email and OTP are required.'
      });
    }

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email=?",
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User account not found."
      });
    }

    const user = rows[0];

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid OTP."
      });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "OTP Expired."
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "OTP verified successfully."
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Internal Server Error"
    });
  }
};

// ============================================================
//  RESET PASSWORD
// ============================================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: 'Email and new password are required.'
      });
    }

    console.log("Reset Email:", email);
    console.log("New Password:", password);

    //const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "UPDATE users SET password=?, otp=NULL, otp_expiry=NULL WHERE email=?",
      [password, email] // plain text for now; swap to hashedPassword once bcrypt is re-enabled
    );

    console.log("Rows Updated:", result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User account not found."
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Password Updated"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      statusCode: 500,
      message: "Server Error"
    });
  }
};