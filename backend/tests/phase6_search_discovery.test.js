const mongoose = require("mongoose");
const { searchQuerySchema } = require("../src/validators/searchValidator");
const listingService = require("../src/services/listingService");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const Booking = require("../src/models/booking");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Review = require("../src/models/review");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function runPhase6TestSuite() {
  console.log("==================================================");
  console.log("PHASE 6 SEARCH & DISCOVERY TEST SUITE");
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
  // TEST 1: Query Validator Schema & Security Guards
  // ----------------------------------------------------
  console.log("--- 1. SEARCH QUERY VALIDATOR & SECURITY CHECKS ---");
  const validQuery = {
    location: "Goa",
    guests: 2,
    propertyType: "Hotel",
    roomType: "Deluxe",
    minPrice: 1000,
    maxPrice: 5000,
    checkIn: "2026-11-01",
    checkOut: "2026-11-05",
    sort: "price_asc",
    page: 1,
    limit: 12
  };
  const { error: validErr, value: sanitized } = searchQuerySchema.validate(validQuery);
  assert(!validErr, "Valid multi-parameter query passes validation");
  assert(sanitized.sort === "price_asc", "Sort parameter preserved");

  // Invalid: minPrice > maxPrice
  const { error: priceErr } = searchQuerySchema.validate({ minPrice: 5000, maxPrice: 1000 });
  assert(Boolean(priceErr), "minPrice > maxPrice is rejected by validator");

  // Invalid: negative price
  const { error: negPriceErr } = searchQuerySchema.validate({ minPrice: -100 });
  assert(Boolean(negPriceErr), "Negative minPrice is rejected by validator");

  // Invalid: checkOut <= checkIn
  const { error: dateErr } = searchQuerySchema.validate({
    checkIn: "2026-11-05",
    checkOut: "2026-11-01"
  });
  assert(Boolean(dateErr), "checkOut <= checkIn is rejected by validator");

  // Invalid: checkIn without checkOut
  const { error: singleDateErr } = searchQuerySchema.validate({ checkIn: "2026-11-05" });
  assert(Boolean(singleDateErr), "Supplying checkIn without checkOut is rejected");

  // Invalid: limit exceeds safe maximum of 50
  const { error: limitErr } = searchQuerySchema.validate({ limit: 1000 });
  assert(Boolean(limitErr), "Limit > 50 is strictly rejected");

  // Invalid: page < 1
  const { error: pageErr } = searchQuerySchema.validate({ page: 0 });
  assert(Boolean(pageErr), "Page < 1 is rejected");

  // Invalid: unsupported sort option
  const { error: sortErr } = searchQuerySchema.validate({ sort: "hack_injected_column" });
  assert(Boolean(sortErr), "Unsupported sort parameter is rejected");

  // Invalid: unsupported propertyType
  const { error: typeErr } = searchQuerySchema.validate({ propertyType: "SpaceStation" });
  assert(Boolean(typeErr), "Unsupported propertyType is rejected");

  // Security: strip or reject malicious MongoDB operators
  const { error: injectErr } = searchQuerySchema.validate({
    q: "normal",
    $where: "function() { return true; }"
  }, { stripUnknown: true });
  assert(!injectErr, "Sanitizer cleanly strips unknown MongoDB injection operators");

  // ----------------------------------------------------
  // CONNECT TO DATABASE FOR INTEGRATION TESTS
  // ----------------------------------------------------
  console.log("\n--- CONNECTING TO MONGODB FOR DISCOVERY TESTS ---");
  await mongoose.connect(MONGO_URL);

  const testBookingIds = [];
  const testListingIds = [];
  const testRoomIds = [];

  try {
    // ----------------------------------------------------
    // TEST 2: Basic Search & Pagination Metadata
    // ----------------------------------------------------
    console.log("\n--- 2. BASIC SEARCH & PAGINATION CHECKS ---");
    const defaultResults = await listingService.getAllListings({ page: 1, limit: 12 });
    assert(defaultResults.length <= 12, "Default query respects limit=12");
    assert(defaultResults.pagination.total === 65, `Total count reported correctly as 65 (got ${defaultResults.pagination.total})`);
    assert(defaultResults.pagination.pages === Math.ceil(65 / 12), "Total pages calculated correctly as 6");
    assert(defaultResults.pagination.page === 1, "Current page is 1");

    // Page 2
    const page2Results = await listingService.getAllListings({ page: 2, limit: 12 });
    assert(page2Results.length === 12, "Page 2 returns 12 listings");
    assert(page2Results[0]._id.toString() !== defaultResults[0]._id.toString(), "Page 2 listings differ from Page 1 listings");

    // ----------------------------------------------------
    // TEST 3: Text & Location Filters
    // ----------------------------------------------------
    console.log("\n--- 3. TEXT & LOCATION DISCOVERY CHECKS ---");
    const malibuResults = await listingService.getAllListings({ location: "Malibu" });
    assert(malibuResults.length > 0, `Location search for 'Malibu' returns results (${malibuResults.length} found)`);
    for (const l of malibuResults) {
      const match = l.location.toLowerCase().includes("malibu") || l.country.toLowerCase().includes("malibu");
      assert(match, `Listing '${l.title}' location '${l.location}' matches Malibu`);
    }

    const textResults = await listingService.getAllListings({ q: "Cottage" });
    assert(textResults.length > 0, `Keyword search 'Cottage' returns matching properties (${textResults.length} found)`);

    // ----------------------------------------------------
    // TEST 4: Property Type & Room Type Filters
    // ----------------------------------------------------
    console.log("\n--- 4. PROPERTY & ROOM TYPE FILTER CHECKS ---");
    const apartmentResults = await listingService.getAllListings({ propertyType: "Apartment" });
    assert(apartmentResults.length > 0, `propertyType='Apartment' returns results (${apartmentResults.length} found)`);
    for (const l of apartmentResults) {
      assert(l.propertyType.toLowerCase() === "apartment", `Listing '${l.title}' has propertyType Apartment`);
    }

    const suiteResults = await listingService.getAllListings({ roomType: "Suite" });
    assert(suiteResults.length > 0, `roomType='Suite' returns properties having a Suite room (${suiteResults.length} found)`);

    // ----------------------------------------------------
    // TEST 5: Guest Capacity & Same-Room Rule Verification
    // ----------------------------------------------------
    console.log("\n--- 5. GUEST CAPACITY & SAME-ROOM CONSTRAINT CHECKS ---");
    const guest4Results = await listingService.getAllListings({ guests: 4 });
    assert(guest4Results.length > 0, `guests=4 returns properties capable of hosting 4 guests (${guest4Results.length} found)`);

    // Verify each returned property actually has at least ONE room with capacity >= 4
    for (const l of guest4Results.slice(0, 5)) {
      const matchingRooms = await Room.find({ property: l._id, capacity: { $gte: 4 }, status: "AVAILABLE" });
      assert(matchingRooms.length >= 1, `Property '${l.title}' contains at least one room with capacity >= 4 (found ${matchingRooms.length})`);
    }

    // CREATE SYNTHETIC MULTI-ROOM PROPERTY TO PROVE SAME-ROOM CONSTRAINT
    // Property X has:
    // Room A: capacity 4, price 8000
    // Room B: capacity 2, price 1500
    // If user searches guests=4 AND maxPrice=3000:
    // Room A fails on price (8000 > 3000)
    // Room B fails on capacity (2 < 4)
    // MUST NOT QUALIFY! (No room satisfies both simultaneously)
    const org = await Organization.findOne();
    const owner = await User.findOne({ role: "OWNER" });

    const syntheticListing = new Listing({
      title: "Synthetic Same-Room Test Villa",
      description: "Test villa for same-room constraint assertion",
      price: 1500,
      location: "Testville",
      country: "Testland",
      propertyType: "Villa",
      organization: org._id,
      owner: owner._id,
      status: "ACTIVE"
    });
    await syntheticListing.save();
    testListingIds.push(syntheticListing._id);

    const roomA = new Room({
      property: syntheticListing._id,
      organization: org._id,
      roomNumber: "SYNTH-A",
      roomType: "Suite",
      capacity: 4,
      price: 8000,
      status: "AVAILABLE"
    });
    await roomA.save();
    testRoomIds.push(roomA._id);

    const roomB = new Room({
      property: syntheticListing._id,
      organization: org._id,
      roomNumber: "SYNTH-B",
      roomType: "Deluxe",
      capacity: 2,
      price: 1500,
      status: "AVAILABLE"
    });
    await roomB.save();
    testRoomIds.push(roomB._id);

    syntheticListing.rooms = [roomA._id, roomB._id];
    await syntheticListing.save();

    // Query 1: guests=4 AND maxPrice=3000
    const conflictingResults = await listingService.getAllListings({
      location: "Testville",
      guests: 4,
      maxPrice: 3000
    });
    assert(
      !conflictingResults.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "SAME-ROOM RULE ENFORCED: Property with Room A (cap 4, price 8000) and Room B (cap 2, price 1500) DOES NOT qualify for guests=4 & maxPrice=3000"
    );

    // Query 2: guests=4 AND minPrice=5000 (Room A satisfies both!)
    const qualifyingResults = await listingService.getAllListings({
      location: "Testville",
      guests: 4,
      minPrice: 5000
    });
    assert(
      qualifyingResults.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "Property qualifies when single room (Room A) satisfies both capacity (4) and minPrice (5000) simultaneously"
    );

    // ----------------------------------------------------
    // TEST 6: Deduplication Check
    // ----------------------------------------------------
    console.log("\n--- 6. RESULT DEDUPLICATION CHECKS ---");
    // Synthetic listing has 2 rooms that both have capacity >= 1 and status AVAILABLE
    const dedupResults = await listingService.getAllListings({ location: "Testville", guests: 1 });
    const countSynthetic = dedupResults.filter((l) => l._id.toString() === syntheticListing._id.toString()).length;
    assert(countSynthetic === 1, `Property appears EXACTLY ONCE in search results even though multiple rooms match (count: ${countSynthetic})`);

    // ----------------------------------------------------
    // TEST 7: Amenities Filter Checks
    // ----------------------------------------------------
    console.log("\n--- 7. AMENITIES FILTER CHECKS ---");
    const wifiResults = await listingService.getAllListings({ amenities: "WiFi" });
    assert(wifiResults.length > 0, `amenities='WiFi' returns properties (${wifiResults.length} found)`);

    const multiAmenityResults = await listingService.getAllListings({ amenities: "WiFi,Air Conditioning" });
    assert(multiAmenityResults.length > 0, `amenities='WiFi,Air Conditioning' returns properties (${multiAmenityResults.length} found)`);

    // ----------------------------------------------------
    // TEST 8: Availability Overlap & Half-Open Interval Checks
    // ----------------------------------------------------
    console.log("\n--- 8. DATE AVAILABILITY & HALF-OPEN INTERVAL CHECKS ---");
    const testCheckIn = "2026-12-01";
    const testCheckOut = "2026-12-05";

    // Before booking, Room A is available
    const preBookingSearch = await listingService.getAllListings({
      location: "Testville",
      roomType: "Suite",
      checkIn: testCheckIn,
      checkOut: testCheckOut
    });
    assert(
      preBookingSearch.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "Property with Suite room is found available before booking"
    );

    // Create an active CONFIRMED booking on Room A for [2026-12-01 to 2026-12-05]
    const testBooking = new Booking({
      bookingNumber: "WL-SEARCH-TEST-1",
      organization: org._id,
      property: syntheticListing._id,
      room: roomA._id,
      guest: owner._id,
      checkIn: new Date(testCheckIn),
      checkOut: new Date(testCheckOut),
      guestsCount: 2,
      totalNights: 4,
      pricePerNight: 8000,
      totalPrice: 32000,
      status: "CONFIRMED",
      guestDetails: { name: "Tester", email: "tester@example.com", phone: "1234567890" }
    });
    await testBooking.save();
    testBookingIds.push(testBooking._id);

    // Overlapping search: Room A is booked for [Dec 1, Dec 5)
    // Search for [Dec 2, Dec 4)
    const overlappingSearch = await listingService.getAllListings({
      location: "Testville",
      roomType: "Suite",
      checkIn: "2026-12-02",
      checkOut: "2026-12-04"
    });
    assert(
      !overlappingSearch.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "Room A with overlapping CONFIRMED booking is excluded from date search"
    );

    // Adjacent search: Check-in on Dec 5 (exact check-out day of test booking)
    const adjacentSearch = await listingService.getAllListings({
      location: "Testville",
      roomType: "Suite",
      checkIn: "2026-12-05",
      checkOut: "2026-12-08"
    });
    assert(
      adjacentSearch.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "Adjacent booking search [new checkIn == old checkOut] succeeds via half-open interval [checkIn, checkOut)"
    );

    // Cancel the booking -> room should become available again
    testBooking.status = "CANCELLED";
    await testBooking.save();

    const cancelledSearch = await listingService.getAllListings({
      location: "Testville",
      roomType: "Suite",
      checkIn: "2026-12-02",
      checkOut: "2026-12-04"
    });
    assert(
      cancelledSearch.some((l) => l._id.toString() === syntheticListing._id.toString()),
      "CANCELLED booking does not block availability (room is available again)"
    );

    // ----------------------------------------------------
    // TEST 9: Sorting Checks
    // ----------------------------------------------------
    console.log("\n--- 9. SORTING CHECKS ---");
    const ascResults = await listingService.getAllListings({ sort: "price_asc", limit: 20 });
    let isAsc = true;
    for (let i = 1; i < ascResults.length; i++) {
      if (ascResults[i].price < ascResults[i - 1].price) {
        isAsc = false;
        break;
      }
    }
    assert(isAsc, "sort='price_asc' returns listings in ascending price order");

    const descResults = await listingService.getAllListings({ sort: "price_desc", limit: 20 });
    let isDesc = true;
    for (let i = 1; i < descResults.length; i++) {
      if (descResults[i].price > descResults[i - 1].price) {
        isDesc = false;
        break;
      }
    }
    assert(isDesc, "sort='price_desc' returns listings in descending price order");

    // ----------------------------------------------------
    // TEST 10: Security Checks
    // ----------------------------------------------------
    console.log("\n--- 10. SECURITY & DATA PRIVACY CHECKS ---");
    const sampleSearch = await listingService.getAllListings({ limit: 5 });
    let privacySafe = true;
    for (const item of sampleSearch) {
      // Must not leak private booking or guest information
      if (item.guestDetails || item.bookings || item.customer) {
        privacySafe = false;
      }
    }
    assert(privacySafe, "Search results strictly contain public property information; zero customer/booking PII leaked");

  } finally {
    // ----------------------------------------------------
    // CLEAN-UP & DATABASE PRESERVATION
    // ----------------------------------------------------
    console.log("\n--- 11. CLEAN-UP & DATABASE PRESERVATION CHECKS ---");
    if (testBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: testBookingIds } });
    }
    if (testRoomIds.length > 0) {
      await Room.deleteMany({ _id: { $in: testRoomIds } });
    }
    if (testListingIds.length > 0) {
      await Listing.deleteMany({ _id: { $in: testListingIds } });
    }

    const roomCount = await Room.countDocuments();
    const listingCount = await Listing.countDocuments();
    const userCount = await User.countDocuments();
    const orgCount = await Organization.countDocuments();
    const reviewCount = await Review.countDocuments();
    const bookingCount = await Booking.countDocuments();

    assert(roomCount === 134, `Room collection preserved at exactly 134 (actual: ${roomCount})`);
    assert(listingCount === 65, `Listing collection preserved at exactly 65 (actual: ${listingCount})`);
    assert(userCount === 6, `User collection preserved at exactly 6 (actual: ${userCount})`);
    assert(orgCount === 1, `Organization collection preserved at exactly 1 (actual: ${orgCount})`);
    assert(reviewCount === 4, `Review collection preserved at exactly 4 (actual: ${reviewCount})`);
    assert(bookingCount === 0, `Booking collection preserved at exactly 0 (actual: ${bookingCount})`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n==================================================");
  console.log(`PHASE 6 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase6TestSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
