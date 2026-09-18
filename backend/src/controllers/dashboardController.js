const organizationService = require("../services/organizationService");
const bookingService = require("../services/bookingService");
const Review = require("../models/review");

module.exports.renderDashboard = async (req, res) => {
  const user = req.user;

  // 1. ADMIN Dashboard
  if (user.role === "ADMIN") {
    const metrics = await organizationService.getAdminDashboardMetrics();
    return res.render("dashboard/admin.ejs", { metrics });
  }

  // 2. OWNER / MANAGER Dashboard
  if (user.role === "OWNER" || user.role === "MANAGER") {
    const metrics = await organizationService.getOwnerDashboardMetrics(user._id);
    return res.render("dashboard/owner.ejs", { metrics });
  }

  // 3. CUSTOMER Dashboard (default)
  const bookings = await bookingService.getGuestBookings(user._id);
  const reviews = await Review.find({ author: user._id }).populate("author");
  return res.render("dashboard/customer.ejs", { user, bookings, reviews });
};
