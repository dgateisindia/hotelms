// ============================================================
//  payrollRoutes.js — /api/payroll
//
//  NOTE: wire in the same auth chain the rest of the app uses
//  (Clerk requireAuth() + attachDbUser + requireRole), the same
//  way userRoutes.js / dashboardRoutes.js do. Left commented out
//  here since the exact middleware names/paths weren't in scope
//  for this file — plug them in to match attendanceRoutes.js etc.
// ============================================================

const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

// const { requireAuth } = require('@clerk/express');
// const { attachDbUser, requireRole } = require('../middleware/roleMiddleware');
// router.use(requireAuth(), attachDbUser, requireRole('admin', 'accountant'));

router.get('/', payrollController.getAllPayroll);
router.get('/:id', payrollController.getPayrollById);
router.post('/generate', payrollController.generatePayroll);
router.post('/', payrollController.createPayroll);
router.put('/:id', payrollController.updatePayroll);
router.delete('/:id', payrollController.deletePayroll);

module.exports = router;

// In your main server file (e.g. server.js / app.js), mount this with:
//   const payrollRoutes = require('./routes/payrollRoutes');
//   app.use('/api/payroll', payrollRoutes);