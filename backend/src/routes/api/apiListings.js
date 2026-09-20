const express = require("express");
const router = express.Router();
const listingService = require("../../services/listingService");
const reviewService = require("../../services/reviewService");
const Review = require("../../models/review");
const {
  validateSearchQuery,
  isLoggedIn,
  isOwner,
  requirePermission,
  requireTenantAccess
} = require("../../middleware");
const { PERMISSIONS } = require("../../config/permissions");
const listingController = require("../../controllers/listings");
const multer = require("multer");
const { storage } = require("../../cloudConfig");
const upload = multer({ storage });
const wrapAsync = require("../../utils/wrapAsync");

// GET /api/listings - Retrieve all properties with search, filter, and pagination (PUBLIC)
router.get(
  "/",
  validateSearchQuery,
  wrapAsync(async (req, res) => {
    const query = req.validatedQuery || req.query;
    const listings = await listingService.getAllListings(query);
    const pagination = listings.pagination || {
      page: 1,
      limit: 12,
      total: listings.length,
      pages: Math.ceil(listings.length / 12)
    };
    res.json({
      success: true,
      count: listings.length,
      data: listings,
      pagination
    });
  })
);

// GET /api/listings/:id - Retrieve single listing (PUBLIC)
router.get(
  "/:id",
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await listingService.getListingById(id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    res.json({
      success: true,
      data: listing,
    });
  })
);

// POST /api/listings/:id/reviews - Submit review (Authenticated users)
router.post(
  "/:id/reviews",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to submit a review" });
    }
    const { id } = req.params;
    const review = await reviewService.addReview(id, req.body.review, req.user._id);
    res.status(201).json({
      success: true,
      message: "Review added successfully!",
      data: review,
    });
  })
);

// DELETE /api/listings/:id/reviews/:reviewId - Remove review (Author or Admin only)
router.delete(
  "/:id/reviews/:reviewId",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to delete a review" });
    }
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    const isAuthor = review.author && review.author.equals(req.user._id);
    const isAdmin = req.user && req.user.role === "ADMIN";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this review" });
    }

    await reviewService.deleteReview(id, reviewId);
    res.json({
      success: true,
      message: "Review deleted successfully!",
    });
  })
);

// ==========================================
// PHASE 7: IMAGE MANAGEMENT REST ENDPOINTS
// NOTE: /:id/images/reorder MUST be registered BEFORE /:id/images/:imageId
// ==========================================

// POST /api/listings/:id/images - Upload images
router.post(
  "/:id/images",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_UPLOAD),
  isOwner,
  upload.array("images", 10),
  wrapAsync(listingController.uploadImages)
);

// PATCH /api/listings/:id/images/reorder - Reorder images
router.patch(
  "/:id/images/reorder",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_REORDER),
  isOwner,
  wrapAsync(listingController.reorderImages)
);

// PATCH /api/listings/:id/images/:imageId/primary - Set primary
router.patch(
  "/:id/images/:imageId/primary",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_SET_PRIMARY),
  isOwner,
  wrapAsync(listingController.setPrimaryImage)
);

// DELETE /api/listings/:id/images/:imageId - Delete image
router.delete(
  "/:id/images/:imageId",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.IMAGE_DELETE),
  isOwner,
  wrapAsync(listingController.deleteImage)
);

module.exports = router;
