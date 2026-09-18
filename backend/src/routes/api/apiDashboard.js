const express = require("express");
const router = express.Router();
const organizationService = require("../../services/organizationService");
const bookingService = require("../../services/bookingService");
const Listing = require("../../models/listing");
const wrapAsync = require("../../utils/wrapAsync");

// GET /api/dashboard/metrics
router.get(
  "/metrics",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in" });
    }

    if (req.user.role === "ADMIN") {
      const metrics = await organizationService.getPlatformMetrics();
      return res.json({ success: true, role: "ADMIN", data: metrics });
    }

    if (req.user.role === "OWNER" || req.user.role === "MANAGER") {
      const metrics = await organizationService.getTenantMetrics(req.user);
      return res.json({ success: true, role: req.user.role, data: metrics });
    }

    // Customer metrics
    const bookings = await bookingService.getUserBookings(req.user._id);
    return res.json({
      success: true,
      role: "CUSTOMER",
      data: {
        totalTrips: bookings.length,
        bookings,
      },
    });
  })
);

module.exports = router;
