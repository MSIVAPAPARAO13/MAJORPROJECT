const Listing = require("../models/listing");
const Review = require("../models/review");

// Listing Ownership Middleware
const isOwner = async (req, res, next) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    if (req.accepts("json") && req.xhr) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  // Check if current user is the direct owner or an authorized administrator
  const isDirectOwner = listing.owner && listing.owner.equals(req.user._id);
  const isAdmin = req.user && req.user.role === "ADMIN";

  if (!isDirectOwner && !isAdmin) {
    if (req.accepts("json") && req.xhr) {
      return res.status(403).json({ success: false, message: "Unauthorized to modify property" });
    }
    req.flash("error", "You do not have permission to modify this property");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

// Review Author Middleware
const isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review) {
    if (req.accepts("json") && req.xhr) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    req.flash("error", "Review not found");
    return res.redirect(`/listings/${id}`);
  }

  const isAuthor = review.author && review.author.equals(req.user._id);
  const isAdmin = req.user && req.user.role === "ADMIN";

  if (!isAuthor && !isAdmin) {
    if (req.accepts("json") && req.xhr) {
      return res.status(403).json({ success: false, message: "Not the author of this review" });
    }
    req.flash("error", "You are not the author of this review");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports = {
  isOwner,
  isReviewAuthor
};
