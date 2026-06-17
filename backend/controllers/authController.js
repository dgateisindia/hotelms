const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const nodemailer = require("nodemailer")
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login Email:", email);

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    console.log("Users Found:", users.length);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = users[0];

console.log("DB Email:", user.email);
console.log("DB Password Hash:", user.password);

const passwordMatch = await bcrypt.compare(
  password,
  user.password
);

console.log("Password Match:", passwordMatch);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.register = async (req, res) => {
  try {
    // TODO: implement register logic
    res.json({ message: 'Register endpoint' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    // TODO: implement forgot password logic
    res.json({ message: 'Forgot password endpoint' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

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

    res.json({
      success: true,
      message: "OTP Sent"
    });

  } catch (error) {
    console.error("OTP Error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.verifyOTP = async (req, res) => {

  const { email, otp } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM users WHERE email=?",
    [email]
  );

  if (!rows.length) {
    return res.status(404).json({
      message: "User not found"
    });
  }

  const user = rows[0];

  if (user.otp !== otp) {
    return res.status(400).json({
      message: "Invalid OTP"
    });
  }

  if (new Date() > new Date(user.otp_expiry)) {
    return res.status(400).json({
      message: "OTP Expired"
    });
  }

  res.json({
    success: true
  });
};
exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Reset Email:", email);
    console.log("New Password:", password);

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "UPDATE users SET password=?, otp=NULL, otp_expiry=NULL WHERE email=?",
      [hashedPassword, email]
    );

    console.log("Rows Updated:", result.affectedRows);

    res.json({
      success: true,
      message: "Password Updated"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};