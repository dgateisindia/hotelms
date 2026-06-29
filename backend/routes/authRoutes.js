const express = require('express');
const router = express.Router();

const {
  login,
  register,
  refreshToken,
  registerSuperAdmin,
  registerAdmin,
  createHotel,
} = require('../controllers/authController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/refresh-token', refreshToken);
router.post('/login', login);

router.post('/register-super-admin', registerSuperAdmin);
router.post('/create-hotel', protect, requireRole('super_admin'), createHotel);
router.post('/register-admin', protect, requireRole('super_admin'), registerAdmin);

module.exports = router;