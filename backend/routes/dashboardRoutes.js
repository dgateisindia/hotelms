
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const { getSuperAdminStats, getAdminsStatus } = require('../controllers/dashboardController');

router.get('/super-admin-stats', protect, requireRole('super_admin'), getSuperAdminStats);
router.get('/admins-status', protect, requireRole('super_admin'), getAdminsStatus);

module.exports = router;