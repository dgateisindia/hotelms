const express = require("express");
const router = express.Router();

console.log("BOOKING ROUTES LOADED");

const {
  getBookingStats,
  getBookings,
  getBooking,
  addBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
} = require("../controllers/bookingController");
console.log({
  getBookingStats,
  getBookings,
  getBooking,
  addBooking,
  updateBooking,
  cancelBooking,
  deleteBooking,
});
// Statistics
router.get("/stats", getBookingStats);

// Get all bookings
router.get("/", getBookings);

// Get single booking
router.get("/:id", getBooking);

// Add booking
router.post("/", addBooking);

// Update booking
router.put("/:id", updateBooking);

// Cancel booking
router.put("/:id/cancel", cancelBooking);

// Delete booking
router.delete("/:id", deleteBooking);

module.exports = router;