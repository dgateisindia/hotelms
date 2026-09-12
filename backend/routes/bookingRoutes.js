const express = require("express");

const router = express.Router();

const {
  changeBookingRoom,
  startTemporaryBookingRoomChange,
  markOriginalBookingRoomReady,
  returnBookingToOriginalRoom,
  stayInReplacementRoom,
} = require(
  "../controllers/booking/bookingRoomChangeController"
);


/* ============================================================
   CONTROLLERS
============================================================ */

const {
  getBookingStats,
  getBookings,
  getBooking,
  getReservationGroupDetails,
} = require(
  "../controllers/booking/bookingQueryController"
);

const {
  quoteBookingEditPrice,
  updateBooking,
} = require(
  "../controllers/booking/bookingEditController"
);

const {
  quoteBookingPrice,
  quoteReservationGroupRooms,
} = require(
  "../controllers/booking/bookingPricingController"
);

const {
  collectReservationGroupPayment,
  collectBookingPayment,
  refundNoShowOverpayment,
  refundCancellationOverpayment,
} = require(
  "../controllers/booking/bookingPaymentController"
);

const {
  cancelBooking,
} = require(
  "../controllers/booking/bookingCancellationController"
);

const {
  checkInBooking,
  extendStayBooking,
  checkoutBooking,
} = require(
  "../controllers/booking/bookingLifecycleController"
);

const {
  checkInBookingGuest,
  checkoutBookingGuest,
} = require(
  "../controllers/booking/bookingGuestController"
);

const {
  checkoutReservationGroup,
} = require(
  "../controllers/booking/bookingGroupController"
);

const {
  deleteBooking,
} = require(
  "../controllers/booking/bookingDeleteController"
);

const {
  addBooking,
  addReservationGroupRooms,
} = require(
  "../controllers/booking/bookingCreateController"
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
   CHANGE ROOM DURING ACTIVE STAY
============================================================ */

router.post(
  "/:id/change-room",
  changeBookingRoom
);

/* ============================================================
   START TEMPORARY ROOM CHANGE
============================================================ */

router.post(
  "/:id/temporary-room-change",
  startTemporaryBookingRoomChange
);

/* ============================================================
   MARK ORIGINAL ROOM READY
============================================================ */

router.post(
  "/:id/original-room-ready",
  markOriginalBookingRoomReady
);

/* ============================================================
   RETURN TO ORIGINAL ROOM
============================================================ */

router.post(
  "/:id/return-original-room",
  returnBookingToOriginalRoom
);

/* ============================================================
   STAY IN REPLACEMENT ROOM
============================================================ */

router.post(
  "/:id/stay-replacement",
  stayInReplacementRoom
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