const Listing = require("../models/listing");
const Review = require("../models/review");

function isJsonRequest(req) {
  return (
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    Boolean(req.headers.accept && req.headers.accept.includes("application/json")) ||
    Boolean(req.headers["content-type"] && req.headers["content-type"].includes("application/json"))
  );
}

// Listing Ownership Middleware
const isOwner = async (req, res, next) => {
  const { id } = req.params;
  
  // Use pre-loaded resource from tenant middleware if available
  const listing = req.tenantResource || (await Listing.findById(id));
  if (!listing) {
    if (isJsonRequest(req)) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  // Requirement 5 & 6: Resource ownership check separate from tenant and RBAC
  // - Direct listing creator
  // - OWNER: full management of listings in own organization
  // - MANAGER: management of listings in own organization
  // - ADMIN: system-wide management
  const isDirectOwner = listing.owner && req.user && listing.owner.equals(req.user._id);
  const isOrgOwner = req.user && req.user.role === "OWNER" && listing.organization && req.user.organization && listing.organization.equals(req.user.organization);
  const isOrgManager = req.user && req.user.role === "MANAGER" && listing.organization && req.user.organization && listing.organization.equals(req.user.organization);
  const isAdmin = req.user && req.user.role === "ADMIN";

  if (!isDirectOwner && !isOrgOwner && !isOrgManager && !isAdmin) {
    if (isJsonRequest(req)) {
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
    if (isJsonRequest(req)) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    req.flash("error", "Review not found");
    return res.redirect(`/listings/${id}`);
  }

  const isAuthor = review.author && req.user && review.author.equals(req.user._id);
  const isAdmin = req.user && req.user.role === "ADMIN";

  if (!isAuthor && !isAdmin) {
    if (isJsonRequest(req)) {
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
