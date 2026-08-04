// ============================================================
//  staffRoutes.js — Staff routes
//  Mount in your main app/server file with:
//    const staffRoutes = require('./routes/staffRoutes');
//    app.use('/api/staff', staffRoutes);
// ============================================================

const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// If your other routes use an auth/role-check middleware
// (e.g. verifyToken, requireRole('admin')), wire it in here
// the same way the rest of HotelierPMS's protected routes do:
// const { verifyToken } = require('../middleware/authMiddleware');
// router.use(verifyToken);

router.get('/', staffController.getAllStaff);
router.get('/:id', staffController.getStaffById);
router.post('/', staffController.createStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;