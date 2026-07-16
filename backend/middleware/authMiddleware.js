const { getAuth } = require("@clerk/express");
const db = require("../config/db");

const protect = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const [rows] = await db.query(
      `SELECT user_id, full_name, email, role, clerk_id
       FROM users
       WHERE clerk_id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = rows[0]; // now has .role for requireRole to check
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

module.exports = { protect };