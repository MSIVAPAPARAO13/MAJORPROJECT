const mongoose = require("mongoose");
const { PERMISSIONS, hasPermission } = require("../src/config/permissions");
const { bookingSchema } = require("../src/validators/bookingValidator");
const bookingService = require("../src/services/bookingService");
const { canAccessBooking, canCancelBooking } = require("../src/middleware/bookingAuth");
const Booking = require("../src/models/booking");
const Room = require("../src/models/room");
const Listing = require("../src/models/listing");
const Organization = require("../src/models/organization");
const User = require("../src/models/user");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function runPhase5TestSuite() {
  console.log("==================================================");
  console.log("PHASE 5 BOOKING ENGINE TEST SUITE");
  console.log("==================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failedTests++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: RBAC Booking Permissions Matrix
  // ----------------------------------------------------
  console.log("--- 1. RBAC BOOKING PERMISSION MATRIX CHECKS ---");
  const customer = { role: "CUSTOMER", organization: new mongoose.Types.ObjectId() };
  const staff = { role: "STAFF", organization: new mongoose.Types.ObjectId() };
  const manager = { role: "MANAGER", organization: new mongoose.Types.ObjectId() };
  const owner = { role: "OWNER", organization: new mongoose.Types.ObjectId() };
  const admin = { role: "ADMIN", organization: new mongoose.Types.ObjectId() };

  // Customer
  assert(hasPermission(customer, PERMISSIONS.BOOKING_CREATE), "CUSTOMER has BOOKING_CREATE permission");
  assert(hasPermission(customer, PERMISSIONS.BOOKING_VIEW), "CUSTOMER has BOOKING_VIEW permission");
  assert(hasPermission(customer, PERMISSIONS.BOOKING_CANCEL), "CUSTOMER has BOOKING_CANCEL permission");
  assert(!hasPermission(customer, PERMISSIONS.BOOKING_MANAGE), "CUSTOMER cannot manage organization bookings");

  // Staff
  assert(hasPermission(staff, PERMISSIONS.BOOKING_VIEW), "STAFF has BOOKING_VIEW permission");
  assert(hasPermission(staff, PERMISSIONS.BOOKING_UPDATE), "STAFF has BOOKING_UPDATE permission");
  assert(!hasPermission(staff, PERMISSIONS.BOOKING_MANAGE), "STAFF cannot manage high-level bookings");

  // Manager
  assert(hasPermission(manager, PERMISSIONS.BOOKING_VIEW), "MANAGER has BOOKING_VIEW permission");
  assert(hasPermission(manager, PERMISSIONS.BOOKING_CREATE), "MANAGER has BOOKING_CREATE permission");
  assert(hasPermission(manager, PERMISSIONS.BOOKING_UPDATE), "MANAGER has BOOKING_UPDATE permission");
  assert(hasPermission(manager, PERMISSIONS.BOOKING_CANCEL), "MANAGER has BOOKING_CANCEL permission");
  assert(hasPermission(manager, PERMISSIONS.BOOKING_MANAGE), "MANAGER has BOOKING_MANAGE permission");

  // Owner
  assert(hasPermission(owner, PERMISSIONS.BOOKING_VIEW), "OWNER has BOOKING_VIEW permission");
  assert(hasPermission(owner, PERMISSIONS.BOOKING_CREATE), "OWNER has BOOKING_CREATE permission");
  assert(hasPermission(owner, PERMISSIONS.BOOKING_UPDATE), "OWNER has BOOKING_UPDATE permission");
  assert(hasPermission(owner, PERMISSIONS.BOOKING_CANCEL), "OWNER has BOOKING_CANCEL permission");
  assert(hasPermission(owner, PERMISSIONS.BOOKING_MANAGE), "OWNER has BOOKING_MANAGE permission");

  // Admin
  assert(hasPermission(admin, PERMISSIONS.BOOKING_VIEW), "ADMIN has BOOKING_VIEW permission");
  assert(hasPermission(admin, PERMISSIONS.BOOKING_CREATE), "ADMIN has BOOKING_CREATE permission");
  assert(hasPermission(admin, PERMISSIONS.BOOKING_UPDATE), "ADMIN has BOOKING_UPDATE permission");
  assert(hasPermission(admin, PERMISSIONS.BOOKING_CANCEL), "ADMIN has BOOKING_CANCEL permission");
  assert(hasPermission(admin, PERMISSIONS.BOOKING_MANAGE), "ADMIN has BOOKING_MANAGE permission");

  // ----------------------------------------------------
  // TEST 2: Joi Validator Schema Checks
  // ----------------------------------------------------
  console.log("\n--- 2. BOOKING VALIDATOR SCHEMA CHECKS ---");
  const validPayload = {
    booking: {
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
      guestsCount: 2,
      guestDetails: {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890"
      }
    }
  };
  const { error: validErr } = bookingSchema.validate(validPayload);
  assert(!validErr, "Valid booking payload passes schema validation");

  // Invalid: Check-out before Check-in
  const invalidDatePayload = {
    booking: {
      checkIn: "2026-11-05",
      checkOut: "2026-11-01",
      guestsCount: 2
    }
  };
  const { error: dateErr } = bookingSchema.validate(invalidDatePayload);
  assert(Boolean(dateErr), "Payload with checkOut <= checkIn is rejected by validator");

  // Invalid: Zero guests
  const zeroGuestsPayload = {
    booking: {
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
      guestsCount: 0
    }
  };
  const { error: zeroGuestErr } = bookingSchema.validate(zeroGuestsPayload);
  assert(Boolean(zeroGuestErr), "Payload with guestsCount < 1 is rejected by validator");

  // Security: Attempting to inject totalPrice or status
  const injectedPayload = {
    booking: {
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
      guestsCount: 2,
      totalPrice: 0.01,
      status: "CONFIRMED"
    }
  };
  const { error: injectErr } = bookingSchema.validate(injectedPayload);
  assert(Boolean(injectErr), "Payload attempting to inject totalPrice or status is strictly rejected");

  // ----------------------------------------------------
  // CONNECT TO DATABASE FOR INTEGRATION TESTS
  // ----------------------------------------------------
  console.log("\n--- CONNECTING TO MONGODB FOR INTEGRATION TESTS ---");
  await mongoose.connect(MONGO_URL);

  const testCreatedBookingIds = [];

  try {
    // Fetch a real room and listing from existing database
    const existingRoom = await Room.findOne().populate("property");
    if (!existingRoom || !existingRoom.property) {
      throw new Error("No room with property found in database for testing");
    }

    const testUserA = new mongoose.Types.ObjectId();
    const testUserB = new mongoose.Types.ObjectId();
    const userA = { _id: testUserA, role: "CUSTOMER", username: "customerA", email: "a@test.com" };
    const userB = { _id: testUserB, role: "CUSTOMER", username: "customerB", email: "b@test.com" };

    // ----------------------------------------------------
    // TEST 3: Hierarchy Integrity Check
    // ----------------------------------------------------
    console.log("\n--- 3. HIERARCHY INTEGRITY CHECKS ---");
    const fakePropertyId = new mongoose.Types.ObjectId();
    let hierarchyErr = null;
    try {
      await bookingService.createBooking({
        propertyId: fakePropertyId,
        roomId: existingRoom._id,
        checkIn: "2026-12-01",
        checkOut: "2026-12-05",
        guestsCount: 1
      }, userA);
    } catch (err) {
      hierarchyErr = err;
    }
    assert(hierarchyErr && hierarchyErr.statusCode === 400, "Booking room with mismatched propertyId throws 400 Resource Mismatch");

    // ----------------------------------------------------
    // TEST 4: Capacity Validation Check
    // ----------------------------------------------------
    console.log("\n--- 4. CAPACITY VALIDATION CHECKS ---");
    let capacityErr = null;
    try {
      await bookingService.createBooking({
        propertyId: existingRoom.property._id,
        roomId: existingRoom._id,
        checkIn: "2026-12-01",
        checkOut: "2026-12-05",
        guestsCount: existingRoom.capacity + 5
      }, userA);
    } catch (err) {
      capacityErr = err;
    }
    assert(capacityErr && capacityErr.statusCode === 400, `Guest count exceeding room capacity (${existingRoom.capacity}) throws 400 error`);

    // ----------------------------------------------------
    // TEST 5: Server-Side Pricing & Creation Check
    // ----------------------------------------------------
    console.log("\n--- 5. SERVER-SIDE PRICING & CREATION CHECKS ---");
    const booking1 = await bookingService.createBooking({
      propertyId: existingRoom.property._id,
      roomId: existingRoom._id,
      checkIn: "2026-12-01",
      checkOut: "2026-12-04", // 3 nights
      guestsCount: 1,
      totalPrice: 1.00 // Injected price should be ignored and overwritten
    }, userA);
    testCreatedBookingIds.push(booking1._id);

    assert(booking1.totalNights === 3, "totalNights calculated correctly as 3");
    assert(booking1.totalPrice === 3 * existingRoom.price, `totalPrice calculated server-side as ${3 * existingRoom.price} (nights * price)`);
    assert(booking1.status === "PENDING", "Booking status defaults to PENDING");
    assert(booking1.bookingNumber && booking1.bookingNumber.startsWith("WL-"), `Unique bookingNumber generated: ${booking1.bookingNumber}`);
    assert(booking1.guest.equals(testUserA), "Guest pointer set to authenticated user");

    // ----------------------------------------------------
    // TEST 6: Room Availability Logic & Half-Open Intervals
    // ----------------------------------------------------
    console.log("\n--- 6. ROOM AVAILABILITY & HALF-OPEN INTERVAL CHECKS ---");
    
    // Conflicting booking: Overlapping dates [2026-12-02 to 2026-12-06]
    let overlapErr = null;
    try {
      await bookingService.createBooking({
        propertyId: existingRoom.property._id,
        roomId: existingRoom._id,
        checkIn: "2026-12-02",
        checkOut: "2026-12-06",
        guestsCount: 1
      }, userB);
    } catch (err) {
      overlapErr = err;
    }
    assert(overlapErr && overlapErr.statusCode === 409, "Overlapping booking request correctly throws 409 Conflict");

    // Adjacent / Back-to-Back booking: Check-in on same day as previous check-out [2026-12-04 to 2026-12-07]
    const booking2 = await bookingService.createBooking({
      propertyId: existingRoom.property._id,
      roomId: existingRoom._id,
      checkIn: "2026-12-04", // Exactly booking1 checkOut
      checkOut: "2026-12-07",
      guestsCount: 1
    }, userB);
    testCreatedBookingIds.push(booking2._id);
    assert(Boolean(booking2), "Adjacent booking [checkOut == new checkIn] succeeds via half-open interval [checkIn, checkOut)");

    // ----------------------------------------------------
    // TEST 7: Customer Ownership & Cancellation Controls
    // ----------------------------------------------------
    console.log("\n--- 7. CUSTOMER OWNERSHIP & CANCELLATION CHECKS ---");
    // Customer B trying to cancel Customer A's booking
    let unauthorizedCancelErr = null;
    try {
      await bookingService.cancelBooking(booking1._id, testUserB, "CUSTOMER");
    } catch (err) {
      unauthorizedCancelErr = err;
    }
    assert(unauthorizedCancelErr && unauthorizedCancelErr.statusCode === 403, "Customer B cannot cancel Customer A's booking (403 Forbidden)");

    // Customer A cancels their own booking
    const cancelledBooking = await bookingService.cancelBooking(booking1._id, testUserA, "CUSTOMER");
    assert(cancelledBooking.status === "CANCELLED", "Customer A can cancel their own booking (status -> CANCELLED)");

    // Cancelled dates become available again: [2026-12-01 to 2026-12-04]
    const rebookedBooking = await bookingService.createBooking({
      propertyId: existingRoom.property._id,
      roomId: existingRoom._id,
      checkIn: "2026-12-01",
      checkOut: "2026-12-04",
      guestsCount: 1
    }, userB);
    testCreatedBookingIds.push(rebookedBooking._id);
    assert(Boolean(rebookedBooking), "Cancelled booking date range can now be booked by another user");

    // ----------------------------------------------------
    // TEST 8: Multi-Tenant Authorization Middleware Checks
    // ----------------------------------------------------
    console.log("\n--- 8. MULTI-TENANT AUTHORIZATION MIDDLEWARE CHECKS ---");
    const foreignTenantOrgId = new mongoose.Types.ObjectId();
    const foreignStaffUser = { _id: new mongoose.Types.ObjectId(), role: "STAFF", organization: foreignTenantOrgId };
    const adminUser = { _id: new mongoose.Types.ObjectId(), role: "ADMIN" };

    // Middleware mock test for canAccessBooking
    let mockReq = {
      params: { bookingId: rebookedBooking._id.toString() },
      user: foreignStaffUser,
      originalUrl: `/api/bookings/${rebookedBooking._id}`,
      accepts: (type) => type === "json"
    };
    let capturedCode = null;
    let mockRes = {
      status: (code) => {
        capturedCode = code;
        return { json: (d) => d };
      }
    };
    let capturedErr = null;
    let nextCalled = false;

    await canAccessBooking(mockReq, mockRes, (err) => {
      if (err) capturedErr = err;
      else nextCalled = true;
    });
    assert(capturedCode === 403 || (capturedErr && capturedErr.statusCode === 403), "Staff from foreign tenant cannot access booking belonging to another tenant (403)");

    // Admin access
    capturedCode = null;
    capturedErr = null;
    nextCalled = false;
    mockReq.user = adminUser;
    await canAccessBooking(mockReq, mockRes, (err) => {
      if (err) capturedErr = err;
      else nextCalled = true;
    });
    assert(!capturedErr && nextCalled, "System ADMIN can access any booking across tenants");

    // ----------------------------------------------------
    // TEST 9: Process-Local Concurrency & Mutex Serialization Test
    // ----------------------------------------------------
    console.log("\n--- 9. PROCESS-LOCAL CONCURRENCY & SERIALIZATION TEST ---");
    console.log("Firing two simultaneous booking requests for the exact same room and date range...");

    const targetDateIn = "2026-12-20";
    const targetDateOut = "2026-12-25";

    const concurrentPromise1 = bookingService.createBooking({
      propertyId: existingRoom.property._id,
      roomId: existingRoom._id,
      checkIn: targetDateIn,
      checkOut: targetDateOut,
      guestsCount: 1,
      guestDetails: { name: "Requester 1" }
    }, userA);

    const concurrentPromise2 = bookingService.createBooking({
      propertyId: existingRoom.property._id,
      roomId: existingRoom._id,
      checkIn: targetDateIn,
      checkOut: targetDateOut,
      guestsCount: 1,
      guestDetails: { name: "Requester 2" }
    }, userB);

    const results = await Promise.allSettled([concurrentPromise1, concurrentPromise2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert(fulfilled.length === 1, "Exactly ONE concurrent request succeeded");
    assert(rejected.length === 1, "Exactly ONE concurrent request failed");

    if (fulfilled.length === 1) {
      testCreatedBookingIds.push(fulfilled[0].value._id);
    }

    if (rejected.length === 1) {
      const err = rejected[0].reason;
      assert(err.statusCode === 409, `The conflicting concurrent request was rejected with HTTP 409 (${err.message})`);
    }

    // Verify in database: Exactly one booking document exists for this date range
    const dbBookingsForSlot = await Booking.find({
      room: existingRoom._id,
      checkIn: new Date(targetDateIn),
      checkOut: new Date(targetDateOut),
      status: { $in: ["PENDING", "CONFIRMED"] }
    });
    assert(dbBookingsForSlot.length === 1, "Database contains exactly 1 active booking for the disputed slot, proving zero double-booking");

  } finally {
    // ----------------------------------------------------
    // TEST 10: Clean-up & DB State Verification
    // ----------------------------------------------------
    console.log("\n--- 10. CLEAN-UP & DATABASE PRESERVATION CHECKS ---");
    if (testCreatedBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: testCreatedBookingIds } });
      console.log(`Cleaned up ${testCreatedBookingIds.length} test bookings.`);
    }

    const roomCount = await Room.countDocuments();
    const listingCount = await Listing.countDocuments();
    const userCount = await User.countDocuments();
    const orgCount = await Organization.countDocuments();
    const bookingCount = await Booking.countDocuments();

    assert(roomCount === 134, `Room collection preserved at exactly 134 (actual: ${roomCount})`);
    assert(listingCount === 65, `Listing collection preserved at exactly 65 (actual: ${listingCount})`);
    assert(userCount === 6, `User collection preserved at exactly 6 (actual: ${userCount})`);
    assert(orgCount === 1, `Organization collection preserved at exactly 1 (actual: ${orgCount})`);
    assert(bookingCount === 0, `Booking collection cleanly reset to 0 (actual: ${bookingCount})`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n==================================================");
  console.log(`PHASE 5 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase5TestSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
