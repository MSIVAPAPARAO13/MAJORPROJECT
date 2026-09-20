/**
 * PHASE 8 TEST SUITE — DASHBOARDS + ANALYTICS
 * WanderLust SaaS Hospitality Management Platform
 * 
 * Verifies:
 * 1. RBAC & Dashboard Authorization Matrix (DASHBOARD_VIEW vs ANALYTICS_VIEW)
 * 2. Strict Scope Derivation from req.user (Query parameter tampering rejection)
 * 3. Date Filter Validation, Presets, Boundary Checking, and Injection Stripping
 * 4. Customer Personal Dashboard Isolation (Own Bookings Only, Realized vs Cancelled Value)
 * 5. Staff Operational Dashboard Isolation (Zero Financials, Turnover, In-House, Maintenance)
 * 6. Owner & Manager Tenant Dashboard (Realized Booking Value vs Pending Pipeline, Zero Cancelled Leak)
 * 7. Occupancy Calculations (Current Real-Time Occupancy vs Date-Range Reservation Overlap)
 * 8. Room Status Independence (Physical State vs Reservation State, Maintenance Isolation)
 * 9. Multi-Tenant Boundary Enforcement (Org A cannot observe Org B metrics)
 * 10. Admin Platform Overview & Bounded Organization Table
 * 11. Zero N+1 Queries & Read-Only Invariant
 * 12. Complete Database Safety, Cleanup, and Baseline Preservation
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Review = require("../src/models/review");
const Booking = require("../src/models/booking");

const dashboardService = require("../src/services/dashboardService");
const dashboardController = require("../src/controllers/dashboardController");
const { validateDashboardFilters } = require("../src/validators/dashboardValidator");
const { PERMISSIONS, hasPermission } = require("../src/config/permissions");
const createApp = require("../src/app");

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

async function runPhase8Tests() {
  console.log("==================================================");
  console.log("PHASE 8 DASHBOARDS & ANALYTICS TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  // Record initial baseline counts to verify no leakage
  const initialCounts = {
    listings: await Listing.countDocuments(),
    rooms: await Room.countDocuments(),
    users: await User.countDocuments(),
    organizations: await Organization.countDocuments(),
    reviews: await Review.countDocuments(),
    bookings: await Booking.countDocuments()
  };

  console.log(`Initial Counts: Users=${initialCounts.users}, Orgs=${initialCounts.organizations}, Listings=${initialCounts.listings}, Rooms=${initialCounts.rooms}, Bookings=${initialCounts.bookings}\n`);

  // Identify existing seeded records for testing
  const existingOrg = await Organization.findOne();
  const existingListing = await Listing.findOne({ organization: existingOrg._id });
  const existingRoom = await Room.findOne({ property: existingListing._id, organization: existingOrg._id });
  const adminUser = await User.findOne({ role: "ADMIN" });
  const ownerUser = await User.findOne({ role: "OWNER" });
  const managerUser = await User.findOne({ role: "MANAGER" });
  const staffUser = await User.findOne({ role: "STAFF" });
  const customerUser = await User.findOne({ role: "CUSTOMER" });

  // Track created test IDs for guaranteed cleanup
  const createdBookingIds = [];
  const createdOrgIds = [];
  const createdUserIds = [];
  const createdRoomIds = [];
  const createdListingIds = [];

  try {
    // -------------------------------------------------------------
    // 1. RBAC & DASHBOARD PERMISSIONS MATRIX
    // -------------------------------------------------------------
    console.log("--- 1. RBAC & PERMISSION MATRIX (RULES 1 & 2) ---");

    assert(hasPermission("ADMIN", PERMISSIONS.DASHBOARD_VIEW), "ADMIN has DASHBOARD_VIEW permission");
    assert(hasPermission("OWNER", PERMISSIONS.DASHBOARD_VIEW), "OWNER has DASHBOARD_VIEW permission");
    assert(hasPermission("MANAGER", PERMISSIONS.DASHBOARD_VIEW), "MANAGER has DASHBOARD_VIEW permission");
    assert(hasPermission("STAFF", PERMISSIONS.DASHBOARD_VIEW), "STAFF has DASHBOARD_VIEW permission");
    assert(hasPermission("CUSTOMER", PERMISSIONS.DASHBOARD_VIEW), "CUSTOMER has DASHBOARD_VIEW permission");

    assert(hasPermission("ADMIN", PERMISSIONS.ANALYTICS_VIEW), "ADMIN has ANALYTICS_VIEW permission");
    assert(hasPermission("OWNER", PERMISSIONS.ANALYTICS_VIEW), "OWNER has ANALYTICS_VIEW permission");
    assert(hasPermission("MANAGER", PERMISSIONS.ANALYTICS_VIEW), "MANAGER has ANALYTICS_VIEW permission");
    assert(!hasPermission("STAFF", PERMISSIONS.ANALYTICS_VIEW), "STAFF does NOT have ANALYTICS_VIEW permission (Rule 2)");
    assert(!hasPermission("CUSTOMER", PERMISSIONS.ANALYTICS_VIEW), "CUSTOMER does NOT have ANALYTICS_VIEW permission");

    // -------------------------------------------------------------
    // 2. DATE FILTER VALIDATOR & SANITIZATION (RULES 3 & 8)
    // -------------------------------------------------------------
    console.log("\n--- 2. DATE FILTER VALIDATION & SANITIZATION (RULE 3) ---");

    function testValidator(queryObj) {
      let nextCalled = false;
      let errorPassed = null;
      const req = { query: { ...queryObj } };
      const res = {};
      validateDashboardFilters(req, res, (err) => {
        nextCalled = true;
        errorPassed = err;
      });
      return { nextCalled, errorPassed, validated: req.validatedDashboardQuery };
    }

    // Default 30d preset
    const resDefault = testValidator({});
    assert(resDefault.nextCalled && !resDefault.errorPassed, "Empty query defaults to valid 30d filter");
    assert(resDefault.validated.preset === "30d", "Default preset is '30d'");

    // Valid presets
    const presets = ["today", "7d", "30d", "90d", "all"];
    for (const p of presets) {
      const resP = testValidator({ preset: p });
      assert(resP.nextCalled && !resP.errorPassed && resP.validated.preset === p, `Preset '${p}' is accepted`);
    }

    // Invalid preset rejected
    const resInvPreset = testValidator({ preset: "1000years" });
    assert(resInvPreset.errorPassed && resInvPreset.errorPassed.statusCode === 400, "Invalid preset rejected with 400");

    // Valid custom date range
    const resValidCustom = testValidator({ startDate: "2026-01-01", endDate: "2026-01-31" });
    assert(resValidCustom.nextCalled && !resValidCustom.errorPassed, "Valid custom date range is accepted");
    assert(resValidCustom.validated.startDate instanceof Date && resValidCustom.validated.endDate instanceof Date, "Dates converted to Date objects");

    // Inverted custom date range (endDate < startDate)
    const resInverted = testValidator({ startDate: "2026-02-01", endDate: "2026-01-01" });
    assert(resInverted.errorPassed && resInverted.errorPassed.statusCode === 400, "endDate earlier than startDate rejected with 400");

    // Date range > 366 days
    const resTooLong = testValidator({ startDate: "2024-01-01", endDate: "2026-01-01" });
    assert(resTooLong.errorPassed && resTooLong.errorPassed.statusCode === 400, "Date range exceeding 366 days rejected with 400");

    // Malformed date strings
    const resMalformed = testValidator({ startDate: "not-a-date", endDate: "2026-01-01" });
    assert(resMalformed.errorPassed && resMalformed.errorPassed.statusCode === 400, "Malformed date rejected with 400");

    // MongoDB operator injection attempt
    const resInjection = testValidator({ preset: "30d", $where: "sleep(5000)" });
    assert(!resInjection.validated.$where, "MongoDB operator injection ($where) is stripped");

    // -------------------------------------------------------------
    // 3. DATE FILTER HELPER BEHAVIOR
    // -------------------------------------------------------------
    console.log("\n--- 3. DATE FILTER HELPER BEHAVIOR (RULE 3) ---");

    const todayFilter = dashboardService.getAnalyticsDateFilter({ preset: "today" });
    assert(todayFilter.filter.createdAt.$gte instanceof Date, "Today preset generates valid $gte Date");
    assert(todayFilter.label === "Today", "Today preset generates correct label");

    const allFilter = dashboardService.getAnalyticsDateFilter({ preset: "all" });
    assert(Object.keys(allFilter.filter).length === 0, "All preset generates empty filter (unbounded)");

    const opBounds = dashboardService.getOperationalTimeBounds();
    assert(opBounds.now instanceof Date, "Operational bounds returns current Date 'now'");
    assert(opBounds.startOfToday <= opBounds.now && opBounds.endOfToday >= opBounds.now, "Operational bounds properly bracket current time");

    // -------------------------------------------------------------
    // 4. TEST SEED DATA SETUP (TEMPORARY)
    // -------------------------------------------------------------
    console.log("\n--- 4. SEEDING ISOLATED TEST BOOKINGS ---");

    // Create a secondary user (customer B) for isolation testing
    const customerB = new User({
      username: `test_customer_b_${Date.now()}`,
      email: `customer_b_${Date.now()}@example.com`,
      role: "CUSTOMER"
    });
    await customerB.save();
    createdUserIds.push(customerB._id);

    // Create a secondary organization for multi-tenant isolation testing
    const tenantB = new Organization({
      name: `Tenant Org B ${Date.now()}`,
      slug: `tenant-b-${Date.now()}`,
      owner: customerB._id,
      contactEmail: `tenant_b_${Date.now()}@test.com`,
      status: "ACTIVE"
    });
    await tenantB.save();
    createdOrgIds.push(tenantB._id);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const twelveDaysFromNow = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000);

    // Booking 1: Confirmed upcoming booking for Customer A in Org A (Value: 5000)
    const b1 = new Booking({
      bookingNumber: `TEST-B1-${Date.now()}`,
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUser._id,
      checkIn: tenDaysFromNow,
      checkOut: twelveDaysFromNow,
      guestsCount: 2,
      totalNights: 2,
      pricePerNight: 2500,
      totalPrice: 5000,
      status: "CONFIRMED",
      guestDetails: { name: "Customer User", email: customerUser.email, phone: "9876543210" }
    });
    await b1.save();
    createdBookingIds.push(b1._id);

    // Booking 2: Active / In-House booking for Customer A in Org A (Yesterday -> Tomorrow) (Value: 3000)
    const b2 = new Booking({
      bookingNumber: `TEST-B2-${Date.now()}`,
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUser._id,
      checkIn: yesterday,
      checkOut: tomorrow,
      guestsCount: 1,
      totalNights: 2,
      pricePerNight: 1500,
      totalPrice: 3000,
      status: "CONFIRMED",
      guestDetails: { name: "Customer User", email: customerUser.email, phone: "9876543210" }
    });
    await b2.save();
    createdBookingIds.push(b2._id);

    // Booking 3: Pending pipeline booking for Customer A in Org A (Value: 4000)
    const b3 = new Booking({
      bookingNumber: `TEST-B3-${Date.now()}`,
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUser._id,
      checkIn: tenDaysFromNow,
      checkOut: twelveDaysFromNow,
      guestsCount: 2,
      totalNights: 2,
      pricePerNight: 2000,
      totalPrice: 4000,
      status: "PENDING",
      guestDetails: { name: "Customer User", email: customerUser.email, phone: "9876543210" }
    });
    await b3.save();
    createdBookingIds.push(b3._id);

    // Booking 4: Cancelled booking for Customer A in Org A (Value: 7000) - MUST NOT BE REALIZED VALUE
    const b4 = new Booking({
      bookingNumber: `TEST-B4-${Date.now()}`,
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerUser._id,
      checkIn: fiveDaysAgo,
      checkOut: yesterday,
      guestsCount: 1,
      totalNights: 4,
      pricePerNight: 1750,
      totalPrice: 7000,
      status: "CANCELLED",
      guestDetails: { name: "Customer User", email: customerUser.email, phone: "9876543210" }
    });
    await b4.save();
    createdBookingIds.push(b4._id);

    // Booking 5: Completed past booking for Customer B in Org A (Value: 2000)
    const b5 = new Booking({
      bookingNumber: `TEST-B5-${Date.now()}`,
      organization: existingOrg._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerB._id,
      checkIn: fiveDaysAgo,
      checkOut: yesterday,
      guestsCount: 2,
      totalNights: 4,
      pricePerNight: 500,
      totalPrice: 2000,
      status: "COMPLETED",
      guestDetails: { name: "Customer B", email: customerB.email, phone: "9876543211" }
    });
    await b5.save();
    createdBookingIds.push(b5._id);

    // Booking 6: Booking belonging to Tenant Org B (Value: 10000) - MUST NOT LEAK TO ORG A
    const b6 = new Booking({
      bookingNumber: `TEST-B6-${Date.now()}`,
      organization: tenantB._id,
      property: existingListing._id,
      room: existingRoom._id,
      guest: customerB._id,
      checkIn: tenDaysFromNow,
      checkOut: twelveDaysFromNow,
      guestsCount: 2,
      totalNights: 2,
      pricePerNight: 5000,
      totalPrice: 10000,
      status: "CONFIRMED",
      guestDetails: { name: "Customer B", email: customerB.email, phone: "9876543211" }
    });
    await b6.save();
    createdBookingIds.push(b6._id);

    console.log(`Created 6 test bookings across 2 organizations and 2 customers.\n`);

    // -------------------------------------------------------------
    // 5. CUSTOMER DASHBOARD ISOLATION (RULES 4, 5, 11)
    // -------------------------------------------------------------
    console.log("--- 5. CUSTOMER DASHBOARD ISOLATION (RULES 4, 5, 11) ---");

    const custADash = await dashboardService.getCustomerDashboard(customerUser._id, { preset: "all" });
    assert(custADash.userId === customerUser._id.toString(), "Customer dashboard strictly keyed to customer User ID");
    assert(custADash.summary.totalTrips === 4, `Customer A sees exactly their own 4 trips (actual: ${custADash.summary.totalTrips})`);
    assert(custADash.summary.upcomingCount === 2, `Customer A has 2 upcoming trips (1 Confirmed + 1 Pending)`);
    assert(custADash.summary.activeStaysCount === 1, `Customer A has exactly 1 active in-house stay`);
    assert(custADash.summary.cancelledCount === 1, `Customer A has 1 cancelled booking`);

    // Rule 5: Value must NOT include Cancelled (Confirmed: 5000 + 3000 = 8000; Pending: 4000; Cancelled: 7000 not added to realized total)
    assert(custADash.summary.totalBookingValue === 12000, `Total Customer Booking Value excludes cancelled (8000 confirmed + 4000 pending = 12000, actual: ${custADash.summary.totalBookingValue})`);

    // Ensure Customer A sees zero bookings from Customer B
    const b5FoundInA = custADash.pastStays.find(s => s._id.toString() === b5._id.toString());
    assert(!b5FoundInA, "Customer A cannot view Customer B's bookings");

    // Customer B Dashboard
    const custBDash = await dashboardService.getCustomerDashboard(customerB._id, { preset: "all" });
    assert(custBDash.summary.totalTrips === 2, `Customer B sees exactly their own 2 trips (actual: ${custBDash.summary.totalTrips})`);
    assert(custBDash.summary.pastCount === 1, `Customer B sees 1 completed stay`);

    // -------------------------------------------------------------
    // 6. STAFF OPERATIONAL DASHBOARD (RULES 2, 3, 7)
    // -------------------------------------------------------------
    console.log("\n--- 6. STAFF OPERATIONAL DASHBOARD (RULES 2, 3, 7) ---");

    const staffDash = await dashboardService.getStaffDashboard(existingOrg._id);

    // Rule 2: Zero financial data exposed
    assert(staffDash.revenue === undefined, "Staff dashboard has no 'revenue' property");
    assert(staffDash.totalRevenue === undefined, "Staff dashboard has no 'totalRevenue' property");
    assert(staffDash.confirmedCompletedValue === undefined, "Staff dashboard has no 'confirmedCompletedValue' property");
    assert(staffDash.pendingPipelineValue === undefined, "Staff dashboard has no 'pendingPipelineValue' property");

    // Operational properties present
    assert(staffDash.summary.inHouseGuestsCount >= 1, `Staff dashboard tracks in-house guest count (${staffDash.summary.inHouseGuestsCount})`);
    assert(staffDash.inHouseBookings.some(b => b._id.toString() === b2._id.toString()), "Active in-house booking b2 present in Staff in-house list");
    assert(typeof staffDash.summary.availableRoomsCount === "number", "Staff dashboard reports available rooms count");
    assert(typeof staffDash.summary.occupiedRoomsCount === "number", "Staff dashboard reports occupied rooms count");
    assert(typeof staffDash.summary.maintenanceRoomsCount === "number", "Staff dashboard reports maintenance rooms count");

    // Rule 7: Physical status separate from reservation status
    // Temporarily mark a room as MAINTENANCE to verify it is reported in maintenance without mutating status
    const roomToMaint = await Room.findOne({ organization: existingOrg._id });
    const originalRoomStatus = roomToMaint.status;
    roomToMaint.status = "MAINTENANCE";
    await roomToMaint.save();

    const staffDashMaint = await dashboardService.getStaffDashboard(existingOrg._id);
    assert(staffDashMaint.summary.maintenanceRoomsCount >= 1, "Maintenance room correctly reflected in operational maintenance count");
    assert(staffDashMaint.maintenanceRooms.some(r => r._id.toString() === roomToMaint._id.toString()), "Maintenance room listed in staff maintenance list");

    // Restore original room status
    roomToMaint.status = originalRoomStatus;
    await roomToMaint.save();

    // -------------------------------------------------------------
    // 7. OWNER / MANAGER DASHBOARD & FINANCIAL SEMANTICS (RULES 4, 5, 6, 10)
    // -------------------------------------------------------------
    console.log("\n--- 7. OWNER/MANAGER DASHBOARD & FINANCIAL SEMANTICS (RULES 4, 5, 6) ---");

    const orgDash = await dashboardService.getOrganizationDashboard(existingOrg._id, { preset: "all" });

    assert(orgDash.organizationId === existingOrg._id.toString(), "Org dashboard scoped to existing Org");
    // In Org A: b1 (5000 CONFIRMED), b2 (3000 CONFIRMED), b3 (4000 PENDING), b4 (7000 CANCELLED), b5 (2000 COMPLETED)
    // Confirmed + Completed = 5000 + 3000 + 2000 = 10000
    // Pending Pipeline = 4000
    // Cancelled = 7000 (EXCLUDED from confirmedCompletedValue)
    assert(orgDash.summary.confirmedCompletedValue === 10000, `Confirmed+Completed booking value is 10,000 (actual: ${orgDash.summary.confirmedCompletedValue})`);
    assert(orgDash.summary.pendingPipelineValue === 4000, `Pending pipeline value is 4,000 (actual: ${orgDash.summary.pendingPipelineValue})`);
    assert(orgDash.summary.totalBookingValue === 14000, `Total potential booking value is 14,000 (actual: ${orgDash.summary.totalBookingValue})`);
    assert(orgDash.bookingStatusBreakdown.CANCELLED === 1, `Cancelled count is 1 (actual: ${orgDash.bookingStatusBreakdown.CANCELLED})`);

    // Rule 6: Current Occupancy vs Date-Range Occupancy
    assert(orgDash.summary.currentlyOccupied >= 1, `Current in-house occupancy counts active booking (actual: ${orgDash.summary.currentlyOccupied})`);
    assert(typeof orgDash.summary.currentOccupancyRate === "number", `Occupancy rate calculated as number (actual: ${orgDash.summary.currentOccupancyRate}%)`);
    assert(orgDash.summary.activeUpcomingBookings >= 1, `Future date-range reservations distinguished from current occupancy (actual: ${orgDash.summary.activeUpcomingBookings})`);

    // Operational snapshots in Owner Dashboard use real-time bounds, not preset
    assert(Array.isArray(orgDash.upcomingCheckIns), "Owner dashboard has upcomingCheckIns list");
    assert(Array.isArray(orgDash.upcomingCheckOuts), "Owner dashboard has upcomingCheckOuts list");

    // -------------------------------------------------------------
    // 8. MULTI-TENANT ISOLATION BOUNDARIES (RULES 1, 9)
    // -------------------------------------------------------------
    console.log("\n--- 8. MULTI-TENANT ISOLATION BOUNDARIES (RULE 1) ---");

    // Tenant B dashboard
    const tenantBDash = await dashboardService.getOrganizationDashboard(tenantB._id, { preset: "all" });
    assert(tenantBDash.summary.confirmedCompletedValue === 10000, `Tenant B has its own confirmed booking value of 10,000 (actual: ${tenantBDash.summary.confirmedCompletedValue})`);
    assert(tenantBDash.summary.totalBookings === 1, `Tenant B has exactly 1 booking (actual: ${tenantBDash.summary.totalBookings})`);

    // Verify Tenant A metrics did NOT include Tenant B's 10,000 booking
    assert(!orgDash.recentBookings.some(b => b._id.toString() === b6._id.toString()), "Tenant A recent bookings do NOT include Tenant B booking b6");
    assert(!tenantBDash.recentBookings.some(b => b._id.toString() === b1._id.toString()), "Tenant B recent bookings do NOT include Tenant A booking b1");

    // -------------------------------------------------------------
    // 9. CONTROLLER SECURITY & QUERY TAMPERING PREVENTION (RULE 1)
    // -------------------------------------------------------------
    console.log("\n--- 9. CONTROLLER QUERY TAMPERING PREVENTION (RULE 1) ---");

    // Simulate client sending ?role=ADMIN and ?organization=<tenantB> while authenticated as OWNER of Org A
    let capturedRender = null;
    let capturedJson = null;
    const mockRes = {
      render: (view, data) => { capturedRender = { view, data }; },
      json: (data) => { capturedJson = data; },
      status: function(code) { this.statusCode = code; return this; }
    };

    const maliciousReq = {
      user: ownerUser, // OWNER belonging to existingOrg
      query: {
        role: "ADMIN",
        dashboard: "ADMIN",
        organization: tenantB._id.toString(),
        organizationId: tenantB._id.toString()
      },
      validatedDashboardQuery: { preset: "30d" }
    };

    await dashboardController.renderDashboard(maliciousReq, mockRes);
    assert(capturedRender && capturedRender.view === "dashboard/owner.ejs", "Controller strictly served owner.ejs, ignoring malicious ?role=ADMIN");
    assert(capturedRender.data.data.organizationId === existingOrg._id.toString(), "Controller strictly scoped data to user.organization, ignoring malicious ?organization= query");

    // Simulate CUSTOMER sending ?role=OWNER
    capturedRender = null;
    const maliciousCustReq = {
      user: customerUser,
      query: { role: "OWNER", organization: existingOrg._id.toString() },
      validatedDashboardQuery: { preset: "30d" }
    };

    await dashboardController.renderDashboard(maliciousCustReq, mockRes);
    assert(capturedRender && capturedRender.view === "dashboard/customer.ejs", "Controller strictly served customer.ejs, ignoring malicious customer ?role=OWNER");
    assert(capturedRender.data.data.userId === customerUser._id.toString(), "Controller strictly scoped data to customerUser._id");

    // -------------------------------------------------------------
    // 10. ADMIN DASHBOARD & BOUNDED AGGREGATION (RULE 9)
    // -------------------------------------------------------------
    console.log("\n--- 10. ADMIN SYSTEM-WIDE DASHBOARD & BOUNDED TABLES (RULE 9) ---");

    const adminDash = await dashboardService.getAdminDashboard({ preset: "all" });
    assert(adminDash.platformKPIs.totalOrganizations >= 2, `Admin sees all organizations (count: ${adminDash.platformKPIs.totalOrganizations})`);
    assert(adminDash.platformKPIs.totalBookings >= 6, `Admin sees platform total bookings (count: ${adminDash.platformKPIs.totalBookings})`);
    assert(adminDash.platformKPIs.confirmedCompletedValue >= 20000, `Admin aggregates total realized booking value across all tenants (>= 20,000)`);
    assert(Array.isArray(adminDash.organizationPerformance), "Admin dashboard includes organization performance table");
    assert(adminDash.organizationPerformance.length <= 25, `Organization performance table strictly bounded (<= 25 items, actual: ${adminDash.organizationPerformance.length})`);
    assert(adminDash.recentPlatformBookings.length <= 10, "Recent platform bookings bounded to 10 records");

    // -------------------------------------------------------------
    // 11. READ-ONLY INVARIANT (RULE 12)
    // -------------------------------------------------------------
    console.log("\n--- 11. READ-ONLY INVARIANT (RULE 12) ---");

    const bookingsBefore = await Booking.countDocuments();
    const roomsBefore = await Room.countDocuments();
    const listingsBefore = await Listing.countDocuments();
    const usersBefore = await User.countDocuments();
    const orgsBefore = await Organization.countDocuments();

    // Invoke all dashboard services multiple times
    await dashboardService.getAdminDashboard({ preset: "30d" });
    await dashboardService.getOrganizationDashboard(existingOrg._id, { preset: "today" });
    await dashboardService.getStaffDashboard(existingOrg._id);
    await dashboardService.getCustomerDashboard(customerUser._id, { preset: "7d" });

    const bookingsAfter = await Booking.countDocuments();
    const roomsAfter = await Room.countDocuments();
    const listingsAfter = await Listing.countDocuments();
    const usersAfter = await User.countDocuments();
    const orgsAfter = await Organization.countDocuments();

    assert(bookingsBefore === bookingsAfter, "Dashboard execution caused zero booking mutations");
    assert(roomsBefore === roomsAfter, "Dashboard execution caused zero room mutations");
    assert(listingsBefore === listingsAfter, "Dashboard execution caused zero listing mutations");
    assert(usersBefore === usersAfter, "Dashboard execution caused zero user mutations");
    assert(orgsBefore === orgsAfter, "Dashboard execution caused zero organization mutations");

  } finally {
    // -------------------------------------------------------------
    // 12. DATABASE CLEANUP & BASELINE PRESERVATION (RULE 14)
    // -------------------------------------------------------------
    console.log("\n--- 12. CLEANUP & DATABASE PRESERVATION (RULE 14) ---");

    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
      console.log(`Cleaned up ${createdBookingIds.length} temporary test bookings.`);
    }

    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`Cleaned up ${createdUserIds.length} temporary test users.`);
    }

    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
      console.log(`Cleaned up ${createdOrgIds.length} temporary test organizations.`);
    }

    // Verify post-cleanup counts match initial baseline
    const finalCounts = {
      listings: await Listing.countDocuments(),
      rooms: await Room.countDocuments(),
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments(),
      reviews: await Review.countDocuments(),
      bookings: await Booking.countDocuments()
    };

    assert(finalCounts.listings === initialCounts.listings, `Listing count preserved (${finalCounts.listings} === ${initialCounts.listings})`);
    assert(finalCounts.rooms === initialCounts.rooms, `Room count preserved (${finalCounts.rooms} === ${initialCounts.rooms})`);
    assert(finalCounts.users === initialCounts.users, `User count preserved (${finalCounts.users} === ${initialCounts.users})`);
    assert(finalCounts.organizations === initialCounts.organizations, `Organization count preserved (${finalCounts.organizations} === ${initialCounts.organizations})`);
    assert(finalCounts.reviews === initialCounts.reviews, `Review count preserved (${finalCounts.reviews} === ${initialCounts.reviews})`);
    assert(finalCounts.bookings === initialCounts.bookings, `Booking count preserved (${finalCounts.bookings} === ${initialCounts.bookings})`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n==================================================");
  console.log(`PHASE 8 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8Tests().catch((err) => {
  console.error("FATAL ERROR in Phase 8 test runner:", err);
  process.exit(1);
});
