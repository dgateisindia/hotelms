const express =
  require("express");

const router =
  express.Router();

const {
  createRequest,
  getPublicRequestContext,
} = require(
  "../controllers/customerRequestController"
);


/* ============================================================
   PUBLIC QR CUSTOMER REQUEST

   These routes intentionally require no Clerk session.

   Hotel tenancy is derived only from the active public QR token.
============================================================ */

router.get(
  "/public/:publicToken",
  getPublicRequestContext
);

router.post(
  "/public/:publicToken",
  createRequest
);


module.exports =
  router;