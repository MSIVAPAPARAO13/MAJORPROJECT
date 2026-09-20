const Booking = require("../models/booking");
const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

/**
 * ARCHITECTURE NOTICE — CONCURRENCY:
 * The current development MongoDB environment is standalone and does not support
 * multi-document MongoDB transactions (session.startTransaction).
 *
 * A per-room in-memory async mutex queue is used for this single-Node-process
 * environment to serialize concurrent booking requests for the same room.
 *
 * CRITICAL LIMITATION — PROCESS-LOCAL ONLY:
 * 1. This mutex is strictly PROCESS-LOCAL (single Node.js process).
 * 2. It guarantees serialization of concurrent booking requests within the same Node.js process.
 * 3. It DOES NOT provide protection across multiple Node.js instances, clustered workers,
 *    or serverless environments.
 * 4. We DO NOT claim protection across multiple Node.js instances.
 * 5. We DO NOT implement a fake transaction API on standalone MongoDB.
 *
 * REQUIRED FUTURE MULTI-INSTANCE PRODUCTION DEPLOYMENT ARCHITECTURE:
 * For true multi-instance production deployment, the required architecture is:
 *
 *      MongoDB Replica Set
 *              ↓
 *      MongoDB Transaction / appropriate atomic reservation strategy
 *              ↓
 *      Availability Check + Booking Creation
 *
 *      OR a properly designed shared distributed locking mechanism (e.g., Redis Redlock / distributed reservation locks).
 *
 * Do not silently treat an in-memory mutex as a distributed lock.
 */
const roomLocks = new Map();

async function withRoomLock(roomId, fn) {
  const key = roomId.toString();
  const currentLock = roomLocks.get(key) || Promise.resolve();

  let releaseLock;
  const nextLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  // Chain this operation behind any pending operation on the same room
  roomLocks.set(key, currentLock.then(() => nextLock));

  try {
    await currentLock;
    return await fn();
  } finally {
    releaseLock();
    // Clean up map entry if this was the last queued operation
    if (roomLocks.get(key) === nextLock) {
      roomLocks.delete(key);
    }
  }
}

// Calculate night duration between two dates
function calculateNights(checkInDate, checkOutDate) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const diffTime = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Generate unique human-friendly booking reference number
function generateBookingNumber() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `WL-${timestampPart}-${randomPart}`;
}

// Verify if a room is available for the given date range using half-open interval [checkIn, checkOut)
async function isRoomAvailable(roomId, checkInDate, checkOutDate, excludeBookingId = null) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new ExpressError("Invalid check-in or check-out date", 400);
  }

  if (checkOut <= checkIn) {
    throw new ExpressError("Check-out date must be strictly after check-in date", 400);
  }

  const query = {
    room: roomId,
    // Only active reservations block availability (CANCELLED and COMPLETED do not block)
    status: { $in: ["PENDING", "CONFIRMED"] },
    // Half-open interval overlap condition:
    // existing.checkIn < requestedCheckOut AND existing.checkOut > requestedCheckIn
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn }
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBooking = await Booking.findOne(query);
  return !conflictingBooking;
}

// Public room availability inquiry (sanitized - zero customer data leaked)
async function checkRoomAvailability(roomId, checkInDate, checkOutDate) {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }

  const available = await isRoomAvailable(roomId, checkInDate, checkOutDate);
  const totalNights = calculateNights(checkInDate, checkOutDate);
  const estimatedTotal = totalNights > 0 ? totalNights * room.price : 0;

  return {
    available,
    roomId: room._id,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    capacity: room.capacity,
    pricePerNight: room.price,
    totalNights,
    estimatedTotal
  };
}

// Create a new booking with process-local serialization & server-side pricing
async function createBooking(bookingPayload, user) {
  const { propertyId, roomId, checkIn, checkOut, guestsCount, guestDetails, specialRequests } = bookingPayload;

  // 1. Validate property & room existence
  const room = await Room.findById(roomId).populate("property");
  if (!room) {
    throw new ExpressError("Selected room does not exist", 404);
  }

  // 2. Verify parent resource relationship (Room must belong to property if propertyId is supplied)
  if (propertyId && room.property._id.toString() !== propertyId.toString()) {
    throw new ExpressError("Resource mismatch: Room does not belong to the specified property", 400);
  }

  // 3. Validate capacity server-side
  const count = Number(guestsCount);
  if (!count || count < 1) {
    throw new ExpressError("Guest count must be at least 1", 400);
  }
  if (count > room.capacity) {
    throw new ExpressError(`Guest count exceeds room capacity of ${room.capacity}`, 400);
  }

  // 4. Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    throw new ExpressError("Invalid check-in or check-out date", 400);
  }
  if (checkOutDate <= checkInDate) {
    throw new ExpressError("Check-out date must be strictly after check-in date", 400);
  }

  // 5. Critical Section: Serialize availability check and creation per room
  return await withRoomLock(roomId, async () => {
    // Check room availability inside the locked critical section
    const available = await isRoomAvailable(roomId, checkInDate, checkOutDate);
    if (!available) {
      throw new ExpressError("This room is already booked for the selected dates. Please choose different dates or another room.", 409);
    }

    // 6. Calculate pricing entirely server-side
    const totalNights = calculateNights(checkInDate, checkOutDate);
    const pricePerNight = room.price;
    const totalPrice = totalNights * pricePerNight;

    // 7. Derive authoritative tenant organization from room/property
    const organization = room.organization || (room.property && room.property.organization) || null;

    // 8. Construct new booking
    const booking = new Booking({
      bookingNumber: generateBookingNumber(),
      organization,
      property: room.property._id,
      room: room._id,
      guest: user._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guestsCount: count,
      totalNights,
      pricePerNight,
      totalPrice,
      status: "PENDING", // Server-controlled default status
      guestDetails: {
        name: (guestDetails && guestDetails.name) || bookingPayload.guestName || user.username || "Guest",
        email: (guestDetails && guestDetails.email) || bookingPayload.guestEmail || user.email || "guest@example.com",
        phone: (guestDetails && guestDetails.phone) || bookingPayload.guestPhone || user.phone || "0000000000"
      },
      specialRequests: specialRequests || bookingPayload.specialRequests || ""
    });

    await booking.save();
    return booking;
  });
}

// Cancel a booking
async function cancelBooking(bookingId, userId, userRole) {
  const booking = await Booking.findById(bookingId).populate("property");
  if (!booking) {
    throw new ExpressError("Booking not found", 404);
  }

  if (booking.status === "COMPLETED") {
    throw new ExpressError("Completed bookings cannot be cancelled", 400);
  }
  if (booking.status === "CANCELLED") {
    throw new ExpressError("Booking is already cancelled", 400);
  }

  // Authorization check
  const isGuest = booking.guest.equals(userId);
  const isOrgStaff = booking.property && booking.property.owner && booking.property.owner.equals(userId);
  const isAdmin = userRole === "ADMIN";

  if (!isGuest && !isOrgStaff && !isAdmin) {
    throw new ExpressError("You are not authorized to cancel this booking", 403);
  }

  booking.status = "CANCELLED";
  await booking.save();
  return booking;
}

// Update booking status (restricted to manager/owner/admin)
async function updateBookingStatus(bookingId, newStatus) {
  const allowedStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
  if (!allowedStatuses.includes(newStatus)) {
    throw new ExpressError("Invalid booking status", 400);
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ExpressError("Booking not found", 404);
  }

  booking.status = newStatus;
  await booking.save();
  return booking;
}

// Get single booking by ID with populated relations
async function getBookingById(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate("property")
    .populate("room")
    .populate("guest");
  if (!booking) {
    throw new ExpressError("Booking not found", 404);
  }
  return booking;
}

// Get customer bookings
async function getGuestBookings(guestId) {
  return await Booking.find({ guest: guestId })
    .populate("property")
    .populate("room")
    .sort({ createdAt: -1 });
}

// Get organization bookings for property managers / owners
async function getOrganizationBookings(organizationId) {
  return await Booking.find({ organization: organizationId })
    .populate("property")
    .populate("room")
    .populate("guest")
    .sort({ createdAt: -1 });
}

module.exports = {
  calculateNights,
  generateBookingNumber,
  isRoomAvailable,
  checkRoomAvailability,
  createBooking,
  cancelBooking,
  updateBookingStatus,
  getBookingById,
  getGuestBookings,
  getOrganizationBookings
};
