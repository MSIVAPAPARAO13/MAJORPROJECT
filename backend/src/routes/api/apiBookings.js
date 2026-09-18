const express = require("express");
const router = express.Router();
const bookingService = require("../../services/bookingService");
const wrapAsync = require("../../utils/wrapAsync");

// POST /api/bookings - Atomic reservation creation
router.post(
  "/",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to make a booking" });
    }
    const booking = await bookingService.createBooking(req.body.booking, req.user);
    res.status(201).json({
      success: true,
      message: "Booking confirmed successfully!",
      data: booking,
    });
  })
);

// GET /api/bookings/my - Fetch current user's reservations
router.get(
  "/my",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to view bookings" });
    }
    const bookings = await bookingService.getUserBookings(req.user._id);
    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  })
);

module.exports = router;
