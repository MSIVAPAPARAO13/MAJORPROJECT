const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const {
  isLoggedIn,
  isOwner,
  validateListing,
  validateSearchQuery,
  requirePermission,
  requireTenantAccess
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const ExpressError = require("../utils/ExpressError");

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ExpressError("Invalid file type. Only JPEG, PNG, and WebP images are allowed.", 400), false);
    }
  }
});

// 1. Browse All Properties (PUBLIC) & Create New Property (Protected by PROPERTY_CREATE)
router
  .route("/")
  .get(validateSearchQuery, wrapAsync(listingController.index))
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

// ==========================================
// PHASE 7: IMAGE MANAGEMENT ROUTES
// NOTE: /:id/images/reorder MUST be registered BEFORE /:id/images/:imageId to prevent 'reorder' being parsed as :imageId
// ==========================================

// 7. Upload Additional Images (Protected by Tenant Isolation, RBAC IMAGE_UPLOAD, and Ownership)
router.post(
  "/:id/images",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_UPLOAD),
  isOwner,
  upload.array("images", 10),
  wrapAsync(listingController.uploadImages)
);

// 8. Reorder Images (CRITICAL: registered before /:imageId routes)
router.patch(
  "/:id/images/reorder",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_REORDER),
  isOwner,
  wrapAsync(listingController.reorderImages)
);

// 9. Set Primary Image (Protected by Tenant Isolation, RBAC IMAGE_SET_PRIMARY, and Ownership)
router.patch(
  "/:id/images/:imageId/primary",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_SET_PRIMARY),
  isOwner,
  wrapAsync(listingController.setPrimaryImage)
);

// 10. Delete Image (Protected by Tenant Isolation, RBAC IMAGE_DELETE, and Ownership)
router.delete(
  "/:id/images/:imageId",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_DELETE),
  isOwner,
  wrapAsync(listingController.deleteImage)
);

module.exports = router;