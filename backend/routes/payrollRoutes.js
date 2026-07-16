const express = require("express");
const router = express.Router();

const payrollController = require("../controllers/payrollController");

router.get("/", payrollController.getPayrolls);

router.post("/", payrollController.addPayroll);

router.put("/:id", payrollController.updatePayroll);

router.delete("/:id", payrollController.deletePayroll);

module.exports = router;