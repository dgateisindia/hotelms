const express = require('express');
const router = express.Router();
const { attachDbUser, requireRole } = require('../middleware/roleMiddleware');
const { getSuperAdminStats, getAdminsStatus, getAdminDailyStats } = require('../controllers/dashboardController');


router.get('/super-admin-stats', attachDbUser(), requireRole('super_admin'), getSuperAdminStats);
router.get('/admins-status', attachDbUser(), requireRole('super_admin'), getAdminsStatus);
router.get('/admin-daily-stats', attachDbUser(), requireRole('admin'), getAdminDailyStats);

module.exports = router;
