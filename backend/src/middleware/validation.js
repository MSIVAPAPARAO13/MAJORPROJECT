const {
  listingSchema,
  reviewSchema,
  organizationSchema
} = require("../validators/schema");
const ExpressError = require("../utils/ExpressError");

// Listing Validation Middleware
const validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

// Review Validation Middleware
const validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

// Organization Validation Middleware
const validateOrganization = (req, res, next) => {
  const { error } = organizationSchema.validate(req.body);
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  next();
};

// Passthrough compatibility middleware for pre-existing room and booking routes
const validateRoom = (req, res, next) => next();
const validateBooking = (req, res, next) => next();

module.exports = {
  validateListing,
  validateReview,
  validateOrganization,
  validateRoom,
  validateBooking
};
