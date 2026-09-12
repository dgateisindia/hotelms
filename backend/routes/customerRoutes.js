const express = require("express");

const router =
  express.Router();


const {
  getCustomers,
  getCustomer,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
  lookupCustomerByPhone,
} = require(
  "../controllers/customerController"
);


/* ============================================================
   STATIC ROUTES

   Important:
   These must stay before "/:id".
============================================================ */

router.get(
  "/lookup",
  lookupCustomerByPhone
);


router.get(
  "/stats",
  getCustomerStats
);


/* ============================================================
   CUSTOMER CRUD
============================================================ */

router.get(
  "/",
  getCustomers
);


router.post(
  "/",
  addCustomer
);


router.get(
  "/:id",
  getCustomer
);


router.put(
  "/:id",
  updateCustomer
);


router.delete(
  "/:id",
  deleteCustomer
);


module.exports =
  router;