const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, canAccessBooking, canCancelBooking } = require("../middleware");
const bookingController = require("../controllers/bookingController");

// List logged-in user's bookings
router.get("/", isLoggedIn, wrapAsync(bookingController.indexGuestBookings));

// View single booking details (Protected by customer ownership or staff/admin tenant access)
router.get("/:bookingId", isLoggedIn, canAccessBooking, wrapAsync(bookingController.showBooking));

// Cancel booking (Protected by customer ownership or manager/owner/admin)
router.post("/:bookingId/cancel", isLoggedIn, canCancelBooking, wrapAsync(bookingController.cancelBooking));

module.exports = router;
