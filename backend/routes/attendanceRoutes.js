// ============================================================
//  attendanceRoute.js
//  Mount in your main app/server file with:
//    const attendanceRoute = require('./routes/attendanceRoute');
//    app.use('/api/attendance', attendanceRoute);
// ============================================================

const express = require('express');
const router = express.Router();
const {
  getAttendanceByDate,
  upsertAttendance,
} = require('../controllers/attendanceController'); // adjust path if your folder layout differs

// GET /api/attendance?date=YYYY-MM-DD
router.get('/', getAttendanceByDate);

// PUT /api/attendance/:staff_id
router.put('/:staff_id', upsertAttendance);

module.exports = router;