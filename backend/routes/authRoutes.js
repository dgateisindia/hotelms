const express = require('express');
const router = express.Router();

const {
  registerSuperAdmin,
  registerAdmin,
  createHotel,
  clearMustChangePassword,
} = require('../controllers/authController');
const { requireAuth } = require('@clerk/express');
const { attachDbUser, requireRole } = require('../middleware/roleMiddleware');

router.post('/register-super-admin', registerSuperAdmin);

router.post(
  '/create-hotel',
  requireAuth(),
  attachDbUser(),
  requireRole('super_admin'),   
  createHotel
);

router.post(
  '/register-admin',
  requireAuth(),
  attachDbUser(),
  requireRole('super_admin'),  
  registerAdmin
);

router.get('/me', requireAuth(), attachDbUser(), (req, res) => {
  res.json({ success: true, user: req.dbUser });
});

router.post('/clear-must-change-password', requireAuth(), attachDbUser(), clearMustChangePassword);

module.exports = router;