const express = require("express");
const router = express.Router();
const listingService = require("../../services/listingService");
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

module.exports = router;
