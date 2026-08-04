const express = require("express");
const router = express.Router();

const {
  getRequests,
  getRequestById,
  updateStatus,
  approveRequest,
  declineRequest,
  markSeen,
  deleteRequest,
} = require("../controllers/customerRequestController");

// All of these are admin/staff actions — reviewing and acting on
// requests — so they stay behind Clerk auth (mounted after
// clerkMiddleware() in server.js).
router.get("/", getRequests);
router.get("/:id", getRequestById);
router.put("/:id", updateStatus);
router.patch("/:id/approve", approveRequest);
router.patch("/:id/decline", declineRequest);
router.patch("/:id/seen", markSeen);
router.delete("/:id", deleteRequest);

module.exports = router;