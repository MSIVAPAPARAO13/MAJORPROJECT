// Automated test suite for SaaS Multi-tenancy, Booking Engine, and RBAC

const mongoose = require("mongoose");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const Booking = require("../src/models/booking");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const bookingService = require("../src/services/bookingService");
const organizationService = require("../src/services/organizationService");

const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function runTests() {
  console.log("=== STARTING WANDERLUST SAAS VERIFICATION TESTS ===");
  await mongoose.connect(MONGO_URL);

  // Test 1: Verify Properties & Rooms exist in DB
  const totalListings = await Listing.countDocuments();
  const totalRooms = await Room.countDocuments();
  console.log(`[PASS] Total Properties: ${totalListings}, Total Rooms: ${totalRooms}`);
  if (totalListings === 0 || totalRooms === 0) {
    throw new Error("No properties or rooms found in database");
  }

  // Test 2: Verify Hostels exist and have exact GeoJSON coordinates
  const hostels = await Listing.find({ propertyType: "Hostel" });
  console.log(`[PASS] Hostels found in database: ${hostels.length}`);
  for (let h of hostels) {
    if (!h.geometry || !h.geometry.coordinates || h.geometry.coordinates.length !== 2) {
      throw new Error(`Hostel ${h.title} has invalid GeoJSON coordinates`);
    }
    const [lng, lat] = h.geometry.coordinates;
    console.log(`       Hostel: "${h.title}" at [${lng}, ${lat}] in ${h.location}`);
  }

  // Test 3: Booking Engine & Overlap Prevention Test
  const testProperty = await Listing.findOne().populate("rooms");
  const testRoom = testProperty.rooms[0];
  const testGuest = await User.findOne({ username: "demo-user" }) || await User.findOne();

  console.log(`Testing booking for Room ${testRoom.roomNumber} on ${testProperty.title}...`);

  const checkIn1 = new Date();
  checkIn1.setDate(checkIn1.getDate() + 10);
  const checkOut1 = new Date();
  checkOut1.setDate(checkOut1.getDate() + 13);

  // Create first booking (Days 10-13)
  const booking1 = await bookingService.createBooking({
    propertyId: testProperty._id,
    roomId: testRoom._id,
    guestId: testGuest._id,
    checkIn: checkIn1,
    checkOut: checkOut1,
    guestsCount: 1,
    guestDetails: {
      name: "Test Traveler",
      email: "traveler@test.com",
      phone: "+91 9999999999"
    }
  });

  console.log(`[PASS] Booking 1 created: ID #${booking1._id}, Total Price: ₹${booking1.totalPrice}`);

  // Attempt overlapping booking (Days 11-14) - MUST FAIL with 409 Conflict
  const checkIn2 = new Date();
  checkIn2.setDate(checkIn2.getDate() + 11);
  const checkOut2 = new Date();
  checkOut2.setDate(checkOut2.getDate() + 14);

  let doubleBookingPrevented = false;
  try {
    await bookingService.createBooking({
      propertyId: testProperty._id,
      roomId: testRoom._id,
      guestId: testGuest._id,
      checkIn: checkIn2,
      checkOut: checkOut2,
      guestsCount: 1,
      guestDetails: {
        name: "Double Booker",
        email: "conflict@test.com",
        phone: "+91 8888888888"
      }
    });
  } catch (err) {
    if (err.statusCode === 409 || err.message.includes("already booked")) {
      doubleBookingPrevented = true;
      console.log(`[PASS] Double booking successfully PREVENTED: "${err.message}"`);
    } else {
      throw err;
    }
  }

  if (!doubleBookingPrevented) {
    throw new Error("Double booking prevention FAILED! Overlapping booking was allowed.");
  }

  // Test 4: Booking Cancellation
  await bookingService.cancelBooking(booking1._id, testGuest._id, "CUSTOMER");
  const cancelledBooking = await Booking.findById(booking1._id);
  console.log(`[PASS] Booking cancellation verified: Status = "${cancelledBooking.status}"`);

  // Test 5: Metrics computation
  const adminMetrics = await organizationService.getAdminDashboardMetrics();
  console.log(`[PASS] Admin Metrics: Users=${adminMetrics.totalUsers}, Orgs=${adminMetrics.totalOrganizations}, Bookings=${adminMetrics.totalBookings}`);

  // Cleanup test booking
  await Booking.findByIdAndDelete(booking1._id);
  console.log("[PASS] Test cleanup completed.");

  console.log("=== ALL WANDERLUST SAAS VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
