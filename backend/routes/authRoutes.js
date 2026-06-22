const express = require("express");
//const bcrypt = require("bcryptjs");
//const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { login } = require('../controllers/authController');

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

  db.query(sql, [name, email, password, role || "employee"], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "User already exists or DB error" });
    }

    res.status(201).json({ message: "User registered successfully" });
  });
});

// Use the controller's login function — plain text check, returns { success, message, user }
router.post("/login", login);

module.exports = router;