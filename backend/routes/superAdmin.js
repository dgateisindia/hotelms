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

const {
  getHotelAdmins,
  createHotelAdmin,
} = require("../controllers/superAdminAdminController");

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
 * Portfolio-level Admin list.
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


/* ============================================================
   SELECTED HOTEL - ADMIN MANAGEMENT
============================================================ */

/**
 * GET /api/superadmin/hotels/:hotelDisplayId/admins
 *
 * Example:
 * GET /api/superadmin/hotels/HT-0001/admins
 *
 * Returns Admin accounts assigned only to the selected hotel.
 *
 * The controller verifies:
 * - authenticated Super Admin
 * - hotel ownership
 * - hotel/admin isolation
 */
router.get(
  "/hotels/:hotelDisplayId/admins",
  getHotelAdmins
);

/**
 * POST /api/superadmin/hotels/:hotelDisplayId/admins
 *
 * Creates a Hotel Admin for the selected hotel.
 *
 * Security:
 * - authenticated Super Admin only
 * - hotel ownership verified by controller
 * - password handled only by Clerk
 * - MySQL stores only HMS Admin profile
 */
router.post(
  "/hotels/:hotelDisplayId/admins",
  createHotelAdmin
);

/* ============================================================
   SELECTED HOTEL DETAILS
============================================================ */

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