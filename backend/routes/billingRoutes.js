const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");



// Dashboard
router.get("/stats", billingController.getBillingDashboard);
router.get("/revenue-chart", billingController.getRevenueChart);
router.get("/payment-methods", billingController.getPaymentMethods);
router.get("/recent-payments", billingController.getRecentPayments);

// Invoices
router.get("/invoices", billingController.getAllInvoices);
router.get("/invoices/:id", billingController.getInvoiceById);
router.post("/invoices", billingController.createInvoice);
router.put("/invoices/:id", billingController.updateInvoice);
router.delete("/invoices/:id", billingController.deleteInvoice);

module.exports = router;