const express = require("express");
const router = express.Router();

const { createRequest } = require("../controllers/customerRequestController");

// Public: a guest scanning the QR code has no Clerk session.
// This is the ONLY customer-request endpoint that should be reachable
// without authentication.
router.post("/", createRequest);

module.exports = router;