const express = require('express');
const router = express.Router();
const { getReportsOverview } = require('../controllers/reportsController');

// GET /api/reports/overview?period=daily|weekly|monthly
router.get('/overview', getReportsOverview);

module.exports = router;