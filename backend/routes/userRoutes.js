const express = require("express");
const router = express.Router();

const { requireAuth } = require("@clerk/express");
const { attachDbUser, requireRole } = require("../middleware/roleMiddleware");

const {
  createStaffUser,
  getStaffUsers,
} = require("../controllers/userController");

// Create Admin (Only Super Admin)
router.post(
  "/create-admin",
  requireAuth(),
  attachDbUser(),
  requireRole("super_admin"),
  createStaffUser
);

// Get All Admins
/*router.get(
  "/staff",
  requireAuth(),
  attachDbUser(),
  requireRole("super_admin"),
  getStaffUsers
);*/

// Current Logged-in User
router.get(
  "/me",
  requireAuth(),
  attachDbUser(),
  async (req, res) => {
    res.json({
      success: true,
      user: req.dbUser,
    });
  }
);

console.log("✅ userRoutes loaded");

module.exports = router;