const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customerController");
const {
  getCustomers,
  getCustomer,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
} = require("../controllers/customerController");

router.get("/stats", getCustomerStats);
router.get("/", getCustomers);
router.get("/:id", getCustomer);
router.post("/", addCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

module.exports = router;