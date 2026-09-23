const mongoose = require("mongoose");
const { PERMISSIONS, hasPermission } = require("../src/config/permissions");
const serviceIssueService = require("../src/services/serviceIssueService");
const ServiceIssue = require("../src/models/serviceIssue");
const Room = require("../src/models/room");
const Listing = require("../src/models/listing");
const Booking = require("../src/models/booking");
const Organization = require("../src/models/organization");
const User = require("../src/models/user");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/wanderlust";

async function runPhase13TestSuite() {
  console.log("==================================================");
  console.log("PHASE 13 HOSPITALITY OPERATIONS TEST SUITE");
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

  // Connect to database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
  const db = mongoose.connection.db;

  // Track created test IDs for strict teardown
  const createdIssueIds = [];
  const createdBookingIds = [];

  try {
    // ----------------------------------------------------
    // TEST SECTION 1: RBAC PERMISSIONS FOR SERVICE ISSUES
    // ----------------------------------------------------
    console.log("--- 1. RBAC PERMISSION MATRIX CHECKS ---");
    const customerUser = { role: "CUSTOMER", organization: new mongoose.Types.ObjectId() };
    const staffUser = { role: "STAFF", organization: new mongoose.Types.ObjectId() };
    const managerUser = { role: "MANAGER", organization: new mongoose.Types.ObjectId() };
    const ownerUser = { role: "OWNER", organization: new mongoose.Types.ObjectId() };
    const adminUser = { role: "ADMIN", organization: new mongoose.Types.ObjectId() };

    assert(!hasPermission(customerUser, PERMISSIONS.ISSUE_VIEW), "CUSTOMER cannot view service issues");
    assert(!hasPermission(customerUser, PERMISSIONS.ISSUE_CREATE), "CUSTOMER cannot create service issues");
    assert(!hasPermission(customerUser, PERMISSIONS.ISSUE_UPDATE), "CUSTOMER cannot update service issues");
    assert(!hasPermission(customerUser, PERMISSIONS.ISSUE_RESOLVE), "CUSTOMER cannot resolve service issues");

    assert(hasPermission(staffUser, PERMISSIONS.ISSUE_VIEW), "STAFF can view service issues");
    assert(hasPermission(staffUser, PERMISSIONS.ISSUE_CREATE), "STAFF can create service issues");
    assert(hasPermission(staffUser, PERMISSIONS.ISSUE_UPDATE), "STAFF can update service issues");
    assert(hasPermission(staffUser, PERMISSIONS.ISSUE_RESOLVE), "STAFF can resolve service issues");

    assert(hasPermission(managerUser, PERMISSIONS.ISSUE_VIEW), "MANAGER can view service issues");
    assert(hasPermission(managerUser, PERMISSIONS.ISSUE_CREATE), "MANAGER can create service issues");
    assert(hasPermission(managerUser, PERMISSIONS.ISSUE_UPDATE), "MANAGER can update service issues");
    assert(hasPermission(managerUser, PERMISSIONS.ISSUE_RESOLVE), "MANAGER can resolve service issues");

    assert(hasPermission(ownerUser, PERMISSIONS.ISSUE_VIEW), "OWNER can view service issues");
    assert(hasPermission(ownerUser, PERMISSIONS.ISSUE_CREATE), "OWNER can create service issues");
    assert(hasPermission(ownerUser, PERMISSIONS.ISSUE_UPDATE), "OWNER can update service issues");
    assert(hasPermission(ownerUser, PERMISSIONS.ISSUE_RESOLVE), "OWNER can resolve service issues");

    assert(hasPermission(adminUser, PERMISSIONS.ISSUE_VIEW), "ADMIN has global issue view permission");
    assert(hasPermission(adminUser, PERMISSIONS.ISSUE_CREATE), "ADMIN has global issue create permission");
    assert(hasPermission(adminUser, PERMISSIONS.ISSUE_UPDATE), "ADMIN has global issue update permission");
    assert(hasPermission(adminUser, PERMISSIONS.ISSUE_RESOLVE), "ADMIN has global issue resolve permission");

    // Retrieve baseline entities for integration tests
    const existingListing = await Listing.findOne();
    const existingRoom = await Room.findOne({ property: existingListing._id });
    const existingOrg = await Organization.findById(existingListing.organization);
    const existingUser = await User.findOne({ role: { $in: ["OWNER", "MANAGER", "ADMIN"] } });

    assert(Boolean(existingListing && existingRoom && existingOrg && existingUser), "Retrieved valid baseline fixtures for testing");

    const authStaff = {
      _id: existingUser._id,
      role: "STAFF",
      organization: existingOrg._id
    };

    const authCustomer = {
      _id: new mongoose.Types.ObjectId(),
      role: "CUSTOMER",
      organization: null
    };

    // ----------------------------------------------------
    // TEST SECTION 2: SERVICE ISSUE LIFECYCLE & ANTI-TAMPERING
    // ----------------------------------------------------
    console.log("\n--- 2. SERVICE ISSUE CREATION & ANTI-TAMPERING ---");
    
    // Authorized creation
    const spoofedOrgId = new mongoose.Types.ObjectId();
    const spoofedUserId = new mongoose.Types.ObjectId();

    const createdIssue = await serviceIssueService.createIssue(
      existingListing._id,
      existingRoom._id,
      {
        title: "Test AC Cooling Malfunction",
        description: "AC unit compressor blowing warm air in Room " + existingRoom.roomNumber,
        priority: "HIGH",
        organization: spoofedOrgId, // Attempted spoofing
        createdBy: spoofedUserId    // Attempted spoofing
      },
      authStaff
    );
    createdIssueIds.push(createdIssue._id);

    assert(createdIssue.status === "REPORTED", "New issue initialized with status REPORTED");
    assert(createdIssue.priority === "HIGH", "New issue correctly registered with priority HIGH");
    assert(createdIssue.organization.toString() === existingOrg._id.toString(), "Organization is server-derived; client spoofed org was ignored");
    assert(createdIssue.createdBy.toString() === authStaff._id.toString(), "createdBy is server-derived; client spoofed user was ignored");
    assert(createdIssue.room.toString() === existingRoom._id.toString(), "Issue correctly linked to room");
    assert(createdIssue.property.toString() === existingListing._id.toString(), "Issue correctly linked to property");

    // Priority validation
    let invalidPriorityCaught = false;
    try {
      await serviceIssueService.createIssue(
        existingListing._id,
        existingRoom._id,
        {
          title: "Invalid Priority Issue",
          description: "Testing invalid priority rejection",
          priority: "CRITICAL_EMERGENCY"
        },
        authStaff
      );
    } catch (err) {
      invalidPriorityCaught = err.statusCode === 400;
    }
    assert(invalidPriorityCaught, "Invalid issue priority rejected with HTTP 400");

    // Cross-Room Resource Mismatch Validation
    const fakeRoomId = new mongoose.Types.ObjectId();
    let resourceMismatchCaught = false;
    try {
      await serviceIssueService.getIssuesForRoom(fakeRoomId, existingListing._id, authStaff);
    } catch (err) {
      resourceMismatchCaught = err.statusCode === 404;
    }
    assert(resourceMismatchCaught, "Non-existent room access rejected with HTTP 404");

    // Cross-Tenant Access Rejection
    const foreignOrgId = new mongoose.Types.ObjectId();
    const foreignUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "MANAGER",
      organization: foreignOrgId
    };

    let crossTenantCaught = false;
    try {
      await serviceIssueService.getIssueById(createdIssue._id, foreignUser);
    } catch (err) {
      crossTenantCaught = err.statusCode === 403;
    }
    assert(crossTenantCaught, "Cross-tenant access to service issue rejected with HTTP 403");

    // ----------------------------------------------------
    // TEST SECTION 3: STATE TRANSITIONS & TERMINAL STATUS
    // ----------------------------------------------------
    console.log("\n--- 3. STRICT STATE TRANSITIONS & TERMINAL RESOLUTION ---");

    // Valid transition: REPORTED -> ASSIGNED
    const updatedToAssigned = await serviceIssueService.updateIssue(
      createdIssue._id,
      { status: "ASSIGNED" },
      authStaff
    );
    assert(updatedToAssigned.status === "ASSIGNED", "Valid status transition REPORTED -> ASSIGNED succeeded");

    // Valid transition: ASSIGNED -> IN_PROGRESS
    const updatedToProgress = await serviceIssueService.updateIssue(
      createdIssue._id,
      { status: "IN_PROGRESS" },
      authStaff
    );
    assert(updatedToProgress.status === "IN_PROGRESS", "Valid status transition ASSIGNED -> IN_PROGRESS succeeded");

    // Invalid transition: IN_PROGRESS -> REPORTED (backward transition)
    let invalidBackwardCaught = false;
    try {
      await serviceIssueService.updateIssue(
        createdIssue._id,
        { status: "REPORTED" },
        authStaff
      );
    } catch (err) {
      invalidBackwardCaught = err.statusCode === 400;
    }
    assert(invalidBackwardCaught, "Invalid backward status transition IN_PROGRESS -> REPORTED rejected with HTTP 400");

    // Valid resolution: IN_PROGRESS -> RESOLVED
    const resolvedIssue = await serviceIssueService.resolveIssue(createdIssue._id, authStaff);
    assert(resolvedIssue.status === "RESOLVED", "Issue successfully transitioned to RESOLVED");
    assert(Boolean(resolvedIssue.resolvedAt), "Issue resolution sets resolvedAt timestamp");

    // Terminal state verification: RESOLVED cannot be modified or reopened
    let reopeningCaught = false;
    try {
      await serviceIssueService.updateIssue(
        createdIssue._id,
        { status: "IN_PROGRESS" },
        authStaff
      );
    } catch (err) {
      reopeningCaught = err.statusCode === 400;
    }
    assert(reopeningCaught, "Reopening a RESOLVED issue is strictly rejected with HTTP 400");

    // ----------------------------------------------------
    // TEST SECTION 4: DYNAMIC GUEST READINESS CALCULATION
    // ----------------------------------------------------
    console.log("\n--- 4. DYNAMIC GUEST READINESS CALCULATION ---");

    // Currently all issues on existingRoom are resolved -> should be GUEST READY (if room is AVAILABLE)
    const readinessResolved = await serviceIssueService.getRoomReadiness(existingRoom._id);
    assert(readinessResolved.isGuestReady === true, "Room with only resolved issues is GUEST READY");
    assert(readinessResolved.reason === "Ready for check-in", "GUEST READY provides positive confirmation reason");

    // Create a new unresolved issue on existingRoom
    const unresolvedIssue = await serviceIssueService.createIssue(
      existingListing._id,
      existingRoom._id,
      {
        title: "Broken Window Latch",
        description: "Security risk: window latch broken in Room " + existingRoom.roomNumber,
        priority: "HIGH"
      },
      authStaff
    );
    createdIssueIds.push(unresolvedIssue._id);

    // Dynamic evaluation: Room now has unresolved issue -> NOT READY
    const readinessUnresolved = await serviceIssueService.getRoomReadiness(existingRoom._id);
    assert(readinessUnresolved.isGuestReady === false, "Room with unresolved issue dynamically evaluates to NOT GUEST READY");
    assert(readinessUnresolved.reason.includes("Broken Window Latch"), "Readiness failure explanation cites unresolved issue title");

    // Verify Room.status document was NOT mutated
    const roomDocAfter = await Room.findById(existingRoom._id).lean();
    assert(roomDocAfter.status === "AVAILABLE", "Room.status in MongoDB remains AVAILABLE (not mutated by readiness calculation)");
    assert(roomDocAfter.isGuestReady === undefined, "Zero persistent isGuestReady field stored on Room document");

    // Resolve the issue and re-evaluate readiness
    await serviceIssueService.resolveIssue(unresolvedIssue._id, authStaff);
    const readinessAfterResolve = await serviceIssueService.getRoomReadiness(existingRoom._id);
    assert(readinessAfterResolve.isGuestReady === true, "Resolving issue immediately restores GUEST READY status");

    // ----------------------------------------------------
    // TEST SECTION 5: DYNAMIC GUEST IMPACT ALERT ENGINE
    // ----------------------------------------------------
    console.log("\n--- 5. DYNAMIC GUEST IMPACT ALERTS (ZERO N+1) ---");

    // Create an upcoming active booking for existingRoom
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const upcomingBooking = new Booking({
      bookingNumber: "TEST-BK-P13-001",
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: existingUser._id,
      checkIn: tomorrow,
      checkOut: dayAfter,
      guestsCount: 2,
      totalNights: 2,
      pricePerNight: 2000,
      totalPrice: 4000,
      status: "CONFIRMED",
      guestDetails: {
        name: "Test VIP Guest",
        email: "vip@example.com",
        phone: "+91 9999999999"
      }
    });
    await upcomingBooking.save();
    createdBookingIds.push(upcomingBooking._id);

    // Initial state: room has NO unresolved issues -> 0 Alerts
    let alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const bookingAlertInitial = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(!bookingAlertInitial, "Upcoming booking with zero unresolved room issues triggers NO alert");

    // Add an unresolved HIGH priority issue to existingRoom
    const highAlertIssue = await serviceIssueService.createIssue(
      existingListing._id,
      existingRoom._id,
      {
        title: "Bathroom Water Pipe Leak",
        description: "Flooding risk in bathroom",
        priority: "HIGH"
      },
      authStaff
    );
    createdIssueIds.push(highAlertIssue._id);

    // Check alerts: must trigger HIGH severity Guest Impact Alert!
    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const activeAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(Boolean(activeAlert), "Upcoming CONFIRMED booking + unresolved room issue triggers Guest Impact Alert");
    assert(activeAlert?.severity === "HIGH", "Alert severity matches issue priority HIGH");
    assert(activeAlert?.explanation.includes("Bathroom Water Pipe Leak"), "Alert explanation includes issue title and context");
    assert(activeAlert?.roomNumber === existingRoom.roomNumber, "Alert accurately identifies affected room number");

    // PENDING booking also triggers alert
    upcomingBooking.status = "PENDING";
    await upcomingBooking.save();
    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const pendingAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(Boolean(pendingAlert), "Upcoming PENDING booking also triggers Guest Impact Alert");

    // CANCELLED booking must NOT trigger alert
    upcomingBooking.status = "CANCELLED";
    await upcomingBooking.save();
    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const cancelledAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(!cancelledAlert, "CANCELLED booking does NOT trigger Guest Impact Alert");

    // COMPLETED booking must NOT trigger alert
    upcomingBooking.status = "COMPLETED";
    await upcomingBooking.save();
    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const completedAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(!completedAlert, "COMPLETED booking does NOT trigger Guest Impact Alert");

    // Historical booking (past check-in) must NOT trigger alert
    upcomingBooking.status = "CONFIRMED";
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastCheckout = new Date();
    pastCheckout.setDate(pastCheckout.getDate() - 3);
    upcomingBooking.checkIn = pastDate;
    upcomingBooking.checkOut = pastCheckout;
    await upcomingBooking.save();

    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const historicalAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(!historicalAlert, "Historical booking does NOT trigger Guest Impact Alert");

    // Reset booking to upcoming and resolve the issue -> Alert must disappear dynamically!
    upcomingBooking.checkIn = tomorrow;
    upcomingBooking.checkOut = dayAfter;
    await upcomingBooking.save();

    await serviceIssueService.resolveIssue(highAlertIssue._id, authStaff);
    alerts = await serviceIssueService.getGuestImpactAlerts(existingOrg._id);
    const resolvedAlert = alerts.find(a => a.bookingId.toString() === upcomingBooking._id.toString());
    assert(!resolvedAlert, "Resolving the service issue causes Guest Impact Alert to dynamically clear");

    // Multi-tenant alert isolation: Organization B cannot see Organization A alerts
    const foreignAlerts = await serviceIssueService.getGuestImpactAlerts(foreignOrgId);
    assert(Array.isArray(foreignAlerts) && foreignAlerts.length === 0, "Guest Impact Alerts are strictly isolated to tenant organization");

    // Zero Alert collection verification
    const collections = await db.listCollections().toArray();
    const hasAlertCollection = collections.some(c => c.name.toLowerCase().includes("alert"));
    assert(!hasAlertCollection, "Zero Alert collections exist in MongoDB (alerts are 100% dynamically derived)");

  } finally {
    // ----------------------------------------------------
    // CLEANUP & TEARDOWN
    // ----------------------------------------------------
    console.log("\n--- 6. TEARDOWN & DATABASE HYGIENE ---");
    if (createdIssueIds.length > 0) {
      await ServiceIssue.deleteMany({ _id: { $in: createdIssueIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }

    // Verify baseline counts preserved
    const listingsCount = await db.collection("listings").countDocuments();
    const roomsCount = await db.collection("rooms").countDocuments();
    const usersCount = await db.collection("users").countDocuments();
    const orgsCount = await db.collection("organizations").countDocuments();
    const reviewsCount = await db.collection("reviews").countDocuments();
    const bookingsCount = await db.collection("bookings").countDocuments();
    const migrationsCount = await db.collection("migrations").countDocuments();

    assert(listingsCount === 65, `Listings count preserved: 65 (Found: ${listingsCount})`);
    assert(roomsCount === 134, `Rooms count preserved: 134 (Found: ${roomsCount})`);
    assert(usersCount === 6, `Users count preserved: 6 (Found: ${usersCount})`);
    assert(orgsCount === 1, `Organizations count preserved: 1 (Found: ${orgsCount})`);
    assert(reviewsCount === 4, `Reviews count preserved: 4 (Found: ${reviewsCount})`);
    assert(bookingsCount === 0, `Bookings count preserved: 0 (Found: ${bookingsCount})`);
    assert(migrationsCount === 1, `Migrations count preserved: 1 (Found: ${migrationsCount})`);

    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(`TOTAL PHASE 13 TESTS: ${passedTests + failedTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPhase13TestSuite().catch(err => {
    console.error("[Phase 13 Test Fatal Error]:", err);
    process.exit(1);
  });
}

module.exports = runPhase13TestSuite;
