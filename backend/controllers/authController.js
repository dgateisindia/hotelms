const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

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
