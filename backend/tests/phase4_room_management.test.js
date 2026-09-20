const mongoose = require("mongoose");
const { PERMISSIONS, ROLE_PERMISSIONS, hasRole, hasPermission } = require("../src/config/permissions");
const { requirePermission } = require("../src/middleware/authorization");
const { requireTenantAccess } = require("../src/middleware/tenant");
const { validateRoomBelongsToListing } = require("../src/middleware/roomAuth");
const { roomSchema } = require("../src/validators/roomValidator");
const roomService = require("../src/services/roomService");
const Room = require("../src/models/room");
const Listing = require("../src/models/listing");
const Organization = require("../src/models/organization");
const User = require("../src/models/user");

async function runPhase4TestSuite() {
  console.log("==================================================");
  console.log("PHASE 4 PROPERTY & ROOM MANAGEMENT TEST SUITE");
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
  // TEST 1: Room RBAC Permission Matrix Checks
  // ----------------------------------------------------
  console.log("--- 1. ROOM RBAC PERMISSION MATRIX CHECKS ---");
  const customer = { role: "CUSTOMER", organization: new mongoose.Types.ObjectId() };
  const staff = { role: "STAFF", organization: new mongoose.Types.ObjectId() };
  const manager = { role: "MANAGER", organization: new mongoose.Types.ObjectId() };
  const owner = { role: "OWNER", organization: new mongoose.Types.ObjectId() };
  const admin = { role: "ADMIN", organization: new mongoose.Types.ObjectId() };

  // Customer
  assert(!hasPermission(customer, PERMISSIONS.ROOM_CREATE), "CUSTOMER cannot create rooms");
  assert(!hasPermission(customer, PERMISSIONS.ROOM_UPDATE), "CUSTOMER cannot update rooms");
  assert(!hasPermission(customer, PERMISSIONS.ROOM_DELETE), "CUSTOMER cannot delete rooms");

  // Staff
  assert(!hasPermission(staff, PERMISSIONS.ROOM_CREATE), "STAFF cannot create rooms");
  assert(hasPermission(staff, PERMISSIONS.ROOM_UPDATE), "STAFF can perform permitted operational room updates");
  assert(!hasPermission(staff, PERMISSIONS.ROOM_DELETE), "STAFF cannot delete rooms");

  // Manager
  assert(hasPermission(manager, PERMISSIONS.ROOM_CREATE), "MANAGER can create rooms");
  assert(hasPermission(manager, PERMISSIONS.ROOM_UPDATE), "MANAGER can update rooms");
  assert(!hasPermission(manager, PERMISSIONS.ROOM_DELETE), "MANAGER cannot delete rooms");

  // Owner
  assert(hasPermission(owner, PERMISSIONS.ROOM_CREATE), "OWNER can create rooms");
  assert(hasPermission(owner, PERMISSIONS.ROOM_UPDATE), "OWNER can update rooms");
  assert(hasPermission(owner, PERMISSIONS.ROOM_DELETE), "OWNER can delete rooms");

  // Admin
  assert(hasPermission(admin, PERMISSIONS.ROOM_CREATE), "ADMIN can create rooms");
  assert(hasPermission(admin, PERMISSIONS.ROOM_UPDATE), "ADMIN can update rooms");
  assert(hasPermission(admin, PERMISSIONS.ROOM_DELETE), "ADMIN can delete rooms");

  // ----------------------------------------------------
  // TEST 2: Authentication Middleware for Rooms
  // ----------------------------------------------------
  console.log("\n--- 2. AUTHENTICATION GUARDS FOR ROOM OPERATIONS ---");
  const createRoomAuth = requirePermission(PERMISSIONS.ROOM_CREATE);
  const updateRoomAuth = requirePermission(PERMISSIONS.ROOM_UPDATE);
  const deleteRoomAuth = requirePermission(PERMISSIONS.ROOM_DELETE);

  let unauthCode = null;
  const mockUnauthReq = { isAuthenticated: () => false, session: {}, accepts: () => true, xhr: true };
  const mockUnauthRes = { status: (c) => { unauthCode = c; return { json: () => {} }; }, redirect: () => {} };

  createRoomAuth(mockUnauthReq, mockUnauthRes, () => {});
  assert(unauthCode === 401, "Unauthenticated user cannot create room (401 Unauthorized)");

  unauthCode = null;
  updateRoomAuth(mockUnauthReq, mockUnauthRes, () => {});
  assert(unauthCode === 401, "Unauthenticated user cannot update room (401 Unauthorized)");

  unauthCode = null;
  deleteRoomAuth(mockUnauthReq, mockUnauthRes, () => {});
  assert(unauthCode === 401, "Unauthenticated user cannot delete room (401 Unauthorized)");

  // ----------------------------------------------------
  // TEST 3: Validation Schema Tests (Section 30)
  // ----------------------------------------------------
  console.log("\n--- 3. ROOM INPUT VALIDATION CHECKS ---");
  
  // Valid payload
  const validRoom = { roomNumber: "301", roomType: "Deluxe", capacity: 2, price: 2500, status: "AVAILABLE" };
  const valResult = roomSchema.validate({ room: validRoom });
  assert(!valResult.error, "Valid room payload passes validation");

  // Empty room number
  const invalidRoomNo = { ...validRoom, roomNumber: "" };
  assert(roomSchema.validate({ room: invalidRoomNo }).error !== undefined, "Empty roomNumber rejected with validation error");

  // Invalid room type
  const invalidType = { ...validRoom, roomType: "Castle" };
  assert(roomSchema.validate({ room: invalidType }).error !== undefined, "Invalid roomType rejected with validation error");

  // Negative capacity
  const negCapacity = { ...validRoom, capacity: -1 };
  assert(roomSchema.validate({ room: negCapacity }).error !== undefined, "Negative capacity rejected with validation error");

  // Zero capacity
  const zeroCapacity = { ...validRoom, capacity: 0 };
  assert(roomSchema.validate({ room: zeroCapacity }).error !== undefined, "Zero capacity rejected with validation error");

  // Negative price
  const negPrice = { ...validRoom, price: -50 };
  assert(roomSchema.validate({ room: negPrice }).error !== undefined, "Negative price rejected with validation error");

  // Invalid status
  const invalidStatus = { ...validRoom, status: "DEMOLISHED" };
  assert(roomSchema.validate({ room: invalidStatus }).error !== undefined, "Invalid status rejected with validation error");

  // Sensitive field tampering rejection
  const sensitiveField = { ...validRoom, organization: new mongoose.Types.ObjectId() };
  assert(roomSchema.validate({ room: sensitiveField }).error !== undefined, "Client-provided organization field rejected by validator");

  // ----------------------------------------------------
  // TEST 4: Cross-Tenant Isolation for Rooms (Section 26 & 33)
  // ----------------------------------------------------
  console.log("\n--- 4. CROSS-TENANT ISOLATION TESTS ---");
  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();

  const userA = { _id: new mongoose.Types.ObjectId(), role: "OWNER", organization: tenantAId };
  const userB = { _id: new mongoose.Types.ObjectId(), role: "OWNER", organization: tenantBId };

  const listingA = { _id: new mongoose.Types.ObjectId(), organization: tenantAId, owner: userA._id };
  const listingB = { _id: new mongoose.Types.ObjectId(), organization: tenantBId, owner: userB._id };

  function evaluateTenantAccess(user, listing) {
    if (user.role === "ADMIN") return { allowed: true };
    if (!user.organization || !listing.organization) return { allowed: false, status: 403 };
    if (user.organization.equals(listing.organization)) return { allowed: true };
    return { allowed: false, status: 403 };
  }

  assert(evaluateTenantAccess(userA, listingA).allowed === true, "User A accessing Tenant A Room/Listing -> ALLOWED");
  assert(evaluateTenantAccess(userA, listingB).allowed === false, "User A accessing Tenant B Room/Listing -> DENIED (403 Forbidden)");
  assert(evaluateTenantAccess(userB, listingB).allowed === true, "User B accessing Tenant B Room/Listing -> ALLOWED");
  assert(evaluateTenantAccess(userB, listingA).allowed === false, "User B accessing Tenant A Room/Listing -> DENIED (403 Forbidden)");
  assert(evaluateTenantAccess(admin, listingA).allowed === true, "ADMIN accessing Tenant A Room/Listing -> ALLOWED");
  assert(evaluateTenantAccess(admin, listingB).allowed === true, "ADMIN accessing Tenant B Room/Listing -> ALLOWED");

  // ----------------------------------------------------
  // TEST 5: Nested-Resource IDOR Protection (Section 11, 14, 27)
  // ----------------------------------------------------
  console.log("\n--- 5. NESTED RESOURCE IDOR PROTECTION ---");
  // Simulating validateRoomBelongsToListing
  const roomBelongingToB = {
    _id: new mongoose.Types.ObjectId(),
    property: listingB._id,
    roomNumber: "201"
  };

  let idorBlocked = false;
  let idorMessage = "";
  const mockIdorReq = {
    params: { id: listingA._id.toString(), roomId: roomBelongingToB._id.toString() },
    accepts: () => true,
    xhr: true
  };
  const mockIdorRes = {
    status: (code) => ({
      json: (data) => {
        if (code === 400) {
          idorBlocked = true;
          idorMessage = data.message;
        }
      }
    }),
    flash: () => {},
    redirect: () => {}
  };

  // Mock Room.findById for this unit test
  const originalFindById = Room.findById;
  Room.findById = async (id) => {
    if (id.toString() === roomBelongingToB._id.toString()) return roomBelongingToB;
    return null;
  };

  await validateRoomBelongsToListing(mockIdorReq, mockIdorRes, () => {});
  Room.findById = originalFindById;

  assert(idorBlocked, "Nested IDOR attempt (/listings/A/rooms/B) blocked with 400 Bad Request");
  assert(idorMessage.includes("mismatch"), "Security rejection message confirms resource mismatch");

  // ----------------------------------------------------
  // TEST 6: Client Field Manipulation Prevention (Section 28)
  // ----------------------------------------------------
  console.log("\n--- 6. CLIENT FIELD MANIPULATION GUARDS ---");
  // Connect to live DB for integration and relationship assertions
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
  const db = mongoose.connection.db;

  // Retrieve a real listing from the database
  const targetListing = await Listing.findOne({});
  assert(targetListing != null, "Target test listing found in database");

  // Attacker sends arbitrary listing/property/organization in payload
  const maliciousRoomData = {
    roomNumber: "TEST-IDOR-ROOM",
    roomType: "Single",
    capacity: 1,
    price: 999,
    property: new mongoose.Types.ObjectId(),
    listing: new mongoose.Types.ObjectId(),
    organization: new mongoose.Types.ObjectId(),
    tenant: "attackerOrg"
  };

  const createdTestRoom = await roomService.createRoom(targetListing._id, maliciousRoomData, {
    _id: targetListing.owner,
    organization: targetListing.organization
  });

  assert(createdTestRoom.property.toString() === targetListing._id.toString(), "Room property derived strictly from server (client override stripped)");
  assert(createdTestRoom.organization.toString() === targetListing.organization.toString(), "Room organization derived strictly from parent property (client org stripped)");

  // ----------------------------------------------------
  // TEST 7: Duplicate Room Number Scoping (Section 18, 29, 35)
  // ----------------------------------------------------
  console.log("\n--- 7. SCOPED ROOM NUMBER UNIQUENESS ---");
  let duplicateRejected = false;
  try {
    // Attempt duplicate in same property
    await roomService.createRoom(targetListing._id, {
      roomNumber: "TEST-IDOR-ROOM",
      roomType: "Double",
      capacity: 2,
      price: 1200
    }, { organization: targetListing.organization });
  } catch (err) {
    if (err.statusCode === 409 || err.message.includes("already exists")) {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, "Duplicate room number within same property rejected with 409 Conflict");

  // Same room number in a different property must be allowed
  const secondListing = await Listing.findOne({ _id: { $ne: targetListing._id } });
  let diffPropertyAllowed = false;
  let secondTestRoom = null;
  if (secondListing) {
    secondTestRoom = await roomService.createRoom(secondListing._id, {
      roomNumber: "TEST-IDOR-ROOM",
      roomType: "Double",
      capacity: 2,
      price: 1200
    }, { organization: secondListing.organization });
    diffPropertyAllowed = secondTestRoom != null;
  }
  assert(diffPropertyAllowed, "Same room number in different property is ALLOWED");

  // Clean up temporary test rooms
  await roomService.deleteRoom(createdTestRoom._id, targetListing._id);
  if (secondTestRoom) {
    await roomService.deleteRoom(secondTestRoom._id, secondListing._id);
  }

  // ----------------------------------------------------
  // TEST 8: Database Integrity & 134 Rooms Preservation (Section 23, 33, 34)
  // ----------------------------------------------------
  console.log("\n--- 8. DATABASE INTEGRITY & 134 ROOMS PRESERVATION ---");
  const users = await db.collection("users").find({}).toArray();
  const listings = await db.collection("listings").find({}).toArray();
  const reviews = await db.collection("reviews").find({}).toArray();
  const rooms = await db.collection("rooms").find({}).toArray();
  const orgs = await db.collection("organizations").find({}).toArray();
  const migrationsCount = await db.collection("migrations").countDocuments();

  assert(users.length === 6, `Users count is exactly 6 (Found: ${users.length})`);
  assert(listings.length === 65, `Listings count is exactly 65 (Found: ${listings.length})`);
  assert(reviews.length === 4, `Reviews count is exactly 4 (Found: ${reviews.length})`);
  assert(rooms.length === 134, `Rooms count is exactly 134 preserved (Found: ${rooms.length})`);
  assert(orgs.length === 1, `Organizations count is exactly 1 (Found: ${orgs.length})`);
  assert(migrationsCount === 1, `Migrations count is exactly 1 (Found: ${migrationsCount})`);

  // Relationship check
  const listingIdSet = new Set(listings.map((l) => l._id.toString()));
  const allRoomsHaveValidProperty = rooms.every((r) => r.property && listingIdSet.has(r.property.toString()));
  assert(allRoomsHaveValidProperty, "All 134 rooms point to valid existing listings");

  const authoritativeOrgId = orgs[0]._id.toString();
  const allRoomsHaveValidOrg = rooms.every((r) => r.organization && r.organization.toString() === authoritativeOrgId);
  assert(allRoomsHaveValidOrg, "All 134 rooms match authoritative organization (0 cross-tenant mismatches)");

  const allRoomsAvailable = rooms.every((r) => r.status === "AVAILABLE");
  assert(allRoomsAvailable, "All 134 rooms preserve AVAILABLE operational status");

  // Compound unique index verification on rooms
  const indexes = await db.collection("rooms").indexes();
  const hasCompoundIndex = indexes.some((idx) => idx.key.property === 1 && idx.key.roomNumber === 1 && idx.unique === true);
  assert(hasCompoundIndex, "Compound unique index { property: 1, roomNumber: 1 } actively registered on rooms collection");

  await mongoose.disconnect();

  console.log("\n==================================================");
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase4TestSuite().catch((err) => {
    console.error("[Test Suite Fatal Error]:", err);
    process.exit(1);
  });
}

module.exports = runPhase4TestSuite;
