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
  quoteReservationGroupRooms,
  quoteBookingEditPrice,
  addBooking,
  addReservationGroupRooms,
  updateBooking,
  checkInBooking,
  checkInBookingGuest,
  checkoutBookingGuest,
  extendStayBooking,
  collectReservationGroupPayment,
  checkoutReservationGroup,
  collectBookingPayment,
  refundNoShowOverpayment,
  refundCancellationOverpayment,
  checkoutBooking,
  cancelBooking,
  deleteBooking,
} = require(
  "../controllers/bookingController"
);


const {
  getFinancialSettlementReview,
  finalizeFinancialSettlementReview,
} = require(
  "../controllers/bookingFinancialSettlementController"
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
   ADD ROOM PRICE QUOTE
============================================================ */

router.post(
  "/groups/:groupId/rooms/quote",
  quoteReservationGroupRooms
);

/* ============================================================
   ADD ROOM(S) TO RESERVATION GROUP
============================================================ */

router.post(
  "/groups/:groupId/rooms",
  addReservationGroupRooms
);

/* ============================================================
   COLLECT RESERVATION GROUP PAYMENT
============================================================ */

router.post(
  "/groups/:groupId/payments",
  collectReservationGroupPayment
);

/* ============================================================
   CHECKOUT RESERVATION GROUP

   booking_ids omitted / []:
   → all currently checked-in rooms

   booking_ids supplied:
   → selected checked-in rooms only
============================================================ */

router.post(
  "/groups/:groupId/checkout",
  checkoutReservationGroup
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
   CHECK IN INDIVIDUAL GUEST

   Room-first / guests-later flow.

   Existing expected guest:
   booking_guest_id

   New arriving guest:
   guest_role + guest
============================================================ */

router.post(
  "/:id/guests/check-in",
  checkInBookingGuest
);

/* ============================================================
   CHECK OUT INDIVIDUAL GUEST

   Only the selected staying guest leaves.
   Room booking remains checked_in until formal room checkout.
============================================================ */

router.post(
  "/:id/guests/:guestId/checkout",
  checkoutBookingGuest
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
   REFUND NO-SHOW OVERPAYMENT
============================================================ */

router.post(
  "/:id/no-show-refund",
  refundNoShowOverpayment
);

/* ============================================================
   REFUND CANCELLATION OVERPAYMENT
============================================================ */

router.post(
  "/:id/cancellation-refund",
  refundCancellationOverpayment
);

/* ============================================================
   FINANCIAL SETTLEMENT REVIEW
============================================================ */

router.get(
  "/:id/financial-settlement-review",
  getFinancialSettlementReview
);

router.post(
  "/:id/financial-settlement-review/finalize",
  finalizeFinancialSettlementReview
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