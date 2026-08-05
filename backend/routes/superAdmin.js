const express = require("express");

const {
  requireClerkSession,
  attachDbUser,
  requireRole,
} = require("../middleware/roleMiddleware");

const {
  getSuperAdminStats,
  getAdminsStatus,
} = require("../controllers/dashboardController");

const router = express.Router();

/*
 * Every route in this file requires:
 *
 * 1. A valid Clerk session
 * 2. A linked and active HMS account
 * 3. The super_admin role
 */
router.use(
  requireClerkSession,
  attachDbUser(),
  requireRole("super_admin")
);

/*
 * Compatibility endpoint:
 * GET /api/superadmin/stats
 *
 * Uses the same secure and owner-scoped controller as:
 * GET /api/dashboard/super-admin-stats
 */
router.get("/stats", getSuperAdminStats);

/*
 * Compatibility endpoint:
 * GET /api/superadmin/admins
 *
 * Returns only Admins belonging to hotels created by the
 * authenticated Super Admin.
 */
router.get("/admins", getAdminsStatus);

module.exports = router;