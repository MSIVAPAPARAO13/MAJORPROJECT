const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, validateBooking } = require("../middleware");
const bookingController = require("../controllers/bookingController");

// Booking routes nested under property (/listings/:id/bookings)
router.get("/new", isLoggedIn, wrapAsync(bookingController.renderNewBookingForm));
router.post("/", isLoggedIn, validateBooking, wrapAsync(bookingController.createBooking));

module.exports = router;
