const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const { createStaffUser, getStaffUsers } = require('../controllers/userController');

router.post('/create-admin', protect, requireRole('super_admin'), createStaffUser);
router.get('/staff', protect, requireRole('super_admin'), getStaffUsers);

module.exports = router;