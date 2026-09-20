const Joi = require("joi");

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().max(100).allow("").optional(),
  location: Joi.string().trim().max(100).allow("").optional(),
  propertyType: Joi.string().valid(
    "HOTEL", "HOSTEL", "APARTMENT", "VILLA", "RESORT", "GUESTHOUSE", "HOMESTAY", "OTHER",
    "Hostel", "Hotel", "Guest House", "Apartment", "Resort", "Homestay", "Villa", "Other"
  ).optional(),
  category: Joi.string().trim().max(50).allow("").optional(),
  roomType: Joi.string().valid(
    "Single", "Double", "Triple", "Dormitory", "Deluxe", "Suite"
  ).optional(),
  guests: Joi.number().integer().min(1).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  checkIn: Joi.date().iso().optional(),
  checkOut: Joi.date().iso().optional(),
  amenities: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional(),
  sort: Joi.string().valid(
    "price_asc", "price_desc", "newest", "oldest", "title_asc", "title_desc"
  ).default("newest"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(12)
})
.custom((value, helpers) => {
  // Enforce minPrice <= maxPrice
  if (value.minPrice !== undefined && value.maxPrice !== undefined) {
    if (value.minPrice > value.maxPrice) {
      return helpers.message("minPrice cannot be greater than maxPrice");
    }
  }

  // Enforce both dates if one is supplied, and checkOut > checkIn
  const hasCheckIn = Boolean(value.checkIn);
  const hasCheckOut = Boolean(value.checkOut);

  if (hasCheckIn && !hasCheckOut) {
    return helpers.message("checkOut date is required when checkIn date is provided");
  }
  if (hasCheckOut && !hasCheckIn) {
    return helpers.message("checkIn date is required when checkOut date is provided");
  }

  if (hasCheckIn && hasCheckOut) {
    const checkInTime = new Date(value.checkIn).getTime();
    const checkOutTime = new Date(value.checkOut).getTime();
    if (checkOutTime <= checkInTime) {
      return helpers.message("checkOut date must be strictly after checkIn date");
    }
  }

  return value;
});

module.exports = {
  searchQuerySchema
};
