const express = require("express");

const { registerSuperAdmin } = require("../controllers/authController");

const {
  getAccountProfile,
  updateAccountProfile,
} = require("../controllers/accountProfileController");

const {
  requireClerkSession,
  attachDbUser,
} = require("../middleware/roleMiddleware");

const router = express.Router();

/*
 * Clerk account creation and email verification happen on the frontend.
 *
 * This endpoint creates only the authenticated Super Admin profile
 * inside MySQL.
 *
 * Passwords are never sent to or stored by this endpoint.
 */
router.post(
  "/register-super-admin",
  requireClerkSession,
  registerSuperAdmin
);

/*
 * Verifies:
 * 1. Clerk session
 * 2. HMS database account
 * 3. Account active status
 *
 * Endpoint:
 * GET /api/auth/me
 */
router.get(
  "/me",
  requireClerkSession,
  attachDbUser(),
  (req, res) => {
    return res.status(200).json({
      success: true,
      session: {
        sessionId: req.clerkAuth.sessionId,
      },
      user: req.dbUser,
    });
  }
);

/* ============================================================
   AUTHENTICATED HMS ACCOUNT PROFILE
============================================================ */

router.get(
  "/profile",
  requireClerkSession,
  attachDbUser(),
  getAccountProfile
);


router.patch(
  "/profile",
  requireClerkSession,
  attachDbUser(),
  updateAccountProfile
);


module.exports = router;