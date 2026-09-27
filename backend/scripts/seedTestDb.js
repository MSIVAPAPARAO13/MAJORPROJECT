/**
 * Local Test Database Seeder
 * STRICT SAFETY RULE: Only runs against isolated test database (TEST_MONGODB_URI).
 * NEVER touches or connects to production MongoDB Atlas.
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const Booking = require("../src/models/booking");
const ServiceIssue = require("../src/models/serviceIssue");
const Review = require("../src/models/review");
const UserPreference = require("../src/models/userPreference");

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/wanderlust_test";

// Critical Safety Verification: Abort if pointed at Atlas production
if (
  TEST_DB_URI.includes("mongodb.net") ||
  TEST_DB_URI.includes("cluster") ||
  (process.env.ATLASDB_URL && TEST_DB_URI === process.env.ATLASDB_URL)
) {
  console.error("CRITICAL SAFETY ERROR: Attempted to run test seed against production Atlas cluster! Aborting immediately.");
  process.exit(1);
}

async function seedTestData() {
  console.log(`Connecting to isolated test database: ${TEST_DB_URI}...`);
  await mongoose.connect(TEST_DB_URI);

  console.log("Purging existing test database collections...");
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Listing.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
    ServiceIssue.deleteMany({}),
    Review.deleteMany({}),
    UserPreference.deleteMany({})
  ]);

  console.log("Seeding test users (all roles)...");
  const defaultPassword = "TestPassword123!";

  // 1. Create Organization Owner First
  const ownerUser = await User.register(
    new User({
      username: "owner@test.local",
      email: "owner@test.local",
      role: "OWNER"
    }),
    defaultPassword
  );

  // 2. Create Organization
  const organization = await Organization.create({
    name: "Apex Hospitality Group",
    description: "Enterprise test organization portfolio",
    owner: ownerUser._id,
    members: [{ user: ownerUser._id, role: "OWNER" }],
    contactEmail: "owner@test.local",
    phone: "+91 9999988888",
    address: "Suite 404, Tech Park, Hyderabad, India"
  });

  ownerUser.organization = organization._id;
  await ownerUser.save();

  // 3. Create Staff, Manager, Admin, and Customer
  const managerUser = await User.register(
    new User({
      username: "manager@test.local",
      email: "manager@test.local",
      role: "MANAGER",
      organization: organization._id
    }),
    defaultPassword
  );

  const staffUser = await User.register(
    new User({
      username: "staff@test.local",
      email: "staff@test.local",
      role: "STAFF",
      organization: organization._id
    }),
    defaultPassword
  );

  const adminUser = await User.register(
    new User({
      username: "admin@test.local",
      email: "admin@test.local",
      role: "ADMIN"
    }),
    defaultPassword
  );

  const customerUser = await User.register(
    new User({
      username: "customer@test.local",
      email: "customer@test.local",
      role: "CUSTOMER",
      organization: null
    }),
    defaultPassword
  );

  organization.members.push(
    { user: managerUser._id, role: "MANAGER" },
    { user: staffUser._id, role: "STAFF" }
  );
  await organization.save();

  // 4. Seed Property (Listing)
  console.log("Seeding property and rooms...");
  const listing = await Listing.create({
    title: "Apex Grand Seaside Resort",
    description: "Luxury beachfront stay with state of the art amenities and sea views.",
    image: {
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      filename: "test_resort_img"
    },
    images: [{
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      filename: "test_resort_img",
      isPrimary: true
    }],
    price: 6500,
    location: "Goa",
    country: "India",
    geometry: { type: "Point", coordinates: [73.74, 15.55] },
    propertyType: "RESORT",
    category: "Trending",
    organization: organization._id,
    owner: ownerUser._id,
    isLive: true
  });

  // 5. Seed Rooms (Varied states: Available, Occupied, Maintenance, Resolved)
  const room1 = await Room.create({
    roomNumber: "101",
    roomType: "Deluxe",
    price: 4500,
    capacity: 2,
    bedType: "King",
    amenities: ["AC", "WiFi", "Balcony", "Sea View"],
    property: listing._id,
    organization: organization._id,
    status: "AVAILABLE"
  });

  const room2 = await Room.create({
    roomNumber: "102",
    roomType: "Suite",
    price: 7500,
    capacity: 4,
    bedType: "Two Queen Beds",
    amenities: ["AC", "WiFi", "Living Area", "Mini Bar"],
    property: listing._id,
    organization: organization._id,
    status: "OCCUPIED"
  });

  const room3 = await Room.create({
    roomNumber: "103",
    roomType: "Suite",
    price: 12000,
    capacity: 6,
    bedType: "King Suite",
    amenities: ["Private Pool", "Butler", "Jacuzzi", "Sea View"],
    property: listing._id,
    organization: organization._id,
    status: "MAINTENANCE"
  });

  const room4 = await Room.create({
    roomNumber: "104",
    roomType: "Deluxe",
    price: 4000,
    capacity: 2,
    bedType: "Queen",
    amenities: ["AC", "WiFi", "Garden View"],
    property: listing._id,
    organization: organization._id,
    status: "AVAILABLE"
  });

  // 6. Seed Service Issues
  console.log("Seeding service issues...");
  // Unresolved issue on Room 3 (Causes Guest Impact Alert when upcoming booking exists)
  const issueUnresolved = await ServiceIssue.create({
    property: listing._id,
    room: room3._id,
    organization: organization._id,
    title: "Air Conditioning Compressor Malfunction",
    description: "HVAC master compressor tripped breaker; replacement part dispatched.",
    priority: "HIGH",
    status: "IN_PROGRESS",
    assignedTo: staffUser._id,
    createdBy: managerUser._id
  });

  // Resolved issue on Room 4
  const issueResolved = await ServiceIssue.create({
    property: listing._id,
    room: room4._id,
    organization: organization._id,
    title: "Water Heater Valve Servicing",
    description: "Scheduled preventive maintenance completed and inspected.",
    priority: "LOW",
    status: "RESOLVED",
    resolvedAt: new Date(Date.now() - 3600000),
    assignedTo: staffUser._id,
    createdBy: staffUser._id
  });

  // 7. Seed Bookings
  console.log("Seeding bookings (varied states)...");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // Booking 1: Upcoming booking on Room 3 -> TRIGGERS GUEST IMPACT ALERT (room has unresolved issue)
  await Booking.create({
    bookingNumber: "BK-TEST-IMPACT-01",
    guest: customerUser._id,
    guestDetails: {
      name: "Alice Walker",
      email: "alice@test.local",
      phone: "+91 9888877777"
    },
    property: listing._id,
    room: room3._id,
    organization: organization._id,
    checkIn: tomorrow,
    checkOut: threeDaysLater,
    guestsCount: 2,
    pricePerNight: 12000,
    totalNights: 2,
    totalPrice: 28320,
    status: "CONFIRMED"
  });

  // Booking 2: Upcoming booking on Room 1 (Guest Ready - no issues)
  await Booking.create({
    bookingNumber: "BK-TEST-CLEAN-02",
    guest: customerUser._id,
    guestDetails: {
      name: "Bob Martin",
      email: "bob@test.local",
      phone: "+91 9777766666"
    },
    property: listing._id,
    room: room1._id,
    organization: organization._id,
    checkIn: tomorrow,
    checkOut: threeDaysLater,
    guestsCount: 2,
    pricePerNight: 4500,
    totalNights: 2,
    totalPrice: 10620,
    status: "CONFIRMED"
  });

  // Booking 3: Completed historical booking
  await Booking.create({
    bookingNumber: "BK-TEST-COMPLETED-03",
    guest: customerUser._id,
    guestDetails: {
      name: "Carol Danvers",
      email: "carol@test.local",
      phone: "+91 9666655555"
    },
    property: listing._id,
    room: room2._id,
    organization: organization._id,
    checkIn: lastWeek,
    checkOut: fiveDaysAgo,
    guestsCount: 2,
    pricePerNight: 7500,
    totalNights: 2,
    totalPrice: 17700,
    status: "COMPLETED"
  });

  // Booking 4: Cancelled booking
  await Booking.create({
    bookingNumber: "BK-TEST-CANCELLED-04",
    guest: customerUser._id,
    guestDetails: {
      name: "David Miller",
      email: "david@test.local",
      phone: "+91 9555544444"
    },
    property: listing._id,
    room: room1._id,
    organization: organization._id,
    checkIn: tomorrow,
    checkOut: threeDaysLater,
    guestsCount: 1,
    pricePerNight: 4500,
    totalNights: 2,
    totalPrice: 10620,
    status: "CANCELLED"
  });

  // 8. Seed User Preferences
  console.log("Seeding user preferences...");
  await UserPreference.create({
    user: ownerUser._id,
    theme: "light",
    density: "comfortable",
    sidebarState: "expanded",
    notifications: true
  });
  await UserPreference.create({
    user: managerUser._id,
    theme: "dark",
    density: "compact",
    sidebarState: "expanded",
    notifications: true
  });

  console.log("\n==================================================");
  console.log("TEST DATABASE SEED COMPLETED SUCCESSFULLY");
  console.log("Database: " + TEST_DB_URI);
  console.log("Test Credentials (Password: " + defaultPassword + "):");
  console.log("  ADMIN:    admin@test.local");
  console.log("  OWNER:    owner@test.local");
  console.log("  MANAGER:  manager@test.local");
  console.log("  STAFF:    staff@test.local");
  console.log("  CUSTOMER: customer@test.local");
  console.log("==================================================");

  await mongoose.disconnect();
}

seedTestData().catch((err) => {
  console.error("Test seed error:", err);
  process.exit(1);
});
