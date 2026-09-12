const express = require("express");
const router = express.Router();
const payrollController = require("../controllers/payrollController");
const { requireClerkSession, attachDbUser, requireRole } = require("../middleware/roleMiddleware");

router.use(requireClerkSession, attachDbUser(), requireRole("admin"));

router.get("/", payrollController.getAllPayroll);
router.get("/:id", payrollController.getPayrollById);
router.post("/generate", payrollController.generatePayroll);
router.post("/", payrollController.createPayroll);
router.put("/:id", payrollController.updatePayroll);
router.delete("/:id", payrollController.deletePayroll);

module.exports = router;
