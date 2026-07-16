const express = require('express');
const router = express.Router();
const { attachDbUser, requireRole } = require('../middleware/roleMiddleware');
const { getSuperAdminStats, getAdminsStatus } = require('../controllers/dashboardController');

router.get('/super-admin-stats', attachDbUser(), requireRole('super_admin'), getSuperAdminStats);
router.get('/admins-status', attachDbUser(), requireRole('super_admin'), getAdminsStatus);

module.exports = router;