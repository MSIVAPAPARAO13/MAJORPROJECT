const {
  listingSchema,
  reviewSchema,
  organizationSchema,
  roomSchema,
  bookingSchema
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

// Room Validation Middleware
const validateRoom = (req, res, next) => {
  const payload = req.body.room ? { room: req.body.room } : req.body;
  const { error, value } = roomSchema.validate(payload, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  // Strip sensitive client-supplied fields and normalize
  req.validatedRoom = value.room || value;
  next();
};

// Booking Validation Middleware
const validateBooking = (req, res, next) => {
  const payload = req.body.booking ? { booking: req.body.booking } : req.body;
  const { error, value } = bookingSchema.validate(payload, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  }
  req.validatedBooking = value.booking || value;
  next();
};

module.exports = {
  validateListing,
  validateReview,
  validateOrganization,
  validateRoom,
  validateBooking
};
