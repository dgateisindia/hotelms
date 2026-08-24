const express = require("express");

const router = express.Router();


/* ============================================================
   CONTROLLERS
============================================================ */

const {
  getBookingStats,
  getBookings,
  getBooking,
  getReservationGroupDetails,
  quoteBookingPrice,
  quoteBookingEditPrice,
  addBooking,
  addReservationGroupRooms,
  updateBooking,
  checkInBooking,
  extendStayBooking,
  collectBookingPayment,
  checkoutBooking,
  cancelBooking,
  deleteBooking,
} = require(
  "../controllers/bookingController"
);


/* ============================================================
   BOOKING STATISTICS
============================================================ */

router.get(
  "/stats",
  getBookingStats
);


/* ============================================================
   BOOKING LIST
============================================================ */

router.get(
  "/",
  getBookings
);

/* ============================================================
   BOOKING PRICE QUOTE
============================================================ */

router.post(
  "/quote",
  quoteBookingPrice
);

/* ============================================================
   EXISTING BOOKING EDIT PRICE QUOTE
============================================================ */

router.post(
  "/:id/quote",
  quoteBookingEditPrice
);

/* ============================================================
   ADD ROOM(S) TO RESERVATION GROUP
============================================================ */

router.post(
  "/groups/:groupId/rooms",
  addReservationGroupRooms
);

/* ============================================================
   RESERVATION GROUP DETAILS

   Must stay before /:id.
============================================================ */

router.get(
  "/groups/:groupId",
  getReservationGroupDetails
);

/* ============================================================
   SINGLE BOOKING
============================================================ */

router.get(
  "/:id",
  getBooking
);


/* ============================================================
   CREATE BOOKING
============================================================ */

router.post(
  "/",
  addBooking
);


/* ============================================================
   UPDATE BOOKING
============================================================ */

router.put(
  "/:id",
  updateBooking
);

/* ============================================================
   CHECK IN BOOKING
============================================================ */

router.post(
  "/:id/check-in",
  checkInBooking
);

/* ============================================================
   EXTEND STAY
============================================================ */

router.post(
  "/:id/extend-stay",
  extendStayBooking
);

/* ============================================================
   COLLECT BOOKING PAYMENT
============================================================ */

router.post(
  "/:id/payments",
  collectBookingPayment
);

/* ============================================================
   CHECKOUT BOOKING
============================================================ */

router.post(
  "/:id/checkout",
  checkoutBooking
);

/* ============================================================
   CANCEL BOOKING
============================================================ */

router.put(
  "/:id/cancel",
  cancelBooking
);


/* ============================================================
   DELETE BOOKING
============================================================ */

router.delete(
  "/:id",
  deleteBooking
);


module.exports = router;