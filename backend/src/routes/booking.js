const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, validateBooking } = require("../middleware");
const bookingController = require("../controllers/bookingController");

// Render checkout form for property/room (/listings/:id/bookings/new or /listings/:id/rooms/:roomId/bookings/new)
router.get("/new", isLoggedIn, wrapAsync(bookingController.renderNewBookingForm));

// Create reservation
router.post("/", isLoggedIn, validateBooking, wrapAsync(bookingController.createBooking));

module.exports = router;
