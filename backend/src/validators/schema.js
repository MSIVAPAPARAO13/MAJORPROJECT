const Joi = require('joi');

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    price: Joi.number().required().min(0),
    description: Joi.string().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
    propertyType: Joi.string().valid("Hostel", "Hotel", "Guest House", "Apartment", "Resort", "Homestay").optional(),
    category: Joi.string().optional(),
    amenities: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    image: Joi.string().allow("", null).optional(),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});

module.exports.roomSchema = Joi.object({
  room: Joi.object({
    roomNumber: Joi.string().required(),
    roomType: Joi.string().valid("Single", "Double", "Triple", "Dormitory", "Deluxe", "Suite").required(),
    capacity: Joi.number().required().min(1),
    price: Joi.number().required().min(0),
    amenities: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE").optional()
  }).required()
});

module.exports.bookingSchema = Joi.object({
  booking: Joi.object({
    roomId: Joi.string().required(),
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref('checkIn')).required(),
    guestsCount: Joi.number().required().min(1),
    guestName: Joi.string().required(),
    guestEmail: Joi.string().email().required(),
    guestPhone: Joi.string().required(),
    specialRequests: Joi.string().allow("", null).optional()
  }).required()
});

module.exports.organizationSchema = Joi.object({
  organization: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow("", null).optional(),
    contactEmail: Joi.string().email().allow("", null).optional(),
    phone: Joi.string().allow("", null).optional(),
    address: Joi.string().allow("", null).optional()
  }).required()
});
