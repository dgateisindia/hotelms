// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Dashboard routes working.' });
});

module.exports = router;