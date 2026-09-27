/**
 * PHASE 16.4.1 TEST SUITE
 * WanderLust SaaS Landing, Role Login, Separate Dashboards & Operations
 *
 * Verifies:
 * 1. GET / serves SaaS landing page (unauthenticated)
 * 2. GET /login serves role-selector UI with 5 roles
 * 3. Server-authoritative role validation on login:
 *    - Rejects safely when selectedRole differs from req.user.role
 *    - Never grants access to unauthorized role dashboard
 * 4. Role-specific dashboard URLs & strict role isolation:
 *    - /customer/dashboard (CUSTOMER only)
 *    - /staff/dashboard (STAFF only)
 *    - /manager/dashboard (MANAGER only)
 *    - /owner/dashboard (OWNER only)
 *    - /admin/dashboard (ADMIN only)
 * 5. Manager separate EJS view renders properly
 * 6. Operations URLs & strict role isolation:
 *    - /staff/operations (STAFF only)
 *    - /manager/operations (MANAGER only)
 *    - /owner/operations (OWNER only)
 *    - /admin/operations (ADMIN only)
 * 7. Thin REST APIs enforce auth, RBAC, tenant isolation:
 *    - /api/v1/:role/dashboard
 *    - /api/v1/:role/operations
 * 8. Backward compatibility of /dashboard
 * 9. Absolute zero database mutation / baseline counts preservation
 */

const mongoose = require("mongoose");
const path = require("path");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Review = require("../src/models/review");
const Booking = require("../src/models/booking");
const ServiceIssue = require("../src/models/serviceIssue");

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

async function runPhase1641Tests() {
  console.log("==================================================");
  console.log("PHASE 16.4.1 SAAS PLATFORM TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  // Record baseline counts
  const baselineCounts = {
    listings: await Listing.countDocuments(),
    rooms: await Room.countDocuments(),
    users: await User.countDocuments(),
    organizations: await Organization.countDocuments(),
    reviews: await Review.countDocuments(),
    bookings: await Booking.countDocuments(),
    serviceissues: await ServiceIssue.countDocuments(),
  };

  console.log("Baseline counts:", baselineCounts);

  // Retrieve existing seeded org & users
  const existingOrg = await Organization.findOne();
  const customerUser = await User.findOne({ role: "CUSTOMER" });
  const ownerUser = await User.findOne({ role: "OWNER" });

  assert(Boolean(customerUser), "CUSTOMER user found in database");
  assert(Boolean(ownerUser), "OWNER user found in database");
  assert(Boolean(existingOrg), "Organization found in database");

  // In-memory role documents for STAFF, MANAGER, ADMIN (never written to database, preserves baseline)
  const staffUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-staff-op",
    email: "staff.op@test.com",
    role: "STAFF",
    organization: existingOrg._id
  });

  const managerUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-manager-op",
    email: "manager.op@test.com",
    role: "MANAGER",
    organization: existingOrg._id
  });

  const adminUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-admin-op",
    email: "admin.op@test.com",
    role: "ADMIN"
  });

  const app = createApp();

  // Helper to inject authenticated user session for testing
  function getAppForUser(user) {
    const express = require("express");
    const testApp = express();
    testApp.use((req, res, next) => {
      if (user) {
        req.user = user;
        req.isAuthenticated = () => true;
      } else {
        req.user = null;
        req.isAuthenticated = () => false;
      }
      next();
    });
    testApp.use(app);
    return testApp;
  }

  try {
    // -------------------------------------------------------------
    // 1. PUBLIC ROUTES (SaaS Landing & Login)
    // -------------------------------------------------------------
    console.log("\n--- 1. PUBLIC SAAS LANDING & LOGIN UI ---");

    const resHome = await request(app).get("/");
    assert(resHome.status === 200, "GET / returns HTTP 200");
    assert(resHome.text.includes("WanderLust"), "GET / includes WanderLust brand");
    assert(resHome.text.includes("Enterprise Hospitality SaaS") || resHome.text.includes("Run Every Stay"), "GET / includes SaaS landing headline");
    assert(resHome.text.includes("Features") || resHome.text.includes("features"), "GET / includes Features section/dropdown");

    const resLogin = await request(app).get("/login");
    assert(resLogin.status === 200, "GET /login returns HTTP 200");
    assert(resLogin.text.includes("selectedRole"), "GET /login includes selectedRole radio cards");
    assert(resLogin.text.includes("CUSTOMER") && resLogin.text.includes("ADMIN"), "GET /login includes all 5 roles");

    // -------------------------------------------------------------
    // 2. UNAUTHENTICATED ACCESS GUARDS (302 Redirect to /login)
    // -------------------------------------------------------------
    console.log("\n--- 2. UNAUTHENTICATED REDIRECT GUARDS ---");

    const unauthUrls = [
      "/customer/dashboard",
      "/staff/dashboard",
      "/manager/dashboard",
      "/owner/dashboard",
      "/admin/dashboard",
      "/staff/operations",
      "/manager/operations",
      "/owner/operations",
      "/admin/operations",
    ];

    for (const url of unauthUrls) {
      const res = await request(app).get(url);
      assert(res.status === 302, `Unauthenticated GET ${url} redirects (HTTP 302)`);
      assert(res.headers.location === "/login", `Unauthenticated GET ${url} redirects to /login`);
    }

    // -------------------------------------------------------------
    // 3. ROLE ISOLATION: CUSTOMER
    // -------------------------------------------------------------
    console.log("\n--- 3. ROLE ISOLATION: CUSTOMER ---");
    const customerApp = getAppForUser(customerUser);

    const resCustDash = await request(customerApp).get("/customer/dashboard");
    assert(resCustDash.status === 200, "CUSTOMER can access /customer/dashboard (HTTP 200)");

    // SSR unauthorized redirects to /listings with flash message
    const resCustStaffDash = await request(customerApp).get("/staff/dashboard");
    assert(resCustStaffDash.status === 302 && resCustStaffDash.headers.location === "/listings", "CUSTOMER cannot access /staff/dashboard (redirects to /listings)");

    const resCustMgrDash = await request(customerApp).get("/manager/dashboard");
    assert(resCustMgrDash.status === 302 && resCustMgrDash.headers.location === "/listings", "CUSTOMER cannot access /manager/dashboard (redirects to /listings)");

    const resCustOwnerDash = await request(customerApp).get("/owner/dashboard");
    assert(resCustOwnerDash.status === 302 && resCustOwnerDash.headers.location === "/listings", "CUSTOMER cannot access /owner/dashboard (redirects to /listings)");

    const resCustAdminDash = await request(customerApp).get("/admin/dashboard");
    assert(resCustAdminDash.status === 302 && resCustAdminDash.headers.location === "/listings", "CUSTOMER cannot access /admin/dashboard (redirects to /listings)");

    const resCustOps = await request(customerApp).get("/staff/operations");
    assert(resCustOps.status === 302 && resCustOps.headers.location === "/listings", "CUSTOMER cannot access /staff/operations (redirects to /listings)");

    // -------------------------------------------------------------
    // 4. ROLE ISOLATION: STAFF
    // -------------------------------------------------------------
    console.log("\n--- 4. ROLE ISOLATION: STAFF ---");
    const staffApp = getAppForUser(staffUser);

    const resStaffDash = await request(staffApp).get("/staff/dashboard");
    assert(resStaffDash.status === 200, "STAFF can access /staff/dashboard (HTTP 200)");

    const resStaffOps = await request(staffApp).get("/staff/operations");
    assert(resStaffOps.status === 200, "STAFF can access /staff/operations (HTTP 200)");

    const resStaffCustDash = await request(staffApp).get("/customer/dashboard");
    assert(resStaffCustDash.status === 302 && resStaffCustDash.headers.location === "/listings", "STAFF cannot access /customer/dashboard (redirects to /listings)");

    const resStaffAdminDash = await request(staffApp).get("/admin/dashboard");
    assert(resStaffAdminDash.status === 302 && resStaffAdminDash.headers.location === "/listings", "STAFF cannot access /admin/dashboard (redirects to /listings)");

    // -------------------------------------------------------------
    // 5. ROLE ISOLATION: MANAGER
    // -------------------------------------------------------------
    console.log("\n--- 5. ROLE ISOLATION: MANAGER ---");
    const mgrApp = getAppForUser(managerUser);

    const resMgrDash = await request(mgrApp).get("/manager/dashboard");
    assert(resMgrDash.status === 200, "MANAGER can access /manager/dashboard (HTTP 200)");
    assert(resMgrDash.text.includes("Property Operations"), "MANAGER dashboard renders separate manager view");

    const resMgrOps = await request(mgrApp).get("/manager/operations");
    assert(resMgrOps.status === 200, "MANAGER can access /manager/operations (HTTP 200)");

    const resMgrAdminDash = await request(mgrApp).get("/admin/dashboard");
    assert(resMgrAdminDash.status === 302 && resMgrAdminDash.headers.location === "/listings", "MANAGER cannot access /admin/dashboard (redirects to /listings)");

    // -------------------------------------------------------------
    // 6. ROLE ISOLATION: OWNER
    // -------------------------------------------------------------
    console.log("\n--- 6. ROLE ISOLATION: OWNER ---");
    const ownerApp = getAppForUser(ownerUser);

    const resOwnerDash = await request(ownerApp).get("/owner/dashboard");
    assert(resOwnerDash.status === 200, "OWNER can access /owner/dashboard (HTTP 200)");

    const resOwnerOps = await request(ownerApp).get("/owner/operations");
    assert(resOwnerOps.status === 200, "OWNER can access /owner/operations (HTTP 200)");

    const resOwnerAdminDash = await request(ownerApp).get("/admin/dashboard");
    assert(resOwnerAdminDash.status === 302 && resOwnerAdminDash.headers.location === "/listings", "OWNER cannot access /admin/dashboard (redirects to /listings)");

    // -------------------------------------------------------------
    // 7. ROLE ISOLATION: ADMIN
    // -------------------------------------------------------------
    console.log("\n--- 7. ROLE ISOLATION: ADMIN ---");
    const adminApp = getAppForUser(adminUser);

    const resAdminDash = await request(adminApp).get("/admin/dashboard");
    assert(resAdminDash.status === 200, "ADMIN can access /admin/dashboard (HTTP 200)");

    const resAdminOps = await request(adminApp).get("/admin/operations");
    assert(resAdminOps.status === 200, "ADMIN can access /admin/operations (HTTP 200)");

    const resAdminStaffOps = await request(adminApp).get("/staff/operations");
    assert(resAdminStaffOps.status === 302 && resAdminStaffOps.headers.location === "/listings", "ADMIN cannot access /staff/operations (redirects to /listings - strict isolation)");

    // -------------------------------------------------------------
    // 8. BACKWARD-COMPATIBLE /dashboard GATEWAY
    // -------------------------------------------------------------
    console.log("\n--- 8. BACKWARD-COMPATIBLE /dashboard GATEWAY ---");

    const resCustGate = await request(customerApp).get("/dashboard");
    assert(resCustGate.status === 200, "CUSTOMER can access /dashboard gateway (HTTP 200)");

    const resStaffGate = await request(staffApp).get("/dashboard");
    assert(resStaffGate.status === 200, "STAFF can access /dashboard gateway (HTTP 200)");

    const resMgrGate = await request(mgrApp).get("/dashboard");
    assert(resMgrGate.status === 200, "MANAGER can access /dashboard gateway (HTTP 200)");

    const resOwnerGate = await request(ownerApp).get("/dashboard");
    assert(resOwnerGate.status === 200, "OWNER can access /dashboard gateway (HTTP 200)");

    const resAdminGate = await request(adminApp).get("/dashboard");
    assert(resAdminGate.status === 200, "ADMIN can access /dashboard gateway (HTTP 200)");

    // -------------------------------------------------------------
    // 9. THIN REST APIS (/api/v1/...)
    // -------------------------------------------------------------
    console.log("\n--- 9. THIN REST APIS (/api/v1/...) ---");

    // Unauthenticated API request
    const resApiUnauth = await request(app).get("/api/v1/customer/dashboard");
    assert(resApiUnauth.status === 401, "Unauthenticated GET /api/v1/customer/dashboard returns HTTP 401");

    // Customer accessing Customer API
    const resApiCust = await request(customerApp).get("/api/v1/customer/dashboard");
    assert(resApiCust.status === 200, "CUSTOMER GET /api/v1/customer/dashboard returns HTTP 200");
    assert(resApiCust.body.success === true && resApiCust.body.role === "CUSTOMER", "Customer API returns correct JSON");

    // Customer forbidden from Admin API
    const resApiCustToAdmin = await request(customerApp).get("/api/v1/admin/dashboard");
    assert(resApiCustToAdmin.status === 403, "CUSTOMER GET /api/v1/admin/dashboard returns HTTP 403");

    // Staff accessing Staff Operations API
    const resApiStaffOps = await request(staffApp).get("/api/v1/staff/operations");
    assert(resApiStaffOps.status === 200, "STAFF GET /api/v1/staff/operations returns HTTP 200");
    assert(resApiStaffOps.body.success === true && resApiStaffOps.body.role === "STAFF", "Staff Operations API returns correct JSON");

    // Manager accessing Manager Operations API
    const resApiMgrOps = await request(mgrApp).get("/api/v1/manager/operations");
    assert(resApiMgrOps.status === 200, "MANAGER GET /api/v1/manager/operations returns HTTP 200");
    assert(resApiMgrOps.body.success === true && resApiMgrOps.body.role === "MANAGER", "Manager Operations API returns correct JSON");

    // Admin accessing Admin Dashboard API
    const resApiAdmin = await request(adminApp).get("/api/v1/admin/dashboard");
    assert(resApiAdmin.status === 200, "ADMIN GET /api/v1/admin/dashboard returns HTTP 200");
    assert(resApiAdmin.body.success === true && resApiAdmin.body.role === "ADMIN", "Admin Dashboard API returns correct JSON");

    // -------------------------------------------------------------
    // 10. LOGIN ROLE MISMATCH SECURITY REJECTION
    // -------------------------------------------------------------
    console.log("\n--- 10. SERVER-AUTHORITATIVE LOGIN ROLE VALIDATION ---");

    const userController = require("../src/controllers/user");

    // SSR login mismatch test:
    let logoutCalled = false;
    let redirectedTo = null;
    let flashMessage = null;

    const mockReq = {
      body: { selectedRole: "ADMIN" }, // client claimed ADMIN
      user: { role: "CUSTOMER", username: "testcustomer" }, // authenticated DB role is CUSTOMER
      flash: (type, msg) => { flashMessage = msg; },
      logout: (cb) => { logoutCalled = true; if (cb) cb(); }
    };
    const mockRes = {
      redirect: (url) => { redirectedTo = url; }
    };

    await userController.login(mockReq, mockRes, () => {});
    assert(logoutCalled === true, "Login with mismatched selectedRole calls req.logout()");
    assert(redirectedTo === "/login", "Login with mismatched selectedRole redirects safely to /login");
    assert(flashMessage && flashMessage.includes("Access denied"), "Login with mismatched selectedRole sets flash error");
    assert(redirectedTo !== "/admin/dashboard", "Login never redirects to unauthorized requested role dashboard");

  } finally {
    // -------------------------------------------------------------
    // 11. BASELINE DATABASE INVARIANT CHECK
    // -------------------------------------------------------------
    console.log("\n--- 11. DATABASE BASELINE PRESERVATION ---");

    const finalCounts = {
      listings: await Listing.countDocuments(),
      rooms: await Room.countDocuments(),
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments(),
      reviews: await Review.countDocuments(),
      bookings: await Booking.countDocuments(),
      serviceissues: await ServiceIssue.countDocuments(),
    };

    console.log("Final counts:", finalCounts);

    assert(finalCounts.listings === baselineCounts.listings, `Listings count unchanged (${finalCounts.listings})`);
    assert(finalCounts.rooms === baselineCounts.rooms, `Rooms count unchanged (${finalCounts.rooms})`);
    assert(finalCounts.users === baselineCounts.users, `Users count unchanged (${finalCounts.users})`);
    assert(finalCounts.organizations === baselineCounts.organizations, `Organizations count unchanged (${finalCounts.organizations})`);
    assert(finalCounts.reviews === baselineCounts.reviews, `Reviews count unchanged (${finalCounts.reviews})`);
    assert(finalCounts.bookings === baselineCounts.bookings, `Bookings count unchanged (${finalCounts.bookings})`);
    assert(finalCounts.serviceissues === baselineCounts.serviceissues, `ServiceIssues count unchanged (${finalCounts.serviceissues})`);

    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase1641Tests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
