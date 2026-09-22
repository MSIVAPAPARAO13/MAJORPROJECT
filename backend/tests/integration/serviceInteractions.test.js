/**
 * Phase 11 Service Interactions Integration Test Suite
 * Validates cross-service flows:
 * 1. Authentication -> User -> Organization
 * 2. Organization -> Listing -> Room
 * 3. Room -> Booking -> Customer
 * 4. Listing -> Image -> Cloudinary (using external mock)
 * 5. Listing -> Location -> Mapbox (using external mock)
 * 6. Booking -> Dashboard Analytics
 * 7. Review -> Listing -> User
 * 8. Search -> Room -> Availability -> Listing
 */

const mongoose = require("mongoose");
const userService = require("../../src/services/userService");
const listingService = require("../../src/services/listingService");
const roomService = require("../../src/services/roomService");
const bookingService = require("../../src/services/bookingService");
const reviewService = require("../../src/services/reviewService");
const dashboardService = require("../../src/services/dashboardService");
const { withTestContext, disconnectTestDb } = require("../helpers/testDb");
const { mockCloudinary, mockMapbox } = require("../helpers/mockExternal");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runServiceInteractionsTests() {
  console.log("==================================================");
  console.log("PHASE 11 SERVICE INTERACTIONS TEST SUITE");
  console.log("==================================================\n");

  await withTestContext(async (ctx) => {
    // ----------------------------------------------------
    // 1. Authentication -> User -> Organization
    // ----------------------------------------------------
    console.log("--- 1. AUTHENTICATION -> USER -> ORGANIZATION ---");
    const ownerUser = await ctx.createUser({ role: "OWNER" });
    const org = await ctx.createOrganization({ owner: ownerUser._id, name: "Alpha Grand Resorts" });
    ownerUser.organization = org._id;
    await ownerUser.save();

    assert(ownerUser.role === "OWNER", "User registered with OWNER role");
    assert(String(ownerUser.organization) === String(org._id), "User bound to Organization");
    assert(String(org.owner) === String(ownerUser._id), "Organization bound to Owner User");

    // ----------------------------------------------------
    // 2. Organization -> Listing -> Room
    // ----------------------------------------------------
    console.log("\n--- 2. ORGANIZATION -> LISTING -> ROOM ---");
    const listing = await ctx.createListing({
      title: "Alpha Luxury Ocean Villa",
      owner: ownerUser._id,
      organization: org._id
    });
    const roomA = await ctx.createRoom({
      property: listing._id,
      organization: org._id,
      roomNumber: "A-101",
      roomType: "Deluxe",
      capacity: 2,
      price: 4000
    });
    const roomB = await ctx.createRoom({
      property: listing._id,
      organization: org._id,
      roomNumber: "A-102",
      roomType: "Suite",
      capacity: 4,
      price: 8000
    });

    assert(String(listing.organization) === String(org._id), "Listing inherits Organization reference");
    assert(String(roomA.property) === String(listing._id), "Room A points to parent Listing");
    assert(String(roomB.organization) === String(org._id), "Room B inherits parent Organization reference");

    // ----------------------------------------------------
    // 3. Room -> Booking -> Customer
    // ----------------------------------------------------
    console.log("\n--- 3. ROOM -> BOOKING -> CUSTOMER ---");
    const customer = await ctx.createUser({ role: "CUSTOMER" });
    const booking = await bookingService.createBooking({
      propertyId: listing._id,
      roomId: roomA._id,
      checkIn: "2026-11-10T14:00:00.000Z",
      checkOut: "2026-11-13T11:00:00.000Z",
      guestsCount: 2
    }, customer);
    ctx.bookings.push(booking._id);

    assert(String(booking.room) === String(roomA._id), "Booking points to Room A");
    assert(String(booking.property) === String(listing._id), "Booking points to parent Property");
    assert(String(booking.guest) === String(customer._id), "Booking bound to authenticated Customer");
    assert(booking.totalPrice === 12000, "Booking calculated accurate price (3 nights * 4000 = 12000)");

    // ----------------------------------------------------
    // 4. Listing -> Image -> Cloudinary Mock
    // ----------------------------------------------------
    console.log("\n--- 4. LISTING -> IMAGE -> CLOUDINARY MOCK ---");
    const mockUploadResult = await mockCloudinary.v2.uploader.upload("dummy_buffer", {
      public_id: `wanderlust_DEV/villa_${Date.now()}`
    });
    assert(mockUploadResult.public_id.startsWith("wanderlust_DEV/"), "Cloudinary mock generates deterministic public ID");
    assert(mockUploadResult.secure_url.includes("res.cloudinary.com"), "Cloudinary mock generates secure CDN URL");

    listing.images.push({
      url: mockUploadResult.secure_url,
      publicId: mockUploadResult.public_id,
      isPrimary: true,
      position: 0
    });
    listing.image = {
      url: mockUploadResult.secure_url,
      filename: mockUploadResult.public_id
    };
    await listing.save();

    assert(listing.images.length === 1, "Image added to listing successfully");
    assert(listing.image.url === mockUploadResult.secure_url, "Listing primary image mirror synchronized");

    // ----------------------------------------------------
    // 5. Listing -> Location -> Mapbox Mock
    // ----------------------------------------------------
    console.log("\n--- 5. LISTING -> LOCATION -> MAPBOX MOCK ---");
    const geocodeRes = await mockMapbox.geocoding().forwardGeocode({ query: "New Delhi, India" }).send();
    const coords = geocodeRes.body.features[0].geometry.coordinates;
    assert(Array.isArray(coords) && coords.length === 2, "Mapbox mock returns valid GeoJSON coordinates [lng, lat]");
    assert(coords[0] === 77.2090 && coords[1] === 28.6139, "Mapbox coordinates match deterministic fallback [77.2090, 28.6139]");

    // ----------------------------------------------------
    // 6. Booking -> Dashboard Analytics
    // ----------------------------------------------------
    console.log("\n--- 6. BOOKING -> DASHBOARD ANALYTICS ---");
    // Confirm booking to reflect in realized financials
    booking.status = "CONFIRMED";
    await booking.save();

    const ownerDashboard = await dashboardService.getOrganizationDashboard(org._id);
    assert(ownerDashboard !== null, "Owner dashboard retrieved successfully");
    assert(ownerDashboard.summary.confirmedCompletedValue >= 12000, "Dashboard reflects confirmed booking value");

    // ----------------------------------------------------
    // 7. Review -> Listing -> User
    // ----------------------------------------------------
    console.log("\n--- 7. REVIEW -> LISTING -> USER ---");
    const review = await reviewService.addReview(listing._id, {
      comment: "Superb villa experience with pristine ocean views.",
      rating: 5
    }, customer._id);
    ctx.reviews.push(review._id);


    assert(String(review.author) === String(customer._id), "Review author bound to Customer");
    const reloadedListing = await listingService.getListingById(listing._id);
    const hasReview = reloadedListing.reviews.some(r => String(r._id || r) === String(review._id));
    assert(hasReview, "Listing contains reference to created Review");

    // ----------------------------------------------------
    // 8. Search -> Room -> Availability -> Listing
    // ----------------------------------------------------
    console.log("\n--- 8. SEARCH -> ROOM -> AVAILABILITY -> LISTING ---");
    // Search for Room B dates (Room B has capacity 4, Room A has capacity 2)
    const searchRes = await listingService.getAllListings({
      location: "Goa",
      guests: 4
    });
    const foundOurListing = searchRes.some(l => String(l._id) === String(listing._id));
    assert(foundOurListing, "Listing returned because Room B satisfies guests=4 capacity");

    // Search with overlapping dates for Room A (Nov 10-13) with guests=2 (should find listing via Room B, or exclude if only room matching was Room A)
    const dateSearch = await listingService.getAllListings({
      location: "Goa",
      checkIn: "2026-11-11",
      checkOut: "2026-11-12",
      guests: 2
    });
    assert(dateSearch.some(l => String(l._id) === String(listing._id)), "Listing remains available via non-booked Room B");
  });

  await disconnectTestDb();

  console.log("\n==================================================");
  console.log(`PHASE 11 SERVICE INTERACTIONS RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runServiceInteractionsTests().catch(err => {
    console.error("Service interactions execution error:", err);
    process.exit(1);
  });
}

module.exports = { runServiceInteractionsTests };
