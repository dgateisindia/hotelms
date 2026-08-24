const express =
  require("express");


const {
  requireClerkSession,
  attachDbUser,
  requireRole,
} = require(
  "../middleware/roleMiddleware"
);


const {
  getSettings,
  updateSettings,
  getAuditHistory,
  restoreSetting,
  resetSetting,
  getCapabilities,
} = require(
  "../controllers/hotelSettingsController"
);


const router =
  express.Router();


/* ============================================================
   HOTEL SETTINGS ROUTES

   SECURITY FLOW

   Every request:
   1. Valid Clerk session
   2. Active HMS DB account
   3. Role verification

   ADMIN
   ------------------------------------------------------------
   Admin never sends/selects hotel ID.

   Hotel comes from:
   req.dbUser.hotelId


   SUPER ADMIN
   ------------------------------------------------------------
   Super Admin selects one owned hotel.

   Route:
   /hotel/:hotelId

   Service again verifies hotel ownership.
============================================================ */


/* ============================================================
   COMMON AUTHENTICATION

   Both Admin and Super Admin must first:
   - be authenticated in Clerk
   - have an active HMS account
============================================================ */

router.use(
  requireClerkSession
);


router.use(
  attachDbUser()
);


/* ============================================================
   ADMIN ROUTES

   Base URL:
   /api/hotel-settings

   IMPORTANT:
   There is NO hotel ID in these URLs.

   Admin hotel is always:
   req.dbUser.hotelId
============================================================ */


/* ------------------------------------------------------------
   GET CURRENT HOTEL SETTINGS

   GET /api/hotel-settings
------------------------------------------------------------ */

router.get(
  "/",
  requireRole(
    "admin"
  ),
  getSettings
);


/* ------------------------------------------------------------
   UPDATE CURRENT HOTEL SETTINGS

   PATCH /api/hotel-settings

   BODY:

   {
     "changes": [
       {
         "section": "cancellation",
         "key": "calculation_mode",
         "value": "rules"
       }
     ],

     "changeReason":
       "Updated cancellation policy."
   }
------------------------------------------------------------ */

router.patch(
  "/",
  requireRole(
    "admin"
  ),
  updateSettings
);


/* ------------------------------------------------------------
   SETTINGS CAPABILITIES

   GET /api/hotel-settings/capabilities
------------------------------------------------------------ */

router.get(
  "/capabilities",
  requireRole(
    "admin"
  ),
  getCapabilities
);


/* ------------------------------------------------------------
   SETTINGS ACTIVITY HISTORY

   GET /api/hotel-settings/audit

   Optional:

   ?section=cancellation
   ?actorType=admin
   ?actorId=1
   ?fromDate=2026-08-01
   ?toDate=2026-08-31
   ?page=1
   ?pageSize=50
------------------------------------------------------------ */

router.get(
  "/audit",
  requireRole(
    "admin"
  ),
  getAuditHistory
);


/* ------------------------------------------------------------
   RESTORE PREVIOUS SETTING

   POST /api/hotel-settings/restore

   BODY:

   {
     "auditId": 10,
     "changeReason":
       "Restoring previous policy."
   }
------------------------------------------------------------ */

router.post(
  "/restore",
  requireRole(
    "admin"
  ),
  restoreSetting
);


/* ------------------------------------------------------------
   RESET ONE SETTING

   POST /api/hotel-settings/reset

   BODY:

   {
     "section": "early_checkout",
     "key": "calculation_mode",
     "changeReason":
       "Reset to HMS default."
   }
------------------------------------------------------------ */

router.post(
  "/reset",
  requireRole(
    "admin"
  ),
  resetSetting
);


/* ============================================================
   SUPER ADMIN ROUTES

   Base:

   /api/hotel-settings/hotel/:hotelId

   Super Admin selects a hotel.

   IMPORTANT:
   Providing a hotel ID does NOT automatically grant access.

   hotelSettingsService verifies:

   hotels.hotel_id
   +
   hotels.superadmin_id

   against authenticated Super Admin.
============================================================ */


/* ------------------------------------------------------------
   GET SELECTED HOTEL SETTINGS

   GET
   /api/hotel-settings/hotel/1
------------------------------------------------------------ */

router.get(
  "/hotel/:hotelId",
  requireRole(
    "super_admin"
  ),
  getSettings
);


/* ------------------------------------------------------------
   UPDATE SELECTED HOTEL SETTINGS

   PATCH
   /api/hotel-settings/hotel/1
------------------------------------------------------------ */

router.patch(
  "/hotel/:hotelId",
  requireRole(
    "super_admin"
  ),
  updateSettings
);


/* ------------------------------------------------------------
   SELECTED HOTEL CAPABILITIES

   GET
   /api/hotel-settings/hotel/1/capabilities
------------------------------------------------------------ */

router.get(
  "/hotel/:hotelId/capabilities",
  requireRole(
    "super_admin"
  ),
  getCapabilities
);


/* ------------------------------------------------------------
   SELECTED HOTEL AUDIT HISTORY

   GET
   /api/hotel-settings/hotel/1/audit
------------------------------------------------------------ */

router.get(
  "/hotel/:hotelId/audit",
  requireRole(
    "super_admin"
  ),
  getAuditHistory
);


/* ------------------------------------------------------------
   RESTORE SELECTED HOTEL SETTING

   POST
   /api/hotel-settings/hotel/1/restore
------------------------------------------------------------ */

router.post(
  "/hotel/:hotelId/restore",
  requireRole(
    "super_admin"
  ),
  restoreSetting
);


/* ------------------------------------------------------------
   RESET SELECTED HOTEL SETTING

   POST
   /api/hotel-settings/hotel/1/reset
------------------------------------------------------------ */

router.post(
  "/hotel/:hotelId/reset",
  requireRole(
    "super_admin"
  ),
  resetSetting
);


/* ============================================================
   EXPORT
============================================================ */

module.exports =
  router;