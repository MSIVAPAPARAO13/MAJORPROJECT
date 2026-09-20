/**
 * PHASE 7 TEST SUITE — IMAGES + MAPS
 * WanderLust SaaS Property Management Platform
 * 
 * Verifies:
 * 1. Image normalization & single-primary invariant
 * 2. Cloudinary safety & publicId validation
 * 3. Media lifecycle: upload, delete, setPrimary, reorder
 * 4. Safe route ordering (/reorder cannot be captured as :imageId)
 * 5. RBAC & multi-tenant image authorization (Managers allowed in org, foreign denied)
 * 6. Mapbox geocoding: coordinates within range, fallback safety, no geocoding on reads
 * 7. Database integrity & baseline preservation
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

const imageService = require("../src/services/imageService");
const mapService = require("../src/services/mapService");
const listingService = require("../src/services/listingService");
const { PERMISSIONS, hasPermission } = require("../src/config/permissions");
const { isOwner } = require("../src/middleware/ownership");
const { requireTenantAccess } = require("../src/middleware/tenant");

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

async function runPhase7Tests() {
  console.log("==================================================");
  console.log("PHASE 7 IMAGES & MAPS TEST SUITE");
  console.log("==================================================\n");

  // -------------------------------------------------------------
  // 1. IMAGE NORMALIZATION & INVARIANTS
  // -------------------------------------------------------------
  console.log("--- 1. IMAGE NORMALIZATION & SINGLE PRIMARY INVARIANT ---");

  // Case A: Empty images array
  const emptyNorm = imageService.normalizeListingImages([]);
  assert(Array.isArray(emptyNorm.images) && emptyNorm.images.length === 0, "Empty images array normalizes to empty array");
  assert(emptyNorm.primaryImage === null, "Empty images array returns null primaryImage");

  // Case B: Multiple primaries present -> Keep only first
  const multiPrimaryInput = [
    { url: "https://example.com/1.jpg", filename: "img1", isPrimary: true, position: 0 },
    { url: "https://example.com/2.jpg", filename: "img2", isPrimary: true, position: 1 },
    { url: "https://example.com/3.jpg", filename: "img3", isPrimary: true, position: 2 }
  ];
  const multiNorm = imageService.normalizeListingImages(multiPrimaryInput);
  const primariesInMulti = multiNorm.images.filter(img => img.isPrimary);
  assert(primariesInMulti.length === 1, "Multiple primary images normalized to exactly 1 primary");
  assert(multiNorm.images[0].isPrimary === true && multiNorm.images[1].isPrimary === false && multiNorm.images[2].isPrimary === false, "First primary image preserved, subsequent primaries unset");
  assert(multiNorm.primaryImage && multiNorm.primaryImage.url === "https://example.com/1.jpg", "primaryImage mirror matches first primary");

  // Case C: No primary specified -> Select position 0 deterministically
  const noPrimaryInput = [
    { url: "https://example.com/a.jpg", filename: "imga", isPrimary: false, position: 0 },
    { url: "https://example.com/b.jpg", filename: "imgb", isPrimary: false, position: 1 }
  ];
  const noPrimaryNorm = imageService.normalizeListingImages(noPrimaryInput);
  assert(noPrimaryNorm.images[0].isPrimary === true, "When no primary is set, image at position 0 is deterministically selected as primary");
  assert(noPrimaryNorm.images[1].isPrimary === false, "Second image remains non-primary");
  assert(noPrimaryNorm.primaryImage.url === "https://example.com/a.jpg", "primaryImage mirror updated accurately");

  // Case D: Out-of-order positions normalized sequentially
  const unnormalizedPositions = [
    { url: "https://example.com/p10.jpg", filename: "p10", position: 10, isPrimary: false },
    { url: "https://example.com/p2.jpg", filename: "p2", position: 2, isPrimary: true },
    { url: "https://example.com/p5.jpg", filename: "p5", position: 5, isPrimary: false }
  ];
  const posNorm = imageService.normalizeListingImages(unnormalizedPositions);
  assert(posNorm.images[0].filename === "p2" && posNorm.images[0].position === 0, "Images sorted by position; first image gets position 0");
  assert(posNorm.images[1].filename === "p5" && posNorm.images[1].position === 1, "Second image gets position 1");
  assert(posNorm.images[2].filename === "p10" && posNorm.images[2].position === 2, "Third image gets position 2");
  assert(posNorm.images[0].isPrimary === true, "Original primary flag preserved on p2");

  // -------------------------------------------------------------
  // 2. CLOUDINARY PUBLIC ID & SAFE LIFECYCLE
  // -------------------------------------------------------------
  console.log("\n--- 2. CLOUDINARY SAFETY & PUBLIC ID VALIDATION ---");

  // Genuine Cloudinary Public ID check
  assert(imageService.isGenuineCloudinaryPublicId("wanderlust_DEV/sample_abc123") === true, "Valid Cloudinary publicId recognized");
  assert(imageService.isGenuineCloudinaryPublicId("listingimage") === false, "Legacy seed filename 'listingimage' rejected as genuine publicId");
  assert(imageService.isGenuineCloudinaryPublicId("default_fallback") === false, "Fallback dummy filename rejected as genuine publicId");
  assert(imageService.isGenuineCloudinaryPublicId("https://images.unsplash.com/photo-123") === false, "External URL rejected as genuine publicId");
  assert(imageService.isGenuineCloudinaryPublicId("../etc/passwd") === false, "Path traversal rejected as publicId");
  assert(imageService.isGenuineCloudinaryPublicId("") === false, "Empty string rejected as publicId");

  // Cloudinary asset detection
  const unsplashImage = {
    url: "https://images.unsplash.com/photo-552733407?auto=format",
    filename: "listingimage",
    publicId: ""
  };
  assert(imageService.isCloudinaryAsset(unsplashImage) === false, "Unsplash image correctly identified as NOT a Cloudinary asset");

  const cloudImage = {
    url: "https://res.cloudinary.com/wanderlust/image/upload/v12345/wanderlust_DEV/prop1.jpg",
    filename: "wanderlust_DEV/prop1",
    publicId: "wanderlust_DEV/prop1"
  };
  assert(imageService.isCloudinaryAsset(cloudImage) === true, "Cloudinary image correctly identified as Cloudinary asset");

  // Safe Cloudinary deletion: skips non-Cloudinary assets
  const deleteLegacyResult = await imageService.deleteCloudinaryAsset(unsplashImage);
  assert(deleteLegacyResult.skipped === true, "Safely skips Cloudinary destroy for legacy Unsplash asset (never deletes external data)");

  // Extract publicId from Cloudinary URL
  const extracted = imageService.extractPublicIdFromUrl("https://res.cloudinary.com/wanderlust/image/upload/v1710000000/wanderlust_DEV/test_villa.jpg");
  assert(extracted === "wanderlust_DEV/test_villa", `Public ID correctly extracted from Cloudinary URL: got '${extracted}'`);

  // Dynamic Thumbnail Generation
  const thumbUrl = imageService.getThumbnailUrl("https://res.cloudinary.com/demo/image/upload/sample.jpg", 300);
  assert(thumbUrl.includes("w_300,c_fill"), "Thumbnail URL includes width and crop parameters for Cloudinary");

  // -------------------------------------------------------------
  // 3. MAPBOX GEOCODING & COORDINATE BOUNDS
  // -------------------------------------------------------------
  console.log("\n--- 3. MAPBOX GEOCODING & COORDINATE BOUNDS ---");

  // Geocode location with valid query
  const geoResult = await mapService.geocodeLocation("Jaipur", "India");
  assert(geoResult.type === "Point", "Geocoding returns GeoJSON Point");
  assert(Array.isArray(geoResult.coordinates) && geoResult.coordinates.length === 2, "Geocoding returns [lng, lat] coordinate array");
  const [lng, lat] = geoResult.coordinates;
  assert(lng >= -180 && lng <= 180, `Longitude ${lng} within valid range [-180, 180]`);
  assert(lat >= -90 && lat <= 90, `Latitude ${lat} within valid range [-90, 90]`);

  // Fallback safety when location empty
  const fallbackGeo = await mapService.geocodeLocation("", "");
  assert(fallbackGeo.isFallback === true, "Empty location safely falls back to standard coordinates");
  assert(fallbackGeo.coordinates[0] === 77.2090 && fallbackGeo.coordinates[1] === 28.6139, "Standard fallback coordinates are New Delhi [77.2090, 28.6139]");

  // -------------------------------------------------------------
  // CONNECT TO DATABASE FOR SERVICE & INTEGRATION TESTS
  // -------------------------------------------------------------
  console.log("\n--- CONNECTING TO MONGODB FOR INTEGRATION TESTS ---");
  await mongoose.connect(MONGO_URL);

  const testOrg = await Organization.findOne({});
  assert(Boolean(testOrg), "Authoritative organization found in database");

  const orgOwner = await User.findOne({ organization: testOrg._id, role: "OWNER" });
  assert(Boolean(orgOwner), "Organization OWNER found in database");

  // Create memory representations for testing roles and tenant isolation
  const orgManager = {
    _id: new mongoose.Types.ObjectId(),
    username: "manager_user_test",
    role: "MANAGER",
    organization: testOrg._id
  };

  const orgStaff = {
    _id: new mongoose.Types.ObjectId(),
    username: "staff_user_test",
    role: "STAFF",
    organization: testOrg._id
  };

  const customerUser = {
    _id: new mongoose.Types.ObjectId(),
    username: "customer_user_test",
    role: "CUSTOMER",
    organization: testOrg._id
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    username: "admin_user_test",
    role: "ADMIN"
  };

  const foreignTenantOrgId = new mongoose.Types.ObjectId();
  const foreignManager = {
    _id: new mongoose.Types.ObjectId(),
    username: "foreign_manager_test",
    role: "MANAGER",
    organization: foreignTenantOrgId
  };

  // -------------------------------------------------------------
  // 4. PROPERTY IMAGE OPERATIONS (CRUD, PRIMARY, REORDER)
  // -------------------------------------------------------------
  console.log("\n--- 4. PROPERTY IMAGE OPERATIONS (CRUD, PRIMARY, REORDER) ---");

  // Create a temporary listing for image operations
  const testListingData = {
    title: "Phase 7 Image Suite Villa",
    description: "Property for validating multi-image gallery, primary invariants, and reordering.",
    price: 6500,
    location: "Udaipur",
    country: "India",
    propertyType: "Villa",
    category: "Trending",
    amenities: ["WiFi", "Swimming Pool"]
  };

  const initialFiles = [
    { path: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914", filename: "villa_main.jpg", originalname: "villa_main.jpg" },
    { path: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750", filename: "villa_pool.jpg", originalname: "villa_pool.jpg" }
  ];

  const createdListing = await listingService.createListing(testListingData, orgOwner, initialFiles);
  assert(createdListing.images.length === 2, `Listing created with 2 images (actual: ${createdListing.images.length})`);
  assert(createdListing.images[0].isPrimary === true, "First image is set as primary hero image");
  assert(createdListing.images[1].isPrimary === false, "Second image is not primary");
  assert(createdListing.image.url === createdListing.images[0].url, "Listing.image is synchronized with primary image");
  assert(createdListing.geometry.type === "Point", "Listing has GeoJSON Point geometry");

  // 4.1 Add additional images
  const additionalFiles = [
    { path: "https://images.unsplash.com/photo-1613490493576-7fde63acd811", filename: "villa_bedroom.jpg", originalname: "villa_bedroom.jpg" },
    { path: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c", filename: "villa_garden.jpg", originalname: "villa_garden.jpg" }
  ];

  const updatedWithMore = await listingService.addListingImages(createdListing._id, additionalFiles);
  assert(updatedWithMore.images.length === 4, `4 images present after addition (actual: ${updatedWithMore.images.length})`);
  assert(updatedWithMore.images[2].position === 2 && updatedWithMore.images[3].position === 3, "New images assigned sequential positions 2 and 3");
  const primaryCountAfterAdd = updatedWithMore.images.filter(img => img.isPrimary).length;
  assert(primaryCountAfterAdd === 1, "Single primary invariant maintained after adding images");

  // 4.2 Set a new primary image
  const targetNewPrimaryId = updatedWithMore.images[2]._id;
  const targetNewPrimaryUrl = updatedWithMore.images[2].url;
  const afterSetPrimary = await listingService.setPrimaryImage(createdListing._id, targetNewPrimaryId);
  const newPrimaryImg = afterSetPrimary.images.find(img => img._id.toString() === targetNewPrimaryId.toString());
  assert(newPrimaryImg.isPrimary === true, "Target image successfully set as primary");
  assert(afterSetPrimary.images.filter(img => img.isPrimary).length === 1, "Exactly one primary image exists after primary switch");
  assert(afterSetPrimary.image.url === targetNewPrimaryUrl, "Listing.image mirror updated to new primary URL");

  // 4.3 Reorder images
  // Desired order: [img3, img0, img2, img1]
  const desiredOrder = [
    afterSetPrimary.images[3]._id.toString(),
    afterSetPrimary.images[0]._id.toString(),
    afterSetPrimary.images[2]._id.toString(),
    afterSetPrimary.images[1]._id.toString()
  ];
  const afterReorder = await listingService.reorderListingImages(createdListing._id, desiredOrder);
  assert(afterReorder.images[0]._id.toString() === desiredOrder[0], "First image matches desired reorder sequence");
  assert(afterReorder.images[1]._id.toString() === desiredOrder[1], "Second image matches desired reorder sequence");
  assert(afterReorder.images[2]._id.toString() === desiredOrder[2], "Third image matches desired reorder sequence");
  assert(afterReorder.images[3]._id.toString() === desiredOrder[3], "Fourth image matches desired reorder sequence");
  assert(afterReorder.images[0].position === 0 && afterReorder.images[1].position === 1 && afterReorder.images[2].position === 2 && afterReorder.images[3].position === 3, "All positions normalized sequentially 0..3 after reorder");

  // 4.4 Delete an image (specifically delete the primary image to test automatic promotion)
  const currentPrimary = afterReorder.images.find(img => img.isPrimary);
  const primaryToDeleteId = currentPrimary._id;
  const deleteResult = await listingService.deleteListingImage(createdListing._id, primaryToDeleteId);
  assert(deleteResult.listing.images.length === 3, "Image count reduced to 3 after deletion");
  assert(deleteResult.listing.images.every(img => img._id.toString() !== primaryToDeleteId.toString()), "Deleted image removed from images array");
  const primaryCountAfterDelete = deleteResult.listing.images.filter(img => img.isPrimary).length;
  assert(primaryCountAfterDelete === 1, "Auto-promoted new primary: exactly 1 primary exists after deleting previous primary");
  assert(deleteResult.listing.images[0].isPrimary === true, "First remaining image at position 0 is automatically promoted to primary");
  assert(deleteResult.listing.image.url === deleteResult.listing.images[0].url, "Listing.image mirror synchronized with newly promoted primary");

  // -------------------------------------------------------------
  // 5. ROUTE ORDERING & SECURITY VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- 5. ROUTE ORDER & SECURITY ---");

  // Verify route definitions in Express router
  const listingRouter = require("../src/routes/listing");
  const routes = [];
  listingRouter.stack.forEach((layer) => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods).map(m => m.toUpperCase())
      });
    }
  });

  const reorderRouteIndex = routes.findIndex(r => r.path === "/:id/images/reorder");
  const primaryRouteIndex = routes.findIndex(r => r.path === "/:id/images/:imageId/primary");
  const deleteImageRouteIndex = routes.findIndex(r => r.path === "/:id/images/:imageId");

  assert(reorderRouteIndex !== -1, "PATCH /:id/images/reorder route is registered");
  assert(primaryRouteIndex !== -1, "PATCH /:id/images/:imageId/primary route is registered");
  assert(deleteImageRouteIndex !== -1, "DELETE /:id/images/:imageId route is registered");
  assert(reorderRouteIndex < primaryRouteIndex, "CRITICAL: /:id/images/reorder is registered BEFORE /:id/images/:imageId/primary");
  assert(reorderRouteIndex < deleteImageRouteIndex, "CRITICAL: /:id/images/reorder is registered BEFORE /:id/images/:imageId");

  // -------------------------------------------------------------
  // 6. RBAC & TENANT AUTHORIZATION FOR IMAGES
  // -------------------------------------------------------------
  console.log("\n--- 6. RBAC & TENANT AUTHORIZATION FOR IMAGES ---");

  // RBAC Permission checks
  assert(hasPermission(customerUser, PERMISSIONS.IMAGE_VIEW) === true, "CUSTOMER has IMAGE_VIEW permission");
  assert(hasPermission(customerUser, PERMISSIONS.IMAGE_UPLOAD) === false, "CUSTOMER denied IMAGE_UPLOAD permission");
  assert(hasPermission(customerUser, PERMISSIONS.IMAGE_DELETE) === false, "CUSTOMER denied IMAGE_DELETE permission");

  assert(hasPermission(orgStaff, PERMISSIONS.IMAGE_UPLOAD) === true, "STAFF has IMAGE_UPLOAD permission");
  assert(hasPermission(orgStaff, PERMISSIONS.IMAGE_DELETE) === false, "STAFF denied IMAGE_DELETE permission");
  assert(hasPermission(orgStaff, PERMISSIONS.IMAGE_REORDER) === false, "STAFF denied IMAGE_REORDER permission");

  assert(hasPermission(orgManager, PERMISSIONS.IMAGE_UPLOAD) === true, "MANAGER has IMAGE_UPLOAD permission");
  assert(hasPermission(orgManager, PERMISSIONS.IMAGE_DELETE) === true, "MANAGER has IMAGE_DELETE permission");
  assert(hasPermission(orgManager, PERMISSIONS.IMAGE_REORDER) === true, "MANAGER has IMAGE_REORDER permission");
  assert(hasPermission(orgManager, PERMISSIONS.IMAGE_SET_PRIMARY) === true, "MANAGER has IMAGE_SET_PRIMARY permission");

  assert(hasPermission(orgOwner, PERMISSIONS.IMAGE_UPLOAD) === true, "OWNER has IMAGE_UPLOAD permission");
  assert(hasPermission(orgOwner, PERMISSIONS.IMAGE_DELETE) === true, "OWNER has IMAGE_DELETE permission");

  assert(hasPermission(adminUser, PERMISSIONS.IMAGE_UPLOAD) === true, "ADMIN has IMAGE_UPLOAD permission");
  assert(hasPermission(adminUser, PERMISSIONS.IMAGE_DELETE) === true, "ADMIN has IMAGE_DELETE permission");

  // Middleware authorization runner helper
  function runMiddleware(middleware, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          resolve({ status: this.statusCode, body: data, passed: false });
        },
        redirect(url) {
          this.redirectUrl = url;
          resolve({ status: this.statusCode, redirectUrl: url, passed: false });
        }
      };
      const next = () => resolve({ status: 200, passed: true });
      middleware(req, res, next).catch((err) => resolve({ status: 500, error: err, passed: false }));
    });
  }

  // 6.1 Org Manager managing image of listing in same organization -> ALLOWED
  const reqManagerSameOrg = {
    params: { id: createdListing._id.toString() },
    user: orgManager,
    headers: { accept: "application/json" },
    originalUrl: `/api/listings/${createdListing._id}/images`
  };
  const managerResult = await runMiddleware(isOwner, reqManagerSameOrg);
  assert(managerResult.passed === true, "MANAGER in property organization is authorized via isOwner");

  // 6.2 Foreign Manager attempting to access listing in different organization -> DENIED (403)
  const reqForeignManager = {
    params: { id: createdListing._id.toString() },
    user: foreignManager,
    headers: { accept: "application/json" },
    originalUrl: `/api/listings/${createdListing._id}/images`,
    isAuthenticated: () => true
  };
  const foreignTenantMiddleware = requireTenantAccess("Listing");
  const foreignTenantResult = await runMiddleware(foreignTenantMiddleware, reqForeignManager);
  assert(foreignTenantResult.status === 403, "Foreign tenant manager blocked by requireTenantAccess with 403 Forbidden");

  // 6.3 Customer attempting to modify property images -> DENIED (403)
  const reqCustomer = {
    params: { id: createdListing._id.toString() },
    user: customerUser,
    headers: { accept: "application/json" },
    originalUrl: `/api/listings/${createdListing._id}/images`
  };
  const customerResult = await runMiddleware(isOwner, reqCustomer);
  assert(customerResult.status === 403, "CUSTOMER denied property image modification with 403 Forbidden");

  // 6.4 Admin accessing property across tenants -> ALLOWED
  const reqAdmin = {
    params: { id: createdListing._id.toString() },
    user: adminUser,
    headers: { accept: "application/json" },
    originalUrl: `/api/listings/${createdListing._id}/images`
  };
  const adminResult = await runMiddleware(isOwner, reqAdmin);
  assert(adminResult.passed === true, "ADMIN system-wide management authorized via isOwner");

  // -------------------------------------------------------------
  // 7. RULE 8: NO GEOCODING DURING READS / SEARCHES
  // -------------------------------------------------------------
  console.log("\n--- 7. RULE 8: ZERO GEOCODING ON READ / SEARCH ---");
  let geocodeCallCount = 0;
  const originalGeocode = mapService.geocodeLocation;
  mapService.geocodeLocation = async (...args) => {
    geocodeCallCount++;
    return originalGeocode(...args);
  };

  // Perform search / read
  await listingService.getAllListings({ q: "Udaipur" });
  await listingService.getListingById(createdListing._id);

  assert(geocodeCallCount === 0, `Zero geocoding calls made during reads and searches (actual calls: ${geocodeCallCount})`);
  // Restore original geocode
  mapService.geocodeLocation = originalGeocode;

  // -------------------------------------------------------------
  // 8. CLEANUP & DATABASE PRESERVATION ASSERTIONS
  // -------------------------------------------------------------
  console.log("\n--- 8. CLEAN-UP & DATABASE PRESERVATION CHECKS ---");

  // Delete test listing
  await listingService.destroyListing(createdListing._id);

  const finalListingCount = await Listing.countDocuments();
  const finalRoomCount = await Room.countDocuments();
  const finalUserCount = await User.countDocuments();
  const finalOrgCount = await Organization.countDocuments();
  const finalReviewCount = await Review.countDocuments();
  const finalBookingCount = await Booking.countDocuments();

  assert(finalListingCount === 65, `Listing collection preserved at exactly 65 (actual: ${finalListingCount})`);
  assert(finalRoomCount === 134, `Room collection preserved at exactly 134 (actual: ${finalRoomCount})`);
  assert(finalUserCount === 6, `User collection preserved at exactly 6 (actual: ${finalUserCount})`);
  assert(finalOrgCount === 1, `Organization collection preserved at exactly 1 (actual: ${finalOrgCount})`);
  assert(finalReviewCount === 4, `Review collection preserved at exactly 4 (actual: ${finalReviewCount})`);
  assert(finalBookingCount === 0, `Booking collection preserved at exactly 0 (actual: ${finalBookingCount})`);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");

  console.log("\n==================================================");
  console.log(`PHASE 7 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase7Tests().catch((err) => {
  console.error("FATAL ERROR in Phase 7 test runner:", err);
  process.exit(1);
});
