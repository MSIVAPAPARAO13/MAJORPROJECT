const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const {
  isLoggedIn,
  isOwner,
  validateListing,
  requirePermission,
  requireTenantAccess
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// 1. Browse All Properties (PUBLIC) & Create New Property (Protected by PROPERTY_CREATE)
router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    requirePermission(PERMISSIONS.PROPERTY_CREATE),
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// 2. New Property Form (Protected by PROPERTY_CREATE; CUSTOMER is denied)
router.get(
  "/new",
  isLoggedIn,
  requirePermission(PERMISSIONS.PROPERTY_CREATE),
  listingController.renderNewForm
);

// 3. Show Listing (PUBLIC)
router.get("/:id", wrapAsync(listingController.showListing));

// 4. Update Listing (Protected by Tenant Isolation, RBAC Permission, and Ownership)
router.put(
  "/:id",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.PROPERTY_UPDATE),
  isOwner,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(listingController.updateListing)
);

// 5. Delete Listing (Protected by Tenant Isolation, RBAC Permission, and Ownership)
router.delete(
  "/:id",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.PROPERTY_DELETE),
  isOwner,
  wrapAsync(listingController.destroyListing)
);

// 6. Edit Property Form (Protected by Tenant Isolation, RBAC Permission, and Ownership)
router.get(
  "/:id/edit",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.PROPERTY_UPDATE),
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

module.exports = router;