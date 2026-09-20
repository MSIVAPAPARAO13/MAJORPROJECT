const mongoose = require("mongoose");
const Booking = require("../models/booking");
const ExpressError = require("../utils/ExpressError");

const isJsonRequest = (req) => {
  return Boolean(
    (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    (req.baseUrl && req.baseUrl.startsWith("/api/")) ||
    (typeof req.accepts === "function" && req.accepts("json") && !req.accepts("html")) ||
    req.xhr
  );
};

/**
 * Ensures user is authorized to access a specific booking:
 * - Direct customer/guest who made the reservation
 * - Organization OWNER, MANAGER, or STAFF for the booking's property
 * - System ADMIN
 */
async function canAccessBooking(req, res, next) {
  const bookingId = req.params.bookingId || req.params.id;

  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    if (isJsonRequest(req)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }
    throw new ExpressError("Invalid booking ID", 400);
  }

  const booking = await Booking.findById(bookingId)
    .populate("property")
    .populate("room")
    .populate("guest");

  if (!booking) {
    if (isJsonRequest(req)) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "Booking not found");
      return res.redirect("/bookings");
    }
    throw new ExpressError("Booking not found", 404);
  }

  const isGuest = req.user && booking.guest && (booking.guest._id ? booking.guest._id.equals(req.user._id) : booking.guest.equals(req.user._id));
  const isAdmin = req.user && req.user.role === "ADMIN";
  const isOrgStaff = req.user && req.user.organization && booking.organization &&
    booking.organization.equals(req.user.organization) &&
    ["OWNER", "MANAGER", "STAFF"].includes(req.user.role);

  if (!isGuest && !isAdmin && !isOrgStaff) {
    if (isJsonRequest(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to view this booking" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "You do not have permission to access that reservation.");
      return res.redirect("/listings");
    }
    throw new ExpressError("Forbidden: You are not authorized to view this booking", 403);
  }

  req.booking = booking;
  next();
}

/**
 * Ensures user is authorized to cancel the booking:
 * - Customer can only cancel their own booking, and only when status is PENDING or CONFIRMED
 * - Org staff/manager/owner can cancel within their organization
 * - ADMIN can cancel any booking
 * - Completed and already cancelled bookings cannot be cancelled
 */
async function canCancelBooking(req, res, next) {
  const bookingId = req.params.bookingId || req.params.id;

  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    if (isJsonRequest(req)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }
    throw new ExpressError("Invalid booking ID", 400);
  }

  const booking = req.booking || (await Booking.findById(bookingId).populate("property"));
  if (!booking) {
    if (isJsonRequest(req)) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "Booking not found");
      return res.redirect("/bookings");
    }
    throw new ExpressError("Booking not found", 404);
  }

  // Check valid status transitions
  if (booking.status === "COMPLETED") {
    if (isJsonRequest(req)) {
      return res.status(400).json({ success: false, message: "Completed bookings cannot be cancelled" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "Completed bookings cannot be cancelled");
      return res.redirect(`/bookings/${booking._id}`);
    }
    throw new ExpressError("Completed bookings cannot be cancelled", 400);
  }

  if (booking.status === "CANCELLED") {
    if (isJsonRequest(req)) {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "Booking is already cancelled");
      return res.redirect(`/bookings/${booking._id}`);
    }
    throw new ExpressError("Booking is already cancelled", 400);
  }

  const isGuest = req.user && booking.guest && (booking.guest._id ? booking.guest._id.equals(req.user._id) : booking.guest.equals(req.user._id));
  const isAdmin = req.user && req.user.role === "ADMIN";
  const isOrgStaff = req.user && req.user.organization && booking.organization &&
    booking.organization.equals(req.user.organization) &&
    ["OWNER", "MANAGER", "STAFF"].includes(req.user.role);

  if (!isGuest && !isAdmin && !isOrgStaff) {
    if (isJsonRequest(req)) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to cancel this booking" });
    }
    if (typeof req.flash === "function") {
      req.flash("error", "You do not have permission to cancel that reservation.");
      return res.redirect("/listings");
    }
    throw new ExpressError("Forbidden: You are not authorized to cancel this booking", 403);
  }

  req.booking = booking;
  next();
}

module.exports = {
  canAccessBooking,
  canCancelBooking
};
