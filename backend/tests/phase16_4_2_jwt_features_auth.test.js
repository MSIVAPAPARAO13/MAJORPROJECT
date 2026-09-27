/**
 * PHASE 16.4.2 TEST SUITE
 * JWT Authentication, Refresh Token Rotation, Role Feature Registry,
 * Auth Lifecycle (login/signup/logout), User Preferences, and Role Isolation
 */

const mongoose = require("mongoose");
const path = require("path");
const request = require("supertest");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const User = require("../src/models/user");
const Organization = require("../src/models/organization");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const Booking = require("../src/models/booking");
const ServiceIssue = require("../src/models/serviceIssue");
const Review = require("../src/models/review");
const RefreshToken = require("../src/models/refreshToken");
const UserPreference = require("../src/models/userPreference");

const createApp = require("../src/app");
const { getFeaturesForUser } = require("../src/config/featureRegistry");

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

async function runPhase1642Tests() {
  console.log("==================================================");
  console.log("PHASE 16.4.2 JWT, FEATURES & AUTH LIFECYCLE TESTS");
  console.log("==================================================\n");

  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  // Record baseline counts to ensure zero Atlas pollution
  const baselineCounts = {
    listings: await Listing.countDocuments(),
    rooms: await Room.countDocuments(),
    users: await User.countDocuments(),
    organizations: await Organization.countDocuments(),
    reviews: await Review.countDocuments(),
    bookings: await Booking.countDocuments(),
    serviceissues: await ServiceIssue.countDocuments()
  };

  const app = createApp();

  // Retrieve existing seeded org & users
  const existingOrg = await Organization.findOne();
  const customerUser = await User.findOne({ role: "CUSTOMER" });
  const ownerUser = await User.findOne({ role: "OWNER" });

  // In-memory documents for non-persisted test roles
  const staffUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-staff-1642",
    email: "staff1642@test.local",
    role: "STAFF",
    organization: existingOrg._id
  });

  const managerUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-manager-1642",
    email: "manager1642@test.local",
    role: "MANAGER",
    organization: existingOrg._id
  });

  const adminUser = new User({
    _id: new mongoose.Types.ObjectId(),
    username: "test-admin-1642",
    email: "admin1642@test.local",
    role: "ADMIN"
  });

  // Helper for authenticated session testing
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

  // Cleanup helper for created tokens/users in this test
  const testCreatedUserIds = [];

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATED USER PROTECTION ON /login & /signup
    // -------------------------------------------------------------
    console.log("--- 1. AUTHENTICATED REDIRECT FROM /login & /signup ---");

    const customerApp = getAppForUser(customerUser);
    const ownerApp = getAppForUser(ownerUser);

    const resCustLogin = await request(customerApp).get("/login");
    assert(
      resCustLogin.status === 302 && resCustLogin.headers.location === "/customer/dashboard",
      "Authenticated CUSTOMER visiting /login redirects to /customer/dashboard"
    );

    const resCustSignup = await request(customerApp).get("/signup");
    assert(
      resCustSignup.status === 302 && resCustSignup.headers.location === "/customer/dashboard",
      "Authenticated CUSTOMER visiting /signup redirects to /customer/dashboard"
    );

    const resOwnerLogin = await request(ownerApp).get("/login");
    assert(
      resOwnerLogin.status === 302 && resOwnerLogin.headers.location === "/owner/dashboard",
      "Authenticated OWNER visiting /login redirects to /owner/dashboard"
    );

    // -------------------------------------------------------------
    // 2. LOGOUT LIFECYCLE & CACHE-CONTROL HEADERS
    // -------------------------------------------------------------
    console.log("\n--- 2. LOGOUT LIFECYCLE & CACHE-CONTROL ---");

    const resLogout = await request(customerApp).get("/logout");
    assert(
      resLogout.status === 302 && resLogout.headers.location === "/",
      "GET /logout redirects to root landing page (/)"
    );

    const resProtectedAfter = await request(app).get("/customer/dashboard");
    assert(
      resProtectedAfter.status === 302 && resProtectedAfter.headers.location === "/login",
      "Protected dashboard route inaccessible after logout (redirects to /login)"
    );

    // Verify Cache-Control: no-store on authenticated dashboard
    const resAuthCache = await request(customerApp).get("/customer/dashboard");
    assert(
      resAuthCache.headers["cache-control"] && resAuthCache.headers["cache-control"].includes("no-store"),
      "Authenticated route sets Cache-Control: no-store header"
    );

    // -------------------------------------------------------------
    // 3. JWT API AUTHENTICATION & TOKEN ROTATION
    // -------------------------------------------------------------
    console.log("\n--- 3. JWT API AUTHENTICATION & REFRESH ROTATION ---");

    const {
      generateAccessToken,
      generateRefreshToken,
      rotateRefreshToken,
      verifyAccessToken,
      revokeRefreshToken
    } = require("../src/services/jwtService");

    // Test access token generation and claims
    const token = generateAccessToken(customerUser);
    assert(typeof token === "string" && token.length > 50, "Generated JWT access token");

    const decoded = verifyAccessToken(token);
    assert(decoded.sub === customerUser._id.toString(), "Access token sub claim matches user ID");
    assert(decoded.role === "CUSTOMER", "Access token role claim matches user role");
    assert(decoded.jti !== undefined, "Access token contains unique jti claim");

    // Test refresh token generation & storage
    const { rawToken, expiresAt, familyId } = await generateRefreshToken(customerUser);
    assert(typeof rawToken === "string" && rawToken.length === 80, "Generated 80-char opaque refresh token");
    assert(Boolean(familyId), "Refresh token generated with familyId");

    // Test token rotation
    const rotationResult = await rotateRefreshToken(rawToken);
    assert(Boolean(rotationResult.accessToken), "Token rotation issues new access token");
    assert(Boolean(rotationResult.refreshToken), "Token rotation issues new refresh token");
    assert(rotationResult.refreshToken !== rawToken, "New refresh token is distinct from old token");

    // Test token reuse detection (replay attack defense)
    let reuseDetected = false;
    try {
      await rotateRefreshToken(rawToken); // Attempting to reuse old rawToken
    } catch (err) {
      reuseDetected = err.message.includes("reuse detected");
    }
    assert(reuseDetected === true, "Presenting revoked refresh token triggers automatic family reuse revocation");

    // Test token revocation
    const tokenToRevoke = await generateRefreshToken(customerUser);
    const revokeSuccess = await revokeRefreshToken(tokenToRevoke.rawToken);
    assert(revokeSuccess === true, "revokeRefreshToken marks token as revoked");

    // Clean up test refresh tokens created during this test
    await RefreshToken.deleteMany({ user: customerUser._id });

    // -------------------------------------------------------------
    // 4. JWT REST API ENDPOINTS (/api/v2/auth/*)
    // -------------------------------------------------------------
    console.log("\n--- 4. REST API /api/v2/auth/* ENDPOINTS ---");

    // Test GET /api/v2/auth/me without token -> 401
    const resMeUnauth = await request(app).get("/api/v2/auth/me");
    assert(resMeUnauth.status === 401, "GET /api/v2/auth/me without Bearer token returns 401");

    // Test GET /api/v2/auth/me with valid token -> 200
    const resMeAuth = await request(app)
      .get("/api/v2/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert(resMeAuth.status === 200, "GET /api/v2/auth/me with valid Bearer token returns 200");
    assert(resMeAuth.body.user && resMeAuth.body.user.role === "CUSTOMER", "Authenticated user profile matches token");

    // Test GET /api/v2/auth/me with malformed / tampered token -> 401
    const resMeTampered = await request(app)
      .get("/api/v2/auth/me")
      .set("Authorization", `Bearer ${token}tampered`);
    assert(resMeTampered.status === 401, "GET /api/v2/auth/me with tampered token returns 401");

    // Test POST /api/v2/auth/refresh without token -> 401
    const resRefreshMissing = await request(app).post("/api/v2/auth/refresh").send({});
    assert(resRefreshMissing.status === 401, "POST /api/v2/auth/refresh with missing token returns 401");

    // Test POST /api/v2/auth/logout -> 200
    const resApiLogout = await request(app).post("/api/v2/auth/logout").send({});
    assert(resApiLogout.status === 200, "POST /api/v2/auth/logout returns 200");

    // -------------------------------------------------------------
    // 5. ROLE FEATURE CATALOG & /api/v2/features
    // -------------------------------------------------------------
    console.log("\n--- 5. ROLE FEATURE REGISTRY & /api/v2/features ---");

    // Anonymous features
    const resAnonFeatures = await request(app).get("/api/v2/features");
    assert(resAnonFeatures.status === 200, "GET /api/v2/features (anonymous) returns 200");
    assert(resAnonFeatures.body.role === "ANONYMOUS", "Anonymous features endpoint reports ANONYMOUS role");

    // Customer features
    const customerFeatures = getFeaturesForUser(customerUser);
    const customerFeatureIds = customerFeatures.map((f) => f.id);
    assert(customerFeatureIds.includes("exploreStays"), "CUSTOMER can access exploreStays");
    assert(customerFeatureIds.includes("myTrips"), "CUSTOMER can access myTrips");
    assert(!customerFeatureIds.includes("platformAdministration"), "CUSTOMER cannot access platformAdministration");
    assert(!customerFeatureIds.includes("hospitalityOperations"), "CUSTOMER cannot access hospitalityOperations");

    // Staff features
    const staffFeatures = getFeaturesForUser(staffUser);
    const staffFeatureIds = staffFeatures.map((f) => f.id);
    assert(staffFeatureIds.includes("hospitalityOperations"), "STAFF can access hospitalityOperations");
    assert(staffFeatureIds.includes("serviceIssues"), "STAFF can access serviceIssues");
    assert(staffFeatureIds.includes("guestReady"), "STAFF can access guestReady");
    assert(staffFeatureIds.includes("guestImpact"), "STAFF can access guestImpact");
    assert(!staffFeatureIds.includes("platformAdministration"), "STAFF cannot access platformAdministration");

    // Admin features
    const adminFeatures = getFeaturesForUser(adminUser);
    const adminFeatureIds = adminFeatures.map((f) => f.id);
    assert(adminFeatureIds.includes("platformAdministration"), "ADMIN can access platformAdministration");
    assert(adminFeatureIds.includes("organizationManagement"), "ADMIN can access organizationManagement");

    // Authenticated API request to /api/v2/features with JWT Bearer
    const resCustApiFeatures = await request(app)
      .get("/api/v2/features")
      .set("Authorization", `Bearer ${token}`);
    assert(resCustApiFeatures.status === 200, "GET /api/v2/features with Bearer token returns 200");
    assert(resCustApiFeatures.body.role === "CUSTOMER", "Token role reflected in /api/v2/features response");

    // -------------------------------------------------------------
    // 6. VERSIONED API v2 DASHBOARDS & OPERATIONS
    // -------------------------------------------------------------
    console.log("\n--- 6. API v2 DASHBOARDS & OPERATIONS RBAC ---");

    // Customer token accessing customer dashboard -> 200
    const resV2CustDash = await request(app)
      .get("/api/v2/customer/dashboard")
      .set("Authorization", `Bearer ${token}`);
    assert(resV2CustDash.status === 200, "CUSTOMER Bearer token accesses /api/v2/customer/dashboard (200)");

    // Customer token accessing admin dashboard -> 403
    const resV2AdminForbidden = await request(app)
      .get("/api/v2/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);
    assert(resV2AdminForbidden.status === 403, "CUSTOMER Bearer token blocked from /api/v2/admin/dashboard (403)");

    // Customer token accessing staff operations -> 403
    const resV2StaffOpsForbidden = await request(app)
      .get("/api/v2/staff/operations")
      .set("Authorization", `Bearer ${token}`);
    assert(resV2StaffOpsForbidden.status === 403, "CUSTOMER Bearer token blocked from /api/v2/staff/operations (403)");

    // -------------------------------------------------------------
    // 7. USER PREFERENCES API (/api/v2/preferences)
    // -------------------------------------------------------------
    console.log("\n--- 7. USER PREFERENCES API (/api/v2/preferences) ---");

    // Unauthenticated GET -> 401
    const resPrefUnauth = await request(app).get("/api/v2/preferences");
    assert(resPrefUnauth.status === 401, "GET /api/v2/preferences unauthenticated returns 401");

    // Authenticated GET with Bearer token -> 200 (defaults)
    const resPrefGet = await request(app)
      .get("/api/v2/preferences")
      .set("Authorization", `Bearer ${token}`);
    assert(resPrefGet.status === 200, "GET /api/v2/preferences with Bearer token returns 200");
    assert(resPrefGet.body.preferences.theme !== undefined, "Preferences contain theme field");

    // Authenticated PATCH with Bearer token -> 200
    const resPrefPatch = await request(app)
      .patch("/api/v2/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ theme: "dark", density: "compact" });
    assert(resPrefPatch.status === 200, "PATCH /api/v2/preferences returns 200");
    assert(resPrefPatch.body.preferences.theme === "dark", "Preference theme updated to dark");
    assert(resPrefPatch.body.preferences.density === "compact", "Preference density updated to compact");

    // Clean up created user preference record
    await UserPreference.deleteMany({ user: customerUser._id });

  } finally {
    // -------------------------------------------------------------
    // 8. DATABASE BASELINE PRESERVATION CHECK
    // -------------------------------------------------------------
    console.log("\n--- 8. DATABASE BASELINE PRESERVATION ---");

    const finalCounts = {
      listings: await Listing.countDocuments(),
      rooms: await Room.countDocuments(),
      users: await User.countDocuments(),
      organizations: await Organization.countDocuments(),
      reviews: await Review.countDocuments(),
      bookings: await Booking.countDocuments(),
      serviceissues: await ServiceIssue.countDocuments()
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

runPhase1642Tests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
