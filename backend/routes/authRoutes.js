const express = require("express");
//const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

 // const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

  db.query(sql, [name, email, Password, role || "employee"], (err, result) => {
    if (err) {
      return res.status(500).json({ message: "User already exists or DB error" });
    }

    res.status(201).json({ message: "User registered successfully" });
  });
});
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];

    //const isMatch = await bcrypt.compare(password, user.password);

   /* if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }*/

      if (password !== user.password) {
  return res.status(401).json({
    message: "Invalid email or password"
  });
}

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
});

module.exports = router;