const Listing = require("../models/listing");
const Review = require("../models/review");
const Room = require("../models/room");
const {
  listingSchema,
  reviewSchema,
  roomSchema,
  bookingSchema,
  organizationSchema,
} = require("../validators/schema");
const ExpressError = require("../utils/ExpressError");

// 1. Authentication Middleware
const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    if (req.accepts("json") && req.xhr) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    req.flash("error", "You must be logged in to access that page");
    return res.redirect("/login");
  }
  next();
};

const saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

// 2. Ownership & RBAC Middleware
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

  if (req.user && req.user.role === "ADMIN") {
    return next();
  }

  const isDirectOwner = listing.owner && listing.owner.equals(req.user._id);
  const isOrgMember =
    listing.organization &&
    req.user.organization &&
    listing.organization.equals(req.user.organization);

  if (!isDirectOwner && !isOrgMember) {
    if (req.accepts("json") && req.xhr) {
      return res.status(403).json({ success: false, message: "Unauthorized to modify property" });
    }
    req.flash("error", "You do not have permission to modify this property");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

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

  if (req.user && req.user.role === "ADMIN") {
    return next();
  }

  if (!review.author.equals(req.user._id)) {
    if (req.accepts("json") && req.xhr) {
      return res.status(403).json({ success: false, message: "Not the author of this review" });
    }
    req.flash("error", "You are not the author of this review");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.session.redirectUrl = req.originalUrl;
      if (req.accepts("json") && req.xhr) {
        return res.status(401).json({ success: false, message: "Please log in first" });
      }
      req.flash("error", "Please log in first");
      return res.redirect("/login");
    }

    if (!roles.includes(req.user.role) && req.user.role !== "ADMIN") {
      if (req.accepts("json") && req.xhr) {
        return res.status(403).json({ success: false, message: `Forbidden: requires ${roles.join(" or ")}` });
      }
      req.flash("error", `Access forbidden: requires ${roles.join(" or ")} role`);
      return res.redirect("/listings");
    }
    next();
  };
};

const isTenantAuthorized = async (req, res, next) => {
  if (req.user && req.user.role === "ADMIN") {
    return next();
  }

  const { id, roomId } = req.params;
  let resourceOrg = null;

  if (roomId) {
    const room = await Room.findById(roomId).populate("property");
    if (room && room.property) {
      resourceOrg = room.property.organization;
    }
  } else if (id) {
    const property = await Listing.findById(id);
    if (property) {
      resourceOrg = property.organization;
    }
  }

  if (resourceOrg && req.user.organization && !resourceOrg.equals(req.user.organization)) {
    if (req.accepts("json") && req.xhr) {
      return res.status(403).json({ success: false, message: "Tenant isolation breach" });
    }
    req.flash("error", "Tenant isolation: You cannot access data outside your organization");
    return res.redirect("/listings");
  }

  next();
};

// 3. Joi Validation Middleware
const validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

const validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

const validateRoom = (req, res, next) => {
  const { error } = roomSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

const validateBooking = (req, res, next) => {
  const { error } = bookingSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

const validateOrganization = (req, res, next) => {
  const { error } = organizationSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

module.exports = {
  isLoggedIn,
  saveRedirectUrl,
  isOwner,
  isReviewAuthor,
  hasRole,
  isTenantAuthorized,
  validateListing,
  validateReview,
  validateRoom,
  validateBooking,
  validateOrganization,
};
