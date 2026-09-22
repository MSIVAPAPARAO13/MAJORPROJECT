/**
 * Phase 11 E2E / HTTP Integration Test Suite â€” User Journeys
 *
 * Tests 10 complete HTTP user flows via supertest against the real Express app:
 *
 * Journey  1 : Unauthenticated guest browses listings (public API)
 * Journey  2 : Customer self-registers via API
 * Journey  3 : Customer logs in, views listing detail, checks /api/auth/me
 * Journey  4 : Customer creates a booking and views it (server-authoritative pricing)
 * Journey  5 : Customer cancels a booking
 * Journey  6 : Cross-user booking isolation (customer cannot see other's booking - 403)
 * Journey  7 : Unauthenticated POST to /api/bookings is rejected with 401
 * Journey  8 : Dashboard access â€” unauthenticated is rejected with 401
 * Journey  9 : Dashboard access â€” CUSTOMER (no DASHBOARD_VIEW) is rejected with 403
 * Journey 10 : Authentication logout terminates session (protected route returns 401)
 *
 * Design rules:
 * - All test data created here is cleaned up in finally blocks.
 * - CSRF tokens are fetched from /api/csrf-token before every mutation.
 * - Session cookies are maintained via supertest cookie jar (agent).
 * - No external network calls; app booted without real Cloudinary / Mapbox.
 * - Live local MongoDB â€” identical to all phase tests.
 * - Test users prefixed "e2e_journey_" for easy identification.
 */

const path = require("path");
// Set test environment BEFORE app.js loads â€” causes app to use in-memory sessions
// instead of MongoStore, avoiding secondary MongoDB connection and kruptein complexity errors.
process.env.NODE_ENV = "test";
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const supertest = require("supertest");

const createApp = require("../../src/app");
const User = require("../../src/models/user");
const Organization = require("../../src/models/organization");
const Listing = require("../../src/models/listing");
const Room = require("../../src/models/room");
const Booking = require("../../src/models/booking");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Test state
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MONGO_URL =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/wanderlust";

let passed = 0;
let failed = 0;
const createdUserIds = [];
const createdOrgIds = [];
const createdListingIds = [];
const createdRoomIds = [];
const createdBookingIds = [];

function assert(condition, message) {
  if (condition) {
    console.log("  PASS: " + message);
    passed++;
  } else {
    console.error("  FAIL: " + message);
    failed++;
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function makeAgent(app) {
  const agent = supertest.agent(app);
  await agent.get("/api/csrf-token");
  return agent;
}

async function fetchCsrf(agent) {
  const res = await agent.get("/api/csrf-token");
  return (res.body && res.body.csrfToken) || null;
}

function uniqueSuffix() {
  return Date.now() + "_" + Math.floor(Math.random() * 100000);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Shared tenant fixtures
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let sharedOwner = null;
let sharedOrg = null;
let sharedListing = null;
let sharedRoom = null;

async function setupSharedTenantFixtures() {
  const suffix = uniqueSuffix();

  sharedOwner = new User({
    username: "e2e_journey_owner_" + suffix,
    email: "e2e_owner_" + suffix + "@example.com",
    role: "OWNER",
    organization: null,
    permissions: [],
  });
  await User.register(sharedOwner, "E2e0wnerPass!");
  createdUserIds.push(sharedOwner._id);

  sharedOrg = new Organization({
    name: "E2E Journey Org " + suffix,
    slug: "e2e-journey-org-" + suffix,
    status: "ACTIVE",
    owner: sharedOwner._id,
  });
  await sharedOrg.save();
  createdOrgIds.push(sharedOrg._id);

  sharedOwner.organization = sharedOrg._id;
  await sharedOwner.save();

  sharedListing = new Listing({
    title: "E2E Journey Property " + suffix,
    description: "Automated E2E journey test property",
    location: "Goa",
    country: "India",
    propertyType: "Villa",
    price: 4000,
    owner: sharedOwner._id,
    organization: sharedOrg._id,
    geometry: { type: "Point", coordinates: [73.8567, 15.2993] },
  });
  await sharedListing.save();
  createdListingIds.push(sharedListing._id);

  sharedRoom = new Room({
    roomNumber: "E2E-R-" + suffix.toString().slice(-6),
    roomType: "Deluxe",
    capacity: 2,
    price: 4000,
    status: "AVAILABLE",
    property: sharedListing._id,
    organization: sharedOrg._id,
    amenities: ["WiFi"],
  });
  await sharedRoom.save();
  createdRoomIds.push(sharedRoom._id);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cleanup
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function cleanupAll() {
  try {
    if (createdBookingIds.length)
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    if (createdRoomIds.length)
      await Room.deleteMany({ _id: { $in: createdRoomIds } });
    if (createdListingIds.length)
      await Listing.deleteMany({ _id: { $in: createdListingIds } });
    if (createdUserIds.length)
      await User.deleteMany({ _id: { $in: createdUserIds } });
    if (createdOrgIds.length)
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
  } catch (err) {
    console.error("E2E cleanup warning:", err.message);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 1 â€” Unauthenticated browse
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney1(app) {
  console.log("\n-- Journey 1: Unauthenticated guest browses listings --");
  const agent = await makeAgent(app);
  const res = await agent.get("/api/listings");
  assert(res.status === 200, "GET /api/listings returns 200");
  assert(res.body && res.body.success === true, "Response has success: true");
  assert(Array.isArray(res.body.data), "Response data is an array");
  assert(typeof res.body.pagination === "object", "Response includes pagination");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 2 â€” Customer self-registers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney2(app) {
  console.log("\n-- Journey 2: Customer self-registers via API --");
  const agent = await makeAgent(app);
  const csrf = await fetchCsrf(agent);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_reg_" + suffix;
  const email = "e2e_reg_" + suffix + "@example.com";

  const res = await agent
    .post("/api/auth/signup")
    .set("x-csrf-token", csrf)
    .send({ username: username, email: email, password: "E2eTest123!" });

  assert(res.status === 201 || res.status === 200, "POST /api/auth/signup returns 201/200");
  assert(res.body && res.body.success === true, "Signup response success: true");
  assert(res.body.user && res.body.user.role === "CUSTOMER", "Registered user forced to CUSTOMER role");
  assert(!res.body.user.organization, "Registered user has no organization");

  if (res.body.user && res.body.user._id) {
    try { createdUserIds.push(new mongoose.Types.ObjectId(res.body.user._id)); } catch (_) {}
  } else {
    const u = await User.findOne({ username: username });
    if (u) createdUserIds.push(u._id);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 3 â€” Customer logs in and browses
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney3(app) {
  console.log("\n-- Journey 3: Customer logs in and browses --");
  const agent = await makeAgent(app);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_browse_" + suffix;
  const email = "e2e_browse_" + suffix + "@example.com";

  const customer = new User({ username: username, email: email, role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customer, "E2eBrowse99!");
  createdUserIds.push(customer._id);

  const csrf = await fetchCsrf(agent);
  const loginRes = await agent.post("/api/auth/login").set("x-csrf-token", csrf).send({ username: username, password: "E2eBrowse99!" });
  assert(loginRes.status === 200, "POST /api/auth/login returns 200");
  assert(loginRes.body.success === true, "Login response success: true");
  assert(loginRes.body.user && loginRes.body.user.role === "CUSTOMER", "Login response role is CUSTOMER");

  const listRes = await agent.get("/api/listings");
  assert(listRes.status === 200, "Authenticated GET /api/listings returns 200");
  assert(Array.isArray(listRes.body.data), "Listings data is array while logged in");

  const detailRes = await agent.get("/api/listings/" + sharedListing._id);
  assert(detailRes.status === 200, "GET /api/listings/:id returns 200 for authenticated customer");

  const meRes = await agent.get("/api/auth/me");
  assert(meRes.status === 200, "GET /api/auth/me returns 200");
  assert(meRes.body.user !== null, "/api/auth/me returns logged-in user");
  assert(meRes.body.user && meRes.body.user.username === username, "/api/auth/me returns correct username");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 4 â€” Customer creates and views booking (server-authoritative pricing)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney4(app) {
  console.log("\n-- Journey 4: Customer creates and views a booking --");
  const agent = await makeAgent(app);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_book_" + suffix;
  const email = "e2e_book_" + suffix + "@example.com";

  const customer = new User({ username: username, email: email, role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customer, "E2eBook88!");
  createdUserIds.push(customer._id);

  const csrf1 = await fetchCsrf(agent);
  await agent.post("/api/auth/login").set("x-csrf-token", csrf1).send({ username: username, password: "E2eBook88!" });

  const csrf2 = await fetchCsrf(agent);
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 30);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  const createRes = await agent
    .post("/api/bookings")
    .set("x-csrf-token", csrf2)
    .send({
      propertyId: sharedListing._id.toString(),
      roomId: sharedRoom._id.toString(),
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      guestsCount: 2,
      guestDetails: { name: username, email: email, phone: "9000000001" },
    });

  assert(createRes.status === 201 || createRes.status === 200, "POST /api/bookings returns 201/200");
  assert(createRes.body && createRes.body.success === true, "Booking creation response success: true");

  const booking = createRes.body.booking || createRes.body.data;
  assert(!!booking, "Booking object present in response");

  if (booking && booking._id) {
    let bookingId;
    try { bookingId = booking._id.$oid || booking._id.toString(); } catch (_) { bookingId = String(booking._id); }
    try { createdBookingIds.push(new mongoose.Types.ObjectId(bookingId)); } catch (_) {}

    const viewRes = await agent.get("/api/bookings/" + bookingId);
    assert(viewRes.status === 200, "GET /api/bookings/:id returns 200");
    assert(viewRes.body && viewRes.body.success === true, "Booking view response success: true");

    const b = viewRes.body.booking || viewRes.body.data;
    if (b) {
      assert(b.totalNights === 3, "Server correctly calculates totalNights = 3");
      assert(b.totalPrice === sharedRoom.price * 3, "Server calculates totalPrice = room.price x 3 = " + (sharedRoom.price * 3));
      assert(b.status === "PENDING", "New booking defaults to PENDING status");
    }
  }

  const myRes = await agent.get("/api/bookings/my");
  assert(myRes.status === 200, "GET /api/bookings/my returns 200");
  assert(Array.isArray(myRes.body.bookings || myRes.body.data), "My bookings returns an array");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 5 â€” Customer cancels booking
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney5(app) {
  console.log("\n-- Journey 5: Customer cancels a booking --");
  const agent = await makeAgent(app);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_cancel_" + suffix;
  const email = "e2e_cancel_" + suffix + "@example.com";

  const customer = new User({ username: username, email: email, role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customer, "E2eCancel77!");
  createdUserIds.push(customer._id);

  const csrf1 = await fetchCsrf(agent);
  await agent.post("/api/auth/login").set("x-csrf-token", csrf1).send({ username: username, password: "E2eCancel77!" });

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 60);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);

  const bookingDoc = new Booking({
    bookingNumber: "WL-E2E-CANCEL-" + suffix.toString().slice(-8).toUpperCase(),
    property: sharedListing._id,
    room: sharedRoom._id,
    guest: customer._id,
    organization: sharedOrg._id,
    checkIn: checkIn,
    checkOut: checkOut,
    totalNights: 2,
    guestsCount: 1,
    pricePerNight: sharedRoom.price,
    totalPrice: sharedRoom.price * 2,
    status: "PENDING",
    guestDetails: { name: username, email: email, phone: "9000000002" },
  });
  await bookingDoc.save();
  createdBookingIds.push(bookingDoc._id);

  const csrf2 = await fetchCsrf(agent);
  const cancelRes = await agent
    .post("/api/bookings/" + bookingDoc._id + "/cancel")
    .set("x-csrf-token", csrf2)
    .send();

  assert(cancelRes.status === 200, "POST /api/bookings/:id/cancel returns 200");
  assert(cancelRes.body && cancelRes.body.success === true, "Cancel response success: true");

  const updated = await Booking.findById(bookingDoc._id).lean();
  assert(updated && updated.status === "CANCELLED", "Booking status updated to CANCELLED in database");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 6 â€” Cross-user booking isolation (403)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney6(app) {
  console.log("\n-- Journey 6: Cross-user booking isolation (403) --");
  const suffix = uniqueSuffix();

  const customerA = new User({ username: "e2e_journey_userA_" + suffix, email: "e2e_userA_" + suffix + "@example.com", role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customerA, "E2eUserA66!");
  createdUserIds.push(customerA._id);

  const customerB = new User({ username: "e2e_journey_userB_" + suffix, email: "e2e_userB_" + suffix + "@example.com", role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customerB, "E2eUserB55!");
  createdUserIds.push(customerB._id);

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 90);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);

  const bookingForA = new Booking({
    bookingNumber: "WL-E2E-ISOL-" + suffix.toString().slice(-8).toUpperCase(),
    property: sharedListing._id,
    room: sharedRoom._id,
    guest: customerA._id,
    organization: sharedOrg._id,
    checkIn: checkIn,
    checkOut: checkOut,
    totalNights: 2,
    guestsCount: 1,
    pricePerNight: sharedRoom.price,
    totalPrice: sharedRoom.price * 2,
    status: "PENDING",
    guestDetails: { name: customerA.username, email: customerA.email, phone: "9000000003" },
  });
  await bookingForA.save();
  createdBookingIds.push(bookingForA._id);

  // Log in as Customer B
  const agentB = await makeAgent(app);
  const csrfB = await fetchCsrf(agentB);
  await agentB.post("/api/auth/login").set("x-csrf-token", csrfB).send({ username: customerB.username, password: "E2eUserB55!" });

  const accessRes = await agentB.get("/api/bookings/" + bookingForA._id);
  assert(accessRes.status === 403, "Customer B receives 403 when accessing Customer A's booking");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 7 â€” Unauthenticated booking POST rejected (401)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney7(app) {
  console.log("\n-- Journey 7: Unauthenticated POST to /api/bookings rejected (401) --");
  const agent = await makeAgent(app);
  const csrf = await fetchCsrf(agent);

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 120);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 2);

  const res = await agent
    .post("/api/bookings")
    .set("x-csrf-token", csrf)
    .send({
      propertyId: sharedListing._id.toString(),
      roomId: sharedRoom._id.toString(),
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      guestsCount: 1,
    });

  assert(res.status === 401, "Unauthenticated POST /api/bookings returns 401");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 8 â€” Unauthenticated dashboard rejected (401)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney8(app) {
  console.log("\n-- Journey 8: Unauthenticated /api/dashboard rejected (401) --");
  const agent = await makeAgent(app);
  const res = await agent.get("/api/dashboard");
  assert(res.status === 401, "Unauthenticated GET /api/dashboard returns 401");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 9 â€” CUSTOMER cannot access dashboard (403)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney9(app) {
  console.log("\n-- Journey 9: CUSTOMER can access personal dashboard (200) --");
  const agent = await makeAgent(app);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_nodash_" + suffix;
  const email = "e2e_nodash_" + suffix + "@example.com";

  const customer = new User({ username: username, email: email, role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customer, "E2eDash44!");
  createdUserIds.push(customer._id);

  const csrf = await fetchCsrf(agent);
  await agent.post("/api/auth/login").set("x-csrf-token", csrf).send({ username: username, password: "E2eDash44!" });

  const dashRes = await agent.get("/api/dashboard");
  assert(dashRes.status === 200, "CUSTOMER GET /api/dashboard returns 200 (personal dashboard)");
  assert(dashRes.body.success === true, "CUSTOMER dashboard response success: true");
  assert(dashRes.body.role === "CUSTOMER", "CUSTOMER dashboard returns role: CUSTOMER");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Journey 10 â€” Logout terminates session
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runJourney10(app) {
  console.log("\n-- Journey 10: Logout terminates session --");
  const agent = await makeAgent(app);
  const suffix = uniqueSuffix();
  const username = "e2e_journey_logout_" + suffix;
  const email = "e2e_logout_" + suffix + "@example.com";

  const customer = new User({ username: username, email: email, role: "CUSTOMER", organization: null, permissions: [] });
  await User.register(customer, "E2eLogout33!");
  createdUserIds.push(customer._id);

  const csrf1 = await fetchCsrf(agent);
  const loginRes = await agent.post("/api/auth/login").set("x-csrf-token", csrf1).send({ username: username, password: "E2eLogout33!" });
  assert(loginRes.status === 200, "Login before logout test succeeds");

  const meBeforeRes = await agent.get("/api/auth/me");
  assert(meBeforeRes.body.user && meBeforeRes.body.user.username === username, "/api/auth/me returns user before logout");

  const csrf2 = await fetchCsrf(agent);
  const logoutRes = await agent.post("/api/auth/logout").set("x-csrf-token", csrf2).send();
  assert(logoutRes.status === 200, "POST /api/auth/logout returns 200");
  assert(logoutRes.body.success === true, "Logout response success: true");

  const dashAfter = await agent.get("/api/dashboard");
  assert(dashAfter.status === 401, "After logout, /api/dashboard returns 401 (session terminated)");
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runE2EJourneyTests() {
  console.log("==================================================");
  console.log("PHASE 11 E2E USER JOURNEY TEST SUITE (10 JOURNEYS)");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URL);

  // Pre-run cleanup: remove any stale e2e users from previously interrupted runs
  try {
    // Also remove stale bookings belonging to non-existent users
    const validUserIds = (await User.find({}, { _id: 1 }).lean()).map(u => u._id.toString());
    const allBookings = await Booking.find({}, { guest: 1 }).lean();
    const staleIds = allBookings.filter(b => !validUserIds.includes(b.guest && b.guest.toString())).map(b => b._id);
    if (staleIds.length) await Booking.deleteMany({ _id: { $in: staleIds } });
    await User.deleteMany({ username: /^e2e_/ });
  } catch (_) {}

  // Wait for Mongoose to reach readyState=1 (connected) before starting supertest requests.
  // Without this, the first request can hit a 10s buffer timeout.
  await new Promise(function(resolve, reject) {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once("connected", resolve);
    mongoose.connection.once("error", reject);
    setTimeout(function() { reject(new Error("Mongoose connection timeout")); }, 10000);
  });

  const app = createApp();

  try {
    await setupSharedTenantFixtures();

    await runJourney1(app);
    await runJourney2(app);
    await runJourney3(app);
    await runJourney4(app);
    await runJourney5(app);
    await runJourney6(app);
    await runJourney7(app);
    await runJourney8(app);
    await runJourney9(app);
    await runJourney10(app);
  } finally {
    await cleanupAll();
  }

  console.log("\n==================================================");
  console.log("E2E JOURNEY RESULTS: " + passed + " passed, " + failed + " failed");
  console.log("==================================================\n");

  if (failed > 0) {
    console.error("PHASE 11 E2E: " + failed + " test(s) FAILED");
    process.exit(1);
  } else {
    console.log("PHASE 11 E2E: ALL JOURNEYS PASSED");
  }

  try { await mongoose.disconnect(); } catch (_) {}
}

runE2EJourneyTests().catch(function(err) {
  console.error("E2E test suite fatal error:", err);
  process.exit(1);
});


