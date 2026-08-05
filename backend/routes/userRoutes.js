const express = require("express");

const {
  requireClerkSession,
  attachDbUser,
} = require("../middleware/roleMiddleware");

const router = express.Router();

/*
 * Temporary compatibility endpoint.
 *
 * The main authenticated-user endpoint is:
 * GET /api/auth/me
 *
 * This route remains temporarily available so any older frontend
 * page still using /api/users/me does not break immediately.
 */
router.get(
  "/me",
  requireClerkSession,
  attachDbUser(),
  (req, res) => {
    return res.status(200).json({
      success: true,
      user: req.dbUser,
    });
  }
);

module.exports = router;