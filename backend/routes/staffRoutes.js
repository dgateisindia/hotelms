const express = require("express");
const router = express.Router();

const staffController = require("../controllers/staffController");

const {
  requireClerkSession,
  attachDbUser,
  requireRole,
} = require("../middleware/roleMiddleware");

/*
 * Staff is hotel-operational data.
 *
 * Trusted tenant context:
 * req.dbUser.hotelId
 * req.dbUser.adminId
 *
 * Never accept hotel_id/admin_id from frontend.
 */
router.use(
  requireClerkSession,
  attachDbUser(),
  requireRole("admin")
);

router.get("/", staffController.getAllStaff);
router.get("/:id", staffController.getStaffById);
router.post("/", staffController.createStaff);
router.put("/:id", staffController.updateStaff);
router.delete("/:id", staffController.deleteStaff);

module.exports = router;
