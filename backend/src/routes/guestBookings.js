const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookingController");

// List logged-in user's bookings
router.get("/", isLoggedIn, wrapAsync(bookingController.indexGuestBookings));

// View single booking details
router.get("/:bookingId", isLoggedIn, wrapAsync(bookingController.showBooking));

// Cancel booking
router.post("/:bookingId/cancel", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;
