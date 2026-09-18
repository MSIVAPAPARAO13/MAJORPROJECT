const Booking = require("../models/booking");
const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Verify if a room is available for the given date range
async function isRoomAvailable(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new ExpressError("Invalid check-in or check-out date", 400);
  }

  if (checkIn >= checkOut) {
    throw new ExpressError("Check-out date must be strictly after check-in date", 400);
  }

  const query = {
    room: roomId,
    status: { $in: ["CONFIRMED", "PENDING"] },
    // Strict date overlap: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn }
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBooking = await Booking.findOne(query);
  return !conflictingBooking;
}

// Calculate night duration between two dates
function calculateNights(checkInDate, checkOutDate) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const diffTime = Math.abs(checkOut - checkIn);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Create a new booking
async function createBooking({ propertyId, roomId, guestId, checkIn, checkOut, guestsCount, guestDetails, specialRequests }) {
  const room = await Room.findById(roomId).populate("property");
  if (!room) {
    throw new ExpressError("Selected room does not exist", 404);
  }

  if (guestsCount > room.capacity) {
    throw new ExpressError(`This room has a maximum capacity of ${room.capacity} guests`, 400);
  }

  const available = await isRoomAvailable(roomId, checkIn, checkOut);
  if (!available) {
    throw new ExpressError("This room is already booked for the selected dates. Please choose different dates or another room.", 409);
  }

  const totalNights = calculateNights(checkIn, checkOut);
  const pricePerNight = room.price;
  const totalPrice = totalNights * pricePerNight;

  const property = await Listing.findById(propertyId);

  const booking = new Booking({
    organization: property ? property.organization : null,
    property: propertyId,
    room: roomId,
    guest: guestId,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    guestsCount,
    totalNights,
    pricePerNight,
    totalPrice,
    status: "CONFIRMED",
    guestDetails,
    specialRequests
  });

  await booking.save();
  return booking;
}

// Cancel a booking
async function cancelBooking(bookingId, userId, userRole) {
  const booking = await Booking.findById(bookingId).populate("property");
  if (!booking) {
    throw new ExpressError("Booking not found", 404);
  }

  // Authorization check: guest who booked, property owner, or ADMIN can cancel
  const isGuest = booking.guest.equals(userId);
  const isOwner = booking.property && booking.property.owner && booking.property.owner.equals(userId);
  const isAdmin = userRole === "ADMIN";

  if (!isGuest && !isOwner && !isAdmin) {
    throw new ExpressError("You are not authorized to cancel this booking", 403);
  }

  booking.status = "CANCELLED";
  await booking.save();
  return booking;
}

// Get guest bookings
async function getGuestBookings(guestId) {
  return await Booking.find({ guest: guestId })
    .populate("property")
    .populate("room")
    .sort({ createdAt: -1 });
}

// Get bookings for properties owned by a user / organization
async function getOwnerBookings(ownerId) {
  const properties = await Listing.find({ owner: ownerId }).select("_id");
  const propertyIds = properties.map(p => p._id);

  return await Booking.find({ property: { $in: propertyIds } })
    .populate("property")
    .populate("room")
    .populate("guest")
    .sort({ createdAt: -1 });
}

module.exports = {
  isRoomAvailable,
  calculateNights,
  createBooking,
  cancelBooking,
  getGuestBookings,
  getOwnerBookings
};
