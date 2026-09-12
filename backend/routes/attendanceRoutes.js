const express = require("express");
const router = express.Router();
const { getAttendanceByDate, upsertAttendance } = require("../controllers/attendanceController");
const { requireClerkSession, attachDbUser, requireRole } = require("../middleware/roleMiddleware");

router.use(requireClerkSession, attachDbUser(), requireRole("admin"));

router.get("/", getAttendanceByDate);
router.put("/:staff_id", upsertAttendance);

module.exports = router;
