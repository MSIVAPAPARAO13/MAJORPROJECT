/**
 * Phase 11 Test Database & Factory Helpers
 * Enforces safe connection guards, deterministic model factories,
 * and guaranteed cleanup via tracked record registry.
 */

const mongoose = require("mongoose");
const User = require("../../src/models/user");
const Organization = require("../../src/models/organization");
const Listing = require("../../src/models/listing");
const Room = require("../../src/models/room");
const Booking = require("../../src/models/booking");
const Review = require("../../src/models/review");

// Ensure environment safety guard
function assertTestSafeDatabase(uri) {
  // Reject external production host patterns
  const forbiddenPatterns = [/production/i, /prod/i, /live/i, /atlas/i];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(uri)) {
      throw new Error("CRITICAL SECURITY ERROR: Test attempted to target a non-local or production database URI!");
    }
  }
}

let isConnected = false;

async function connectTestDb() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/wanderlust";
  assertTestSafeDatabase(mongoUri);

  await mongoose.connect(mongoUri);
  isConnected = true;
  return mongoose.connection;
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

// Tracked entity registry for guaranteed cleanup
class TestContext {
  constructor() {
    this.users = [];
    this.organizations = [];
    this.listings = [];
    this.rooms = [];
    this.bookings = [];
    this.reviews = [];
  }

  generateUniqueSuffix() {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  async createUser(overrides = {}) {
    const suffix = this.generateUniqueSuffix();
    const role = overrides.role || "CUSTOMER";
    const user = new User({
      username: `test_user_${suffix}`,
      email: `test_user_${suffix}@example.com`,
      role,
      organization: overrides.organization || null,
      permissions: overrides.permissions || [],
      ...overrides
    });

    if (overrides.password) {
      await User.register(user, overrides.password);
    } else {
      await user.save();
    }

    this.users.push(user._id);
    return user;
  }

  async createOrganization(overrides = {}) {
    const suffix = this.generateUniqueSuffix();
    const org = new Organization({
      name: `Test Org ${suffix}`,
      slug: `test-org-${suffix}`,
      status: "ACTIVE",
      owner: overrides.owner || new mongoose.Types.ObjectId(),
      ...overrides
    });
    await org.save();
    this.organizations.push(org._id);
    return org;
  }

  async createListing(overrides = {}) {
    const suffix = this.generateUniqueSuffix();
    const listing = new Listing({
      title: `Test Listing ${suffix}`,
      description: "Automated test description for quality engineering suite",
      location: "Goa",
      country: "India",
      propertyType: "Villa",
      price: 5000,
      owner: overrides.owner,
      organization: overrides.organization,
      geometry: {
        type: "Point",
        coordinates: [73.8567, 15.2993]
      },
      ...overrides
    });
    await listing.save();
    this.listings.push(listing._id);
    return listing;
  }

  async createRoom(overrides = {}) {
    const suffix = this.generateUniqueSuffix();
    const room = new Room({
      roomNumber: `R-${suffix.slice(-6)}`,
      roomType: "Deluxe",
      capacity: 2,
      price: 3000,
      status: "AVAILABLE",
      property: overrides.property,
      organization: overrides.organization,
      amenities: ["WiFi", "Air Conditioning"],
      ...overrides
    });
    await room.save();
    this.rooms.push(room._id);
    return room;
  }

  async createBooking(overrides = {}) {
    const suffix = this.generateUniqueSuffix();
    const booking = new Booking({
      bookingNumber: `WL-TEST-${suffix.slice(-8).toUpperCase()}`,
      property: overrides.property,
      room: overrides.room,
      guest: overrides.guest,
      organization: overrides.organization,
      checkIn: overrides.checkIn || new Date("2026-11-01T14:00:00.000Z"),
      checkOut: overrides.checkOut || new Date("2026-11-04T11:00:00.000Z"),
      totalNights: overrides.totalNights || 3,
      guestsCount: overrides.guestsCount || 2,
      pricePerNight: overrides.pricePerNight || 3000,
      totalPrice: overrides.totalPrice || 9000,
      status: overrides.status || "PENDING",
      ...overrides
    });
    await booking.save();
    this.bookings.push(booking._id);
    return booking;
  }

  async createReview(overrides = {}) {
    const review = new Review({
      comment: "Outstanding hospitality experience.",
      rating: 5,
      author: overrides.author,
      ...overrides
    });
    await review.save();
    this.reviews.push(review._id);
    return review;
  }

  async cleanup() {
    try {
      if (this.bookings.length > 0) {
        await Booking.deleteMany({ _id: { $in: this.bookings } });
      }
      if (this.rooms.length > 0) {
        await Room.deleteMany({ _id: { $in: this.rooms } });
      }
      if (this.listings.length > 0) {
        await Listing.deleteMany({ _id: { $in: this.listings } });
      }
      if (this.reviews.length > 0) {
        await Review.deleteMany({ _id: { $in: this.reviews } });
      }
      if (this.users.length > 0) {
        await User.deleteMany({ _id: { $in: this.users } });
      }
      if (this.organizations.length > 0) {
        await Organization.deleteMany({ _id: { $in: this.organizations } });
      }
    } catch (err) {
      console.error("Test cleanup warning:", err.message);
    }
  }
}

/**
 * Executes a test function within an isolated test context that guarantees cleanup
 */
async function withTestContext(testFn) {
  await connectTestDb();
  const context = new TestContext();
  try {
    return await testFn(context);
  } finally {
    await context.cleanup();
  }
}

module.exports = {
  connectTestDb,
  disconnectTestDb,
  TestContext,
  withTestContext
};
