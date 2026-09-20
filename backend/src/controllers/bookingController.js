const bookingService = require("../services/bookingService");
const listingService = require("../services/listingService");
const roomService = require("../services/roomService");

// Helper to determine if incoming request is an API / JSON request
const isApiRequest = (req) => {
  return (
    (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    (req.baseUrl && req.baseUrl.startsWith("/api/")) ||
    (req.accepts("json") && !req.accepts("html")) ||
    Boolean(req.xhr)
  );
};

// Render new booking checkout form
module.exports.renderNewBookingForm = async (req, res) => {
  const { id, roomId } = req.params;
  const { checkIn, checkOut, guests } = req.query;
  const listing = req.tenantResource || (await listingService.getListingById(id));
  const rooms = await roomService.getRoomsByProperty(id);

  let selectedRoom = null;
  const targetRoomId = roomId || req.query.roomId;
  if (targetRoomId) {
    selectedRoom = await roomService.getRoomById(targetRoomId);
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
  const payload = req.validatedBooking || (req.body.booking || req.body);
  
  // URL params take precedence for parent resources
  const propertyId = req.params.id || payload.propertyId;
  const roomId = req.params.roomId || payload.roomId;

  const booking = await bookingService.createBooking({
    ...payload,
    propertyId,
    roomId
  }, req.user);

  if (isApiRequest(req)) {
    return res.status(201).json({
      success: true,
      message: "Reservation successfully placed!",
      data: booking
    });
  }

  req.flash("success", "Reservation Placed! Your booking is currently pending confirmation.");
  res.redirect(`/bookings/${booking._id}`);
};

// View single booking confirmation / receipt
module.exports.showBooking = async (req, res) => {
  const bookingId = req.params.bookingId || req.params.id;
  const booking = req.booking || (await bookingService.getBookingById(bookingId));

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      data: booking
    });
  }

  res.render("bookings/show.ejs", { booking });
};

// List user's bookings (Customer reservations)
module.exports.indexGuestBookings = async (req, res) => {
  const bookings = await bookingService.getGuestBookings(req.user._id);

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  }

  res.render("bookings/index.ejs", { bookings });
};

// Cancel booking
module.exports.cancelBooking = async (req, res) => {
  const bookingId = req.params.bookingId || req.params.id;
  const booking = await bookingService.cancelBooking(bookingId, req.user._id, req.user.role);

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      message: "Booking has been cancelled.",
      data: booking
    });
  }

  req.flash("success", "Booking has been cancelled.");
  res.redirect("/bookings");
};

// Public Room Availability Check
module.exports.checkAvailability = async (req, res) => {
  const { roomId } = req.params;
  const { checkIn, checkOut } = req.query;

  const result = await bookingService.checkRoomAvailability(roomId, checkIn, checkOut);
  res.json({
    success: true,
    ...result
  });
};

// Update booking status (restricted to manager / owner / admin)
module.exports.updateStatus = async (req, res) => {
  const bookingId = req.params.bookingId || req.params.id;
  const { status } = req.body;
  const booking = await bookingService.updateBookingStatus(bookingId, status);

  res.json({
    success: true,
    message: `Booking status updated to ${status}`,
    data: booking
  });
};
