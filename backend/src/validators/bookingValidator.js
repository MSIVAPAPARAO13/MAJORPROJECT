const Joi = require("joi");

const bookingInnerSchema = Joi.object({
  checkIn: Joi.date().iso().required(),
  checkOut: Joi.date().iso().greater(Joi.ref("checkIn")).required().messages({
    "date.greater": "Check-out date must be strictly after check-in date"
  }),
  guestsCount: Joi.number().integer().min(1).max(100).required(),
  roomId: Joi.string().hex().length(24).optional(),
  propertyId: Joi.string().hex().length(24).optional(),
  guestDetails: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    email: Joi.string().trim().email().required(),
    phone: Joi.string().trim().min(7).max(20).required()
  }).optional(),
  // Also accept flat guest fields commonly sent by forms
  guestName: Joi.string().trim().min(1).max(100).optional(),
  guestEmail: Joi.string().trim().email().optional(),
  guestPhone: Joi.string().trim().min(7).max(20).optional(),
  specialRequests: Joi.string().trim().max(500).allow("").optional()
}).unknown(false); // Strictly reject unknown sensitive fields like totalPrice, status, organization, guest

const bookingSchema = Joi.alternatives().try(
  Joi.object({
    booking: bookingInnerSchema.required()
  }),
  bookingInnerSchema
);

module.exports = {
  bookingSchema,
  bookingInnerSchema
};
