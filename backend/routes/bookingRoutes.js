// backend/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();

// Placeholder route — replace with real controller later
router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Booking routes working.' });
});

module.exports = router;