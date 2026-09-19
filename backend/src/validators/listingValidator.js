const Joi = require("joi");

const listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    price: Joi.number().required().min(0),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    propertyType: Joi.string().valid(
      "Hostel", "Hotel", "Guest House", "Apartment", "Resort", "Homestay", "Villa", "Other",
      "HOSTEL", "HOTEL", "APARTMENT", "VILLA", "RESORT", "GUESTHOUSE", "HOMESTAY", "OTHER"
    ).optional(),
    category: Joi.string().optional(),
    amenities: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    image: Joi.string().allow("", null).optional(),
  }).required(),
});

module.exports = {
  listingSchema
};
