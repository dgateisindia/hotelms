const express =
  require("express");


const {
  requireClerkSession,
  attachDbUser,
  requireRole,
} = require("../middleware/roleMiddleware");


const {
  getAdminContext,
} = require("../controllers/adminContextController");


const router =
  express.Router();


/* ============================================================
   HOTEL ADMIN ROUTER SECURITY

   Every route below requires:
   1. Valid Clerk session
   2. Active HMS database account
   3. Hotel Admin role

   req.dbUser.hotelId is trusted server-side context.
============================================================ */

router.use(
  requireClerkSession
);


router.use(
  attachDbUser()
);


router.use(
  requireRole("admin")
);


/* ============================================================
   ADMIN WORKSPACE CONTEXT

   GET /api/admin/context
============================================================ */

router.get(
  "/context",
  getAdminContext
);


module.exports =
  router;