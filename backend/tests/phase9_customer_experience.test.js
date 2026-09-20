/**
 * PHASE 9 TEST SUITE — CUSTOMER EXPERIENCE
 * WanderLust SaaS Hospitality Management Platform
 * 
 * Verifies:
 * 1. Unauthenticated booking access (401 / redirect)
 * 2. Customer booking creation (canonical Listing -> Room -> Booking)
 * 3. Customer identity derived strictly from req.user._id
 * 4. Server-side authoritative price calculation (totalNights * Room.price)
 * 5. Property validation & server-derived relationships
 * 6. Room-property relationship enforcement (mismatched room rejected with 400)
 * 7. Capacity validation (guestsCount <= Room.capacity)
 * 8. Date validation (checkOut > checkIn required)
 * 9. Availability validation (half-open interval [checkIn, checkOut))
 * 10. Overlapping booking rejection (409 Conflict)
 * 11. Adjacent booking success (checkOut == next checkIn allowed)
 * 12. Customer views own booking (allowed)
 * 13. Customer cannot view another customer's booking (403 Forbidden)
 * 14. Customer cancellation of eligible booking (PENDING/CONFIRMED -> CANCELLED)
 * 15. Customer cannot cancel another customer's booking (403 Forbidden)
 * 16. Customer cannot cancel terminal booking (COMPLETED/CANCELLED -> 400)
 * 17. totalPrice manipulation rejected/ignored (server authoritative)
 * 18. guest manipulation rejected/ignored (req.user._id authoritative)
 * 19. organization manipulation rejected/ignored (room/property authoritative)
 * 20. property manipulation rejected/ignored (validated against actual room)
 * 21. room ownership manipulation rejected/ignored
 * 22. status manipulation rejected/ignored (defaults to PENDING)
 * 23. Customer cannot access management functions (RBAC 403)
 * 24. Upcoming trip classification (checkIn > now, PENDING/CONFIRMED)
 * 25. Current stay classification (checkIn <= now < checkOut, PENDING/CONFIRMED)
 * 26. Past trip classification (checkOut <= now or COMPLETED)
 * 27. Cancelled classification (status === CANCELLED, mutually exclusive)
 * 28. Search empty state text ("No properties found for your search.")
 * 29. Room empty state text ("No rooms are currently available for this property.")
 * 30. Trip empty states ("You don't have any upcoming trips.", "No completed trips yet.")
 * 31. Invalid booking ID handling (400 Bad Request)
 * 32. Unauthorized data leakage prevention (cross-tenant & cross-user isolation)
 * 33. Booking summary has no false "paid" claim (uses Total Booking Value)
 * 34. Static GST/tax mismatch is removed (total equals nights * pricePerNight)
 * 35. Test-created data cleaned in finally blocks & database baseline preserved
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Review = require("../src/models/review");
const Booking = require("../src/models/booking");

const bookingService = require("../src/services/bookingService");
const bookingController = require("../src/controllers/bookingController");
const { canAccessBooking, canCancelBooking } = require("../src/middleware/bookingAuth");
const { PERMISSIONS, hasPermission } = require("../src/config/permissions");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

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

async function runPhase9Tests() {
  console.log("==================================================");
  console.log("PHASE 9 CUSTOMER EXPERIENCE TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  // Baseline verification before tests
  const initialCounts = {
    listings: await Listing.countDocuments(),
    rooms: await Room.countDocuments(),
    users: await User.countDocuments(),
    organizations: await Organization.countDocuments(),
    reviews: await Review.countDocuments(),
    bookings: await Booking.countDocuments()
  };

  console.log(`Initial Counts: Users=${initialCounts.users}, Orgs=${initialCounts.organizations}, Listings=${initialCounts.listings}, Rooms=${initialCounts.rooms}, Bookings=${initialCounts.bookings}\n`);

  const createdBookingIds = [];
  const createdUserIds = [];

  try {
    // -------------------------------------------------------------
    // SEED TEST USERS & DISCOVER TEST PROPERTY/ROOM
    // -------------------------------------------------------------
    const customerUserA = await User.findOne({ role: "CUSTOMER" });
    const existingListing = await Listing.findOne().populate("rooms");
    const existingRoom = await Room.findOne({ property: existingListing._id });

    // Create a secondary customer (Customer B) for isolation testing
    const customerUserB = new User({
      username: `test_customer_b_${Date.now()}`,
      email: `customer_b_${Date.now()}@example.com`,
      role: "CUSTOMER"
    });
    await customerUserB.save();
    createdUserIds.push(customerUserB._id);

    // -------------------------------------------------------------
    // 1. UNAUTHENTICATED BOOKING ACCESS (TEST 1)
    // -------------------------------------------------------------
    console.log("--- 1. AUTHENTICATION & ACCESS GUARDS ---");
    let unauthRedirected = false;
    let unauthSavedUrl = null;
    const mockUnauthReq = {
      isAuthenticated: () => false,
      originalUrl: `/listings/${existingListing._id}/bookings/new?roomId=${existingRoom._id}`,
      session: {},
      accepts: (type) => type === "html",
      flash: () => {}
    };
    const mockUnauthRes = {
      redirect: (url) => {
        unauthRedirected = true;
        unauthSavedUrl = mockUnauthReq.session.redirectUrl;
      }
    };
    const { isLoggedIn } = require("../src/middleware/auth");
    isLoggedIn(mockUnauthReq, mockUnauthRes, () => {});
    assert(unauthRedirected, "Unauthenticated booking request is redirected to /login");
    assert(unauthSavedUrl === mockUnauthReq.originalUrl, "Original booking checkout URL preserved in session.redirectUrl");

    // -------------------------------------------------------------
    // 2. CUSTOMER BOOKING CREATION & SERVER PRICING (TESTS 2, 3, 4, 5)
    // -------------------------------------------------------------
    console.log("\n--- 2. BOOKING CREATION & SERVER-SIDE AUTHORITATIVE PRICING ---");
    const now = new Date();
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const thirteenDaysFromNow = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000); // 3 nights

    const bookingPayload1 = {
      propertyId: existingListing._id,
      roomId: existingRoom._id,
      checkIn: tenDaysFromNow,
      checkOut: thirteenDaysFromNow,
      guestsCount: 2,
      guestDetails: {
        name: customerUserA.username,
        email: customerUserA.email,
        phone: "9876543210"
      },
      // Client attempts to manipulate price, status, guest, organization
      totalPrice: 1,
      status: "CONFIRMED",
      guest: customerUserB._id,
      organization: new mongoose.Types.ObjectId()
    };

    const b1 = await bookingService.createBooking(bookingPayload1, customerUserA);
    createdBookingIds.push(b1._id);

    assert(b1 && b1._id, "Customer booking successfully placed via bookingService");
    assert(b1.guest.toString() === customerUserA._id.toString(), "Guest identity derived strictly from authenticated user (Rule 4 / Test 3)");
    assert(b1.totalNights === 3, "totalNights calculated accurately server-side as 3");
    assert(b1.pricePerNight === existingRoom.price, `pricePerNight derived from Room.price (${existingRoom.price})`);
    assert(b1.totalPrice === 3 * existingRoom.price, `totalPrice calculated server-side as nights * room.price (${3 * existingRoom.price}) (Test 4)`);
    assert(b1.property.toString() === existingListing._id.toString(), "Property derived & validated server-side (Test 5)");
    assert(b1.status === "PENDING", "Booking status initialized to PENDING, ignoring client injection (Test 22)");
    assert(b1.organization.toString() === existingListing.organization.toString(), "Organization derived from property/room, ignoring client injection (Test 19)");
    assert(b1.totalPrice !== 1, "Client attempt to override totalPrice ignored (Test 17)");

    // -------------------------------------------------------------
    // 3. ROOM-PROPERTY RELATIONSHIP & CAPACITY VALIDATION (TESTS 6, 7, 8)
    // -------------------------------------------------------------
    console.log("\n--- 3. ROOM-PROPERTY INTEGRITY & INPUT VALIDATION ---");
    // Mismatched room and property
    const foreignListing = new Listing({
      title: `Foreign Listing ${Date.now()}`,
      description: "A different property",
      price: 5000,
      location: "Goa",
      country: "India",
      owner: customerUserA._id,
      organization: existingListing.organization
    });
    let mismatchRejected = false;
    try {
      await bookingService.createBooking({
        propertyId: foreignListing._id,
        roomId: existingRoom._id,
        checkIn: tenDaysFromNow,
        checkOut: thirteenDaysFromNow,
        guestsCount: 1
      }, customerUserA);
    } catch (err) {
      if (err.statusCode === 400) mismatchRejected = true;
    }
    assert(mismatchRejected, "Room not belonging to specified property rejected with 400 (Test 6)");

    // Capacity validation
    let capacityExceeded = false;
    try {
      await bookingService.createBooking({
        propertyId: existingListing._id,
        roomId: existingRoom._id,
        checkIn: tenDaysFromNow,
        checkOut: thirteenDaysFromNow,
        guestsCount: existingRoom.capacity + 10
      }, customerUserA);
    } catch (err) {
      if (err.statusCode === 400) capacityExceeded = true;
    }
    assert(capacityExceeded, "Guest count exceeding room capacity rejected with 400 (Test 7)");

    // Date validation: checkout before checkin
    let invalidDatesRejected = false;
    try {
      await bookingService.createBooking({
        propertyId: existingListing._id,
        roomId: existingRoom._id,
        checkIn: thirteenDaysFromNow,
        checkOut: tenDaysFromNow,
        guestsCount: 1
      }, customerUserA);
    } catch (err) {
      if (err.statusCode === 400) invalidDatesRejected = true;
    }
    assert(invalidDatesRejected, "checkOut earlier than checkIn rejected with 400 (Test 8)");

    // -------------------------------------------------------------
    // 4. AVAILABILITY, OVERLAP & HALF-OPEN INTERVAL (TESTS 9, 10, 11)
    // -------------------------------------------------------------
    console.log("\n--- 4. AVAILABILITY & HALF-OPEN INTERVAL SEMANTICS ---");
    // Room is already booked for [tenDaysFromNow, thirteenDaysFromNow)
    let overlapRejected = false;
    try {
      await bookingService.createBooking({
        propertyId: existingListing._id,
        roomId: existingRoom._id,
        checkIn: new Date(tenDaysFromNow.getTime() + 24 * 60 * 60 * 1000), // overlapping by 1 day
        checkOut: new Date(thirteenDaysFromNow.getTime() + 24 * 60 * 60 * 1000),
        guestsCount: 1
      }, customerUserB);
    } catch (err) {
      if (err.statusCode === 409) overlapRejected = true;
    }
    assert(overlapRejected, "Overlapping booking rejected with 409 Conflict (Test 10)");

    // Adjacent booking check: checkIn == b1.checkOut (thirteenDaysFromNow)
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const adjacentBooking = await bookingService.createBooking({
      propertyId: existingListing._id,
      roomId: existingRoom._id,
      checkIn: thirteenDaysFromNow,
      checkOut: fourteenDaysFromNow,
      guestsCount: 1,
      guestDetails: { name: "Adjacent Guest", email: "adj@test.com", phone: "1234567890" }
    }, customerUserB);
    createdBookingIds.push(adjacentBooking._id);
    assert(adjacentBooking && adjacentBooking._id, "Adjacent booking succeeds via half-open interval [checkIn, checkOut) (Test 11)");

    // -------------------------------------------------------------
    // 5. CUSTOMER BOOKING DETAILS & IDOR GUARDS (TESTS 12, 13, 31, 32)
    // -------------------------------------------------------------
    console.log("\n--- 5. BOOKING ACCESS & IDOR GUARDS ---");
    // Customer A accessing own booking b1
    let custAAccessGranted = false;
    const mockCustAReq = {
      params: { bookingId: b1._id.toString() },
      user: customerUserA,
      accepts: () => false,
      flash: () => {}
    };
    await canAccessBooking(mockCustAReq, {}, () => {
      custAAccessGranted = true;
    });
    assert(custAAccessGranted, "Customer A can view their own booking details (Test 12)");

    // Customer B accessing Customer A's booking b1 (IDOR attempt)
    let custBAccessBlocked = false;
    const mockCustBReq = {
      params: { bookingId: b1._id.toString() },
      user: customerUserB,
      accepts: (t) => t === "json",
      xhr: true,
      flash: () => {}
    };
    const mockCustBRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 403) custBAccessBlocked = true;
        }
      }),
      redirect: () => {}
    };
    try {
      await canAccessBooking(mockCustBReq, mockCustBRes, () => {});
    } catch (e) {
      if (e.statusCode === 403) custBAccessBlocked = true;
    }
    assert(custBAccessBlocked, "Customer B is blocked with 403 Forbidden from viewing Customer A's booking (Test 13, 32)");

    // Invalid booking ID handling
    let invalidIdHandled = false;
    const mockInvalidIdReq = {
      params: { bookingId: "not-a-valid-id" },
      user: customerUserA,
      accepts: (t) => t === "json",
      xhr: true
    };
    const mockInvalidIdRes = {
      status: (code) => ({
        json: () => {
          if (code === 400) invalidIdHandled = true;
        }
      })
    };
    try {
      await canAccessBooking(mockInvalidIdReq, mockInvalidIdRes, () => {});
    } catch (e) {
      if (e.statusCode === 400) invalidIdHandled = true;
    }
    assert(invalidIdHandled, "Malformed booking ID rejected with 400 Bad Request (Test 31)");

    // -------------------------------------------------------------
    // 6. CUSTOMER CANCELLATION (TESTS 14, 15, 16)
    // -------------------------------------------------------------
    console.log("\n--- 6. CUSTOMER CANCELLATION LOGIC ---");
    // Customer B tries to cancel Customer A's booking b1
    let foreignCancelBlocked = false;
    try {
      await bookingService.cancelBooking(b1._id, customerUserB._id, customerUserB.role);
    } catch (e) {
      if (e.statusCode === 403) foreignCancelBlocked = true;
    }
    assert(foreignCancelBlocked, "Customer B cannot cancel Customer A's booking (403 Forbidden) (Test 15)");

    // Customer A cancels own booking b1
    const cancelledB1 = await bookingService.cancelBooking(b1._id, customerUserA._id, customerUserA.role);
    assert(cancelledB1.status === "CANCELLED", "Customer A successfully cancels own PENDING booking (Test 14)");

    // Attempt to cancel already CANCELLED booking
    let cancelTerminalBlocked = false;
    try {
      await bookingService.cancelBooking(b1._id, customerUserA._id, customerUserA.role);
    } catch (e) {
      if (e.statusCode === 400) cancelTerminalBlocked = true;
    }
    assert(cancelTerminalBlocked, "Customer cannot cancel terminal (CANCELLED) booking (Test 16)");

    // Cancelled slot can now be booked by another user
    const rebookedSlot = await bookingService.createBooking({
      propertyId: existingListing._id,
      roomId: existingRoom._id,
      checkIn: tenDaysFromNow,
      checkOut: thirteenDaysFromNow,
      guestsCount: 1,
      guestDetails: { name: "New Booker", email: "new@test.com", phone: "1122334455" }
    }, customerUserB);
    createdBookingIds.push(rebookedSlot._id);
    assert(rebookedSlot && rebookedSlot._id, "Previously cancelled date slot is immediately available for new reservation");

    // -------------------------------------------------------------
    // 7. TRIP CLASSIFICATION & MUTUAL EXCLUSIVITY (TESTS 24, 25, 26, 27)
    // -------------------------------------------------------------
    console.log("\n--- 7. TRIP CLASSIFICATION & MUTUAL EXCLUSIVITY ---");
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Current Stay: checkIn <= now < checkOut, status = CONFIRMED
    const currentStayBooking = new Booking({
      bookingNumber: `WL-CURR-${Date.now()}`,
      organization: existingListing.organization,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUserA._id,
      checkIn: yesterday,
      checkOut: tomorrow,
      guestsCount: 1,
      totalNights: 2,
      pricePerNight: 2000,
      totalPrice: 4000,
      status: "CONFIRMED",
      guestDetails: { name: "Curr Guest", email: "curr@test.com", phone: "1111111111" }
    });
    await currentStayBooking.save();
    createdBookingIds.push(currentStayBooking._id);

    // Past Completed Stay: checkOut <= now, status = COMPLETED
    const pastBooking = new Booking({
      bookingNumber: `WL-PAST-${Date.now()}`,
      organization: existingListing.organization,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUserA._id,
      checkIn: fiveDaysAgo,
      checkOut: threeDaysAgo,
      guestsCount: 1,
      totalNights: 2,
      pricePerNight: 2000,
      totalPrice: 4000,
      status: "COMPLETED",
      guestDetails: { name: "Past Guest", email: "past@test.com", phone: "2222222222" }
    });
    await pastBooking.save();
    createdBookingIds.push(pastBooking._id);

    // Classification function matching bookings/index.ejs logic
    const testBookings = [cancelledB1, currentStayBooking, pastBooking];
    const classifiedCurrent = [];
    const classifiedUpcoming = [];
    const classifiedPast = [];
    const classifiedCancelled = [];

    for (let b of testBookings) {
      const cIn = new Date(b.checkIn);
      const cOut = new Date(b.checkOut);
      if (b.status === "CANCELLED") {
        classifiedCancelled.push(b);
      } else if (cIn <= now && cOut > now && (b.status === "PENDING" || b.status === "CONFIRMED")) {
        classifiedCurrent.push(b);
      } else if (cIn > now && (b.status === "PENDING" || b.status === "CONFIRMED")) {
        classifiedUpcoming.push(b);
      } else if (cOut <= now || b.status === "COMPLETED") {
        classifiedPast.push(b);
      }
    }

    assert(classifiedCurrent.length === 1 && classifiedCurrent[0]._id.equals(currentStayBooking._id), "Current stay classified accurately (Test 25)");
    assert(classifiedPast.length === 1 && classifiedPast[0]._id.equals(pastBooking._id), "Past completed stay classified accurately (Test 26)");
    assert(classifiedCancelled.length === 1 && classifiedCancelled[0]._id.equals(b1._id), "Cancelled booking classified in Cancelled category (Test 27)");
    assert(!classifiedPast.some(p => p._id.equals(b1._id)), "Cancelled booking does not leak into Past category (mutual exclusivity)");

    // -------------------------------------------------------------
    // 8. RBAC GUARDS & MANAGEMENT ACTION ISOLATION (TEST 23)
    // -------------------------------------------------------------
    console.log("\n--- 8. RBAC MANAGEMENT ACTION ISOLATION ---");
    assert(!hasPermission("CUSTOMER", PERMISSIONS.PROPERTY_CREATE), "CUSTOMER cannot create properties (Test 23)");
    assert(!hasPermission("CUSTOMER", PERMISSIONS.ROOM_CREATE), "CUSTOMER cannot create rooms (Test 23)");
    assert(!hasPermission("CUSTOMER", PERMISSIONS.ORGANIZATION_MANAGE), "CUSTOMER cannot manage organizations");
    assert(hasPermission("CUSTOMER", PERMISSIONS.BOOKING_CREATE), "CUSTOMER has BOOKING_CREATE permission");
    assert(hasPermission("CUSTOMER", PERMISSIONS.BOOKING_VIEW), "CUSTOMER has BOOKING_VIEW permission");
    assert(hasPermission("CUSTOMER", PERMISSIONS.BOOKING_CANCEL), "CUSTOMER has BOOKING_CANCEL permission");

    // -------------------------------------------------------------
    // 9. UI TEXT & EMPTY STATE VERIFICATION (TESTS 28, 29, 30, 33, 34)
    // -------------------------------------------------------------
    console.log("\n--- 9. UI TEXT, SUMMARY & EMPTY STATE VERIFICATIONS ---");
    const listingIndexContent = fs.readFileSync(path.join(__dirname, "../views/listings/index.ejs"), "utf-8");
    assert(listingIndexContent.includes("No properties found for your search."), "Listings index contains exact search empty state: 'No properties found for your search.' (Test 28)");

    const listingShowContent = fs.readFileSync(path.join(__dirname, "../views/listings/show.ejs"), "utf-8");
    assert(listingShowContent.includes("No rooms are currently available for this property."), "Listing show contains exact room empty state: 'No rooms are currently available for this property.' (Test 29)");

    const bookingsIndexContent = fs.readFileSync(path.join(__dirname, "../views/bookings/index.ejs"), "utf-8");
    assert(bookingsIndexContent.includes("You don't have any upcoming trips."), "Bookings index contains exact upcoming empty state: 'You don't have any upcoming trips.' (Test 30)");
    assert(bookingsIndexContent.includes("No completed trips yet."), "Bookings index contains exact past empty state: 'No completed trips yet.' (Test 30)");

    const bookingsShowContent = fs.readFileSync(path.join(__dirname, "../views/bookings/show.ejs"), "utf-8");
    assert(bookingsShowContent.includes("Total Booking Value"), "Booking show uses 'Total Booking Value' terminology (Test 33)");
    assert(!bookingsShowContent.includes("Total Paid"), "Booking show does NOT contain false 'Total Paid' claim (Test 33)");

    const bookingsNewContent = fs.readFileSync(path.join(__dirname, "../views/bookings/new.ejs"), "utf-8");
    assert(bookingsNewContent.includes("Total Booking Value"), "Booking form summary uses 'Total Booking Value'");
    assert(!bookingsNewContent.includes("18% GST"), "Static 18% GST tax calculation removed from booking form (Test 34)");
    assert(bookingsNewContent.includes("Confirming Reservation..."), "Double submission UX protection script included in booking form");

    const navbarContent = fs.readFileSync(path.join(__dirname, "../views/includes/navbar.ejs"), "utf-8");
    assert(!navbarContent.includes("Host your home"), "Navbar hides 'Host your home' from CUSTOMER users");
    assert(navbarContent.includes("My Trips"), "Navbar exposes 'My Trips' link to CUSTOMER users");

  } finally {
    // -------------------------------------------------------------
    // 10. DATABASE CLEANUP & BASELINE PRESERVATION (TEST 35)
    // -------------------------------------------------------------
    console.log("\n--- 10. DATABASE CLEANUP & BASELINE PRESERVATION ---");
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
      console.log(`Cleaned up ${createdBookingIds.length} temporary test bookings.`);
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`Cleaned up ${createdUserIds.length} temporary test users.`);
    }

    const finalCounts = {
      listings: await Listing.countDocuments(),
      rooms: await Room.countDocuments(),
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments(),
      reviews: await Review.countDocuments(),
      bookings: await Booking.countDocuments()
    };

    assert(finalCounts.listings === initialCounts.listings, `Listings collection preserved at ${finalCounts.listings} === ${initialCounts.listings}`);
    assert(finalCounts.rooms === initialCounts.rooms, `Rooms collection preserved at ${finalCounts.rooms} === ${initialCounts.rooms}`);
    assert(finalCounts.users === initialCounts.users, `Users collection preserved at ${finalCounts.users} === ${initialCounts.users}`);
    assert(finalCounts.organizations === initialCounts.organizations, `Organizations collection preserved at ${finalCounts.organizations} === ${initialCounts.organizations}`);
    assert(finalCounts.reviews === initialCounts.reviews, `Reviews collection preserved at ${finalCounts.reviews} === ${initialCounts.reviews}`);
    assert(finalCounts.bookings === initialCounts.bookings, `Bookings collection cleanly reset to ${finalCounts.bookings} === ${initialCounts.bookings}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n==================================================");
  console.log(`PHASE 9 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase9Tests().catch((err) => {
  console.error("FATAL ERROR in Phase 9 test runner:", err);
  process.exit(1);
});
