const express = require("express");
const router = express.Router();
const listingService = require("../../services/listingService");
const reviewService = require("../../services/reviewService");
const wrapAsync = require("../../utils/wrapAsync");

// GET /api/listings - Retrieve all properties with search & category filters
router.get(
  "/",
  wrapAsync(async (req, res) => {
    const listings = await listingService.getAllListings(req.query);
    res.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  })
);

// GET /api/listings/:id - Retrieve single listing with populated relations
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

// POST /api/listings/:id/reviews - Submit review
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

// DELETE /api/listings/:id/reviews/:reviewId - Remove review
router.delete(
  "/:id/reviews/:reviewId",
  wrapAsync(async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: "Please log in to delete a review" });
    }
    const { id, reviewId } = req.params;
    await reviewService.deleteReview(id, reviewId);
    res.json({
      success: true,
      message: "Review deleted successfully!",
    });
  })
);

module.exports = router;
