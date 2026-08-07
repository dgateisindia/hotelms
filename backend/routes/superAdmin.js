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

const {
  getHotels,
  getHotelByDisplayId,
  createHotel,
} = require("../controllers/hotelController");

const router = express.Router();

/* ============================================================
   SUPER ADMIN SECURITY

   Every route below requires:

   1. Valid Clerk session
   2. Active HMS database account
   3. super_admin role
============================================================ */

router.use(
  requireClerkSession,
  attachDbUser(),
  requireRole("super_admin")
);

/* ============================================================
   DASHBOARD
============================================================ */

/**
 * GET /api/superadmin/stats
 *
 * Returns portfolio-level dashboard statistics for hotels
 * owned by the authenticated Super Admin.
 */
router.get(
  "/stats",
  getSuperAdminStats
);

/**
 * GET /api/superadmin/admins
 *
 * Returns Admin accounts belonging only to hotels owned by
 * the authenticated Super Admin.
 */
router.get(
  "/admins",
  getAdminsStatus
);

/* ============================================================
   HOTEL MANAGEMENT
============================================================ */

/**
 * GET /api/superadmin/hotels
 *
 * Returns all hotels owned by the authenticated Super Admin,
 * including hotel-card summary information.
 */
router.get(
  "/hotels",
  getHotels
);

/**
 * POST /api/superadmin/hotels
 *
 * Creates:
 * - Hotel record
 * - Hotel-level QR record
 *
 * Both are created inside one database transaction.
 */
router.post(
  "/hotels",
  createHotel
);

/**
 * GET /api/superadmin/hotels/:hotelDisplayId
 *
 * Example:
 * GET /api/superadmin/hotels/HT-0001
 *
 * The controller verifies that the requested hotel belongs
 * to the authenticated Super Admin.
 */
router.get(
  "/hotels/:hotelDisplayId",
  getHotelByDisplayId
);

module.exports = router;