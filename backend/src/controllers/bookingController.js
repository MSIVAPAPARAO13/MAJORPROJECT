const bookingService = require("../services/bookingService");
const listingService = require("../services/listingService");
const roomService = require("../services/roomService");
const Booking = require("../models/booking");

// Render new booking checkout form
module.exports.renderNewBookingForm = async (req, res) => {
  const { id } = req.params;
  const { roomId, checkIn, checkOut, guests } = req.query;
  const listing = await listingService.getListingById(id);
  const rooms = await roomService.getRoomsByProperty(id);

  let selectedRoom = null;
  if (roomId) {
    selectedRoom = await roomService.getRoomById(roomId);
  } else if (rooms.length > 0) {
    selectedRoom = rooms[0];
  }

  res.render("bookings/new.ejs", {
    listing,
    rooms,
    selectedRoom,
    queryCheckIn: checkIn || "",
    queryCheckOut: checkOut || "",
    queryGuests: guests || 1
  });
};

// Create a new booking
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { roomId, checkIn, checkOut, guestsCount, guestName, guestEmail, guestPhone, specialRequests } = req.body.booking;

  const booking = await bookingService.createBooking({
    propertyId: id,
    roomId,
    guestId: req.user._id,
    checkIn,
    checkOut,
    guestsCount: Number(guestsCount),
    guestDetails: {
      name: guestName,
      email: guestEmail,
      phone: guestPhone
    },
    specialRequests
  });

  req.flash("success", "Reservation Confirmed! Your booking is successfully placed.");
  res.redirect(`/bookings/${booking._id}`);
};

// View single booking confirmation
module.exports.showBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId)
    .populate("property")
    .populate("room")
    .populate("guest");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/dashboard");
  }

  // Ensure authorized (guest, property owner, or admin)
  const isGuest = booking.guest.equals(req.user._id);
  const isOwner = booking.property && booking.property.owner && booking.property.owner.equals(req.user._id);
  const isAdmin = req.user.role === "ADMIN";

  if (!isGuest && !isOwner && !isAdmin) {
    req.flash("error", "You are not authorized to view this booking");
    return res.redirect("/listings");
  }

  res.render("bookings/show.ejs", { booking });
};

// List user's bookings (Customer bookings)
module.exports.indexGuestBookings = async (req, res) => {
  const bookings = await bookingService.getGuestBookings(req.user._id);
  res.render("bookings/index.ejs", { bookings });
};

// Cancel booking
module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  await bookingService.cancelBooking(bookingId, req.user._id, req.user.role);
  req.flash("success", "Booking has been cancelled.");
  res.redirect("/dashboard");
};
