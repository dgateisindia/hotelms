const express = require("express");
const router = express.Router();

const { createRequest } = require("../controllers/customerRequestController");

// Public guest route.
// Hotel identity is resolved ONLY from the active QR public token.
router.post("/:publicToken", createRequest);

module.exports = router;