const express = require("express");
const router = express.Router();
const bookingController = require("../../controllers/bookingController");
const wrapAsync = require("../../utils/wrapAsync");
const {
  isLoggedIn,
  validateBooking,
  canAccessBooking,
  canCancelBooking,
  requirePermission
} = require("../../middleware");
const { PERMISSIONS } = require("../../config/permissions");

// POST /api/bookings - Atomic reservation creation with validation & serialization
router.post("/", isLoggedIn, validateBooking, wrapAsync(bookingController.createBooking));

// GET /api/bookings/my - Current guest reservations
router.get("/my", isLoggedIn, wrapAsync(bookingController.indexGuestBookings));

// GET /api/bookings/:bookingId - Reservation details
router.get("/:bookingId", isLoggedIn, canAccessBooking, wrapAsync(bookingController.showBooking));

// POST /api/bookings/:bookingId/cancel - Cancel reservation
router.post("/:bookingId/cancel", isLoggedIn, canCancelBooking, wrapAsync(bookingController.cancelBooking));

// PATCH /api/bookings/:bookingId/status - Update reservation status (restricted to staff/manager/admin)
router.patch(
  "/:bookingId/status",
  isLoggedIn,
  canAccessBooking,
  requirePermission(PERMISSIONS.BOOKING_UPDATE),
  wrapAsync(bookingController.updateStatus)
);

module.exports = router;
