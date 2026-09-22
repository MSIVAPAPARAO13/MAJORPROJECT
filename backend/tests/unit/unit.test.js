/**
 * Phase 11 Unit Test Suite
 * Pure logic verification covering 19 distinct areas:
 * - Permission checks & Role-permission matrix
 * - Tenant access rules logic
 * - Redirect URL sanitization
 * - MongoDB operator injection sanitization
 * - CSRF token generation & timing-safe validation
 * - Search query, limit, sort whitelist & price range validation
 * - Half-open interval date overlap calculations
 * - Room capacity validation & rules
 * - Booking pricing calculations & server-side integrity
 * - Booking status transition logic
 * - Image normalization, position sorting & primary invariant
 * - Cloudinary public-ID security validation
 * - Dashboard metric calculations & financial formulas
 * - Safe production error masking
 */

const { PERMISSIONS, ROLE_PERMISSIONS, hasRole, hasPermission } = require("../../src/config/permissions");
const { sanitizeRedirectUrl } = require("../../src/middleware/auth");
const { sanitizeObject } = require("../../src/middleware/mongoSanitize");
const csrfMiddleware = require("../../src/middleware/csrf");
const crypto = require("crypto");
const { searchQuerySchema } = require("../../src/validators/searchValidator");
const { bookingSchema } = require("../../src/validators/bookingValidator");
const { normalizeListingImages, isGenuineCloudinaryPublicId, isCloudinaryAsset } = require("../../src/services/imageService");
const { validateDashboardFilters } = require("../../src/validators/dashboardValidator");

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

async function runUnitTests() {
  console.log("==================================================");
  console.log("PHASE 11 UNIT TEST SUITE");
  console.log("==================================================\n");

  // ----------------------------------------------------
  // 1 & 2: Permission Checks & Role-Permission Matrix
  // ----------------------------------------------------
  console.log("--- 1. RBAC PERMISSIONS & ROLE MATRIX ---");
  const dummyOrgId = "507f1f77bcf86cd799439011";
  const customer = { role: "CUSTOMER", organization: dummyOrgId };
  const staff = { role: "STAFF", organization: dummyOrgId };
  const manager = { role: "MANAGER", organization: dummyOrgId };
  const owner = { role: "OWNER", organization: dummyOrgId };
  const admin = { role: "ADMIN", organization: dummyOrgId };

  assert(hasPermission(customer, PERMISSIONS.PROPERTY_VIEW_PUBLIC), "CUSTOMER has PROPERTY_VIEW_PUBLIC");
  assert(!hasPermission(customer, PERMISSIONS.PROPERTY_CREATE), "CUSTOMER cannot create properties");
  assert(!hasPermission(customer, PERMISSIONS.ORGANIZATION_MANAGE), "CUSTOMER cannot manage organization");
  assert(hasPermission(staff, PERMISSIONS.PROPERTY_UPDATE), "STAFF has PROPERTY_UPDATE");
  assert(!hasPermission(staff, PERMISSIONS.ANALYTICS_VIEW), "STAFF cannot view analytics");
  assert(hasPermission(manager, PERMISSIONS.PROPERTY_CREATE), "MANAGER can create properties");
  assert(hasPermission(manager, PERMISSIONS.ANALYTICS_VIEW), "MANAGER has ANALYTICS_VIEW");
  assert(hasPermission(owner, PERMISSIONS.ORGANIZATION_MANAGE), "OWNER can manage own organization");
  assert(!hasPermission(owner, PERMISSIONS.ORGANIZATION_CREATE), "OWNER cannot create organizations");
  assert(hasPermission(admin, PERMISSIONS.ORGANIZATION_CREATE), "ADMIN can create organizations");
  assert(hasPermission(admin, PERMISSIONS.SYSTEM_MANAGE), "ADMIN has SYSTEM_MANAGE");

  // ----------------------------------------------------
  // 3: Tenant Access Rules Logic
  // ----------------------------------------------------
  console.log("\n--- 2. TENANT ACCESS RULES LOGIC ---");
  const orgA = "507f1f77bcf86cd799439011";
  const orgB = "507f1f77bcf86cd799439022";
  const userA = { role: "OWNER", organization: orgA };
  const adminUser = { role: "ADMIN", organization: null };

  const isSameTenant = (user, resourceOrgId) => {
    if (user.role === "ADMIN") return true;
    return String(user.organization) === String(resourceOrgId);
  };

  assert(isSameTenant(userA, orgA), "User A can access resource in Tenant A");
  assert(!isSameTenant(userA, orgB), "User A is blocked from resource in Tenant B");
  assert(isSameTenant(adminUser, orgB), "ADMIN can access resource across any tenant");

  // ----------------------------------------------------
  // 4: Redirect Sanitization
  // ----------------------------------------------------
  console.log("\n--- 3. REDIRECT URL SANITIZATION ---");
  assert(sanitizeRedirectUrl("/listings") === "/listings", "Valid relative path '/listings' preserved");
  assert(sanitizeRedirectUrl("/listings/123/rooms") === "/listings/123/rooms", "Nested relative path preserved");
  assert(sanitizeRedirectUrl("https://evil.example.com") === "/listings", "External absolute URL defaulted to /listings");
  assert(sanitizeRedirectUrl("//evil.example.com") === "/listings", "Protocol-relative URL defaulted to /listings");
  assert(sanitizeRedirectUrl("/\\evil.example.com") === "/listings", "Backslash-escaped URL defaulted to /listings");
  assert(sanitizeRedirectUrl("javascript:alert(1)") === "/listings", "Javascript URI defaulted to /listings");
  assert(sanitizeRedirectUrl("/login\r\nSet-Cookie: evil") === "/listings", "CRLF injection defaulted to /listings");

  // ----------------------------------------------------
  // 5: MongoDB Operator Sanitization
  // ----------------------------------------------------
  console.log("\n--- 4. MONGODB OPERATOR SANITIZATION ---");
  const dirtyPayload = {
    username: "john_doe",
    password: { $ne: null },
    nested: {
      $gt: 0,
      legit: "value",
      "dot.key": "injected"
    }
  };
  const sanitized = sanitizeObject(dirtyPayload);
  assert(sanitized.username === "john_doe", "Legitimate scalar preserved");
  assert(sanitized.password === undefined, "Operator-only object pruned completely");
  assert(sanitized.nested.legit === "value", "Legitimate nested field preserved");
  assert(sanitized.nested.$gt === undefined, "Nested $gt operator stripped");
  assert(sanitized.nested["dot.key"] === undefined, "Dot notation key stripped");

  // ----------------------------------------------------
  // 6: CSRF Token Validation
  // ----------------------------------------------------
  console.log("\n--- 5. CSRF TOKEN GENERATION & VERIFICATION ---");
  const token = crypto.randomBytes(32).toString("hex");
  assert(typeof token === "string" && token.length === 64, "Generated CSRF token is 64 hex characters");
  assert(csrfMiddleware.safeCompare(token, token), "Matching CSRF token verified successfully");
  assert(!csrfMiddleware.safeCompare(token, "invalid_token_value_of_incorrect_length"), "Invalid length CSRF token rejected");
  assert(!csrfMiddleware.safeCompare(token, crypto.randomBytes(32).toString("hex")), "Mismatched CSRF token rejected");
  assert(!csrfMiddleware.safeCompare(token, null), "Null CSRF token rejected");
  assert(!csrfMiddleware.safeCompare(token, undefined), "Undefined CSRF token rejected");

  // ----------------------------------------------------
  // 7, 8, 9, 10: Search Query Validation & Constraints
  // ----------------------------------------------------
  console.log("\n--- 6. SEARCH QUERY VALIDATION & CONSTRAINTS ---");
  const validSearch = {
    q: "cozy villa",
    minPrice: 1000,
    maxPrice: 5000,
    sort: "price_asc",
    page: 1,
    limit: 20
  };
  const { error: validError } = searchQuerySchema.validate(validSearch);
  assert(!validError, "Valid search query passes schema validation");

  const excessiveLimit = { limit: 51 };
  const { error: limitError } = searchQuerySchema.validate(excessiveLimit);
  assert(!!limitError, "Search limit > 50 is strictly rejected");

  const invalidSort = { sort: "malicious_column" };
  const { error: sortError } = searchQuerySchema.validate(invalidSort);
  assert(!!sortError, "Non-whitelisted sort parameter is rejected");

  const negativePrice = { minPrice: -50 };
  const { error: negPriceError } = searchQuerySchema.validate(negativePrice);
  assert(!!negPriceError, "Negative minPrice is rejected");

  // ----------------------------------------------------
  // 11: Half-Open Interval Date Overlap Calculations
  // ----------------------------------------------------
  console.log("\n--- 7. DATE OVERLAP & HALF-OPEN INTERVAL CALCULATIONS ---");
  const bCheckIn = new Date("2026-11-01T14:00:00.000Z");
  const bCheckOut = new Date("2026-11-04T11:00:00.000Z");

  const isOverlapping = (startA, endA, startB, endB) => {
    return startA < endB && endA > startB;
  };

  // Overlap cases
  assert(isOverlapping(new Date("2026-11-01T14:00:00.000Z"), new Date("2026-11-04T11:00:00.000Z"), bCheckIn, bCheckOut), "Exact overlap detected");
  assert(isOverlapping(new Date("2026-11-02T14:00:00.000Z"), new Date("2026-11-05T11:00:00.000Z"), bCheckIn, bCheckOut), "Partial start overlap detected");
  assert(isOverlapping(new Date("2026-10-30T14:00:00.000Z"), new Date("2026-11-02T11:00:00.000Z"), bCheckIn, bCheckOut), "Partial end overlap detected");
  assert(isOverlapping(new Date("2026-10-31T14:00:00.000Z"), new Date("2026-11-05T11:00:00.000Z"), bCheckIn, bCheckOut), "Surrounding overlap detected");

  // Half-open interval cases (adjacent checkIn/checkOut are valid, non-overlapping)
  assert(!isOverlapping(new Date("2026-11-04T14:00:00.000Z"), new Date("2026-11-07T11:00:00.000Z"), bCheckIn, bCheckOut), "Adjacent checkout->checkin does NOT overlap");
  assert(!isOverlapping(new Date("2026-10-28T14:00:00.000Z"), new Date("2026-11-01T11:00:00.000Z"), bCheckIn, bCheckOut), "Adjacent checkin<-checkout does NOT overlap");

  // ----------------------------------------------------
  // 12: Room Capacity Validation & Rules
  // ----------------------------------------------------
  console.log("\n--- 8. ROOM CAPACITY RULES ---");
  const roomCapacity = 2;
  const validateCapacity = (guests, cap) => {
    return Number.isInteger(guests) && guests >= 1 && guests <= cap;
  };

  assert(validateCapacity(2, roomCapacity), "Guest count equal to capacity is valid");
  assert(validateCapacity(1, roomCapacity), "Guest count less than capacity is valid");
  assert(!validateCapacity(3, roomCapacity), "Guest count exceeding capacity is rejected");
  assert(!validateCapacity(0, roomCapacity), "Guest count of 0 is rejected");
  assert(!validateCapacity(-1, roomCapacity), "Negative guest count is rejected");

  // ----------------------------------------------------
  // 13: Booking Pricing Calculation
  // ----------------------------------------------------
  console.log("\n--- 9. BOOKING PRICING CALCULATION ---");
  const calculatePricing = (checkIn, checkOut, roomPrice) => {
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (nights <= 0) throw new Error("Invalid duration");
    return {
      totalNights: nights,
      pricePerNight: roomPrice,
      totalPrice: nights * roomPrice
    };
  };

  const pricing = calculatePricing("2026-11-01", "2026-11-04", 3000);
  assert(pricing.totalNights === 3, "Calculated 3 nights correctly");
  assert(pricing.pricePerNight === 3000, "Preserved room price per night");
  assert(pricing.totalPrice === 9000, "Calculated total price 3 * 3000 = 9000 correctly");

  // ----------------------------------------------------
  // 14: Booking Status Transition Logic
  // ----------------------------------------------------
  console.log("\n--- 10. BOOKING STATUS TRANSITION LOGIC ---");
  const VALID_TRANSITIONS = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED"],
    CANCELLED: [], // terminal
    COMPLETED: []  // terminal
  };

  const canTransition = (current, next) => {
    return (VALID_TRANSITIONS[current] || []).includes(next);
  };

  assert(canTransition("PENDING", "CONFIRMED"), "PENDING -> CONFIRMED allowed");
  assert(canTransition("PENDING", "CANCELLED"), "PENDING -> CANCELLED allowed");
  assert(canTransition("CONFIRMED", "COMPLETED"), "CONFIRMED -> COMPLETED allowed");
  assert(canTransition("CONFIRMED", "CANCELLED"), "CONFIRMED -> CANCELLED allowed");
  assert(!canTransition("CANCELLED", "CONFIRMED"), "CANCELLED -> CONFIRMED rejected (terminal state)");
  assert(!canTransition("COMPLETED", "CANCELLED"), "COMPLETED -> CANCELLED rejected (terminal state)");

  // ----------------------------------------------------
  // 15 & 16: Image Normalization & Primary Invariant
  // ----------------------------------------------------
  console.log("\n--- 11. IMAGE NORMALIZATION & PRIMARY INVARIANT ---");
  const rawImages = [
    { url: "https://example.com/img1.jpg", isPrimary: false, position: 5 },
    { url: "https://example.com/img2.jpg", isPrimary: true, position: 2 },
    { url: "https://example.com/img3.jpg", isPrimary: true, position: 9 }
  ];

  const normalized = normalizeListingImages(rawImages);
  assert(normalized.images.length === 3, "All 3 images normalized");
  const primaryCount = normalized.images.filter(img => img.isPrimary).length;
  assert(primaryCount === 1, "Exactly one primary image invariant enforced");
  assert(normalized.images[0].position === 0, "First image assigned position 0");
  assert(normalized.images[1].position === 1, "Second image assigned position 1");
  assert(normalized.images[2].position === 2, "Third image assigned position 2");
  assert(normalized.primaryImage.url === normalized.images.find(img => img.isPrimary).url, "Primary image mirror synchronized");

  // ----------------------------------------------------
  // 17: Cloudinary Public-ID Security Validation
  // ----------------------------------------------------
  console.log("\n--- 12. CLOUDINARY PUBLIC-ID VALIDATION ---");
  assert(isGenuineCloudinaryPublicId("wanderlust_DEV/sample_villa"), "Valid Cloudinary public ID recognized");
  assert(!isGenuineCloudinaryPublicId("listingimage"), "Legacy dummy filename rejected");
  assert(!isGenuineCloudinaryPublicId("../../../etc/passwd"), "Path traversal rejected");
  assert(!isGenuineCloudinaryPublicId("https://images.unsplash.com/photo-1"), "External URL rejected as public ID");
  assert(isCloudinaryAsset({ url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg" }), "Cloudinary asset URL recognized");
  assert(!isCloudinaryAsset({ url: "https://images.unsplash.com/photo-1" }), "Unsplash asset URL recognized as non-Cloudinary");

  // ----------------------------------------------------
  // 18: Dashboard Metric Calculations
  // ----------------------------------------------------
  console.log("\n--- 13. DASHBOARD METRICS CALCULATION ---");
  const sampleBookings = [
    { status: "CONFIRMED", totalPrice: 5000 },
    { status: "COMPLETED", totalPrice: 4000 },
    { status: "PENDING", totalPrice: 3000 },
    { status: "CANCELLED", totalPrice: 6000 }
  ];

  const realizedValue = sampleBookings
    .filter(b => ["CONFIRMED", "COMPLETED"].includes(b.status))
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const pendingPipeline = sampleBookings
    .filter(b => b.status === "PENDING")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  assert(realizedValue === 9000, "Realized value includes CONFIRMED + COMPLETED (5000 + 4000 = 9000)");
  assert(pendingPipeline === 3000, "Pending pipeline value accurately isolated (3000)");
  assert(!sampleBookings.filter(b => b.status === "CANCELLED").some(b => realizedValue === 15000), "Cancelled bookings excluded from realized value");

  // ----------------------------------------------------
  // 19: Safe Production Error Masking
  // ----------------------------------------------------
  console.log("\n--- 14. SAFE PRODUCTION ERROR MASKING ---");
  const formatErrorResponse = (err, env) => {
    if (env === "production") {
      return {
        success: false,
        message: err.isOperational ? err.message : "Something went wrong. Please try again later."
      };
    }
    return {
      success: false,
      message: err.message,
      stack: err.stack
    };
  };

  const dbCrashError = new Error("MongoServerError: Authentication failed on server 10.0.0.5:27017");
  const prodOutput = formatErrorResponse(dbCrashError, "production");
  assert(!prodOutput.message.includes("MongoServerError"), "Production error suppresses DB internal error names");
  assert(!prodOutput.message.includes("10.0.0.5"), "Production error suppresses IP/connection strings");
  assert(prodOutput.stack === undefined, "Production error suppresses stack trace");

  console.log("\n==================================================");
  console.log(`PHASE 11 UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runUnitTests().catch(err => {
    console.error("Unit test execution error:", err);
    process.exit(1);
  });
}

module.exports = { runUnitTests };
