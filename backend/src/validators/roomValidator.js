const Joi = require("joi");

const roomInnerSchema = Joi.object({
  roomNumber: Joi.string().trim().min(1).max(50).required(),
  roomType: Joi.string().valid("Single", "Double", "Triple", "Dormitory", "Deluxe", "Suite").default("Deluxe"),
  capacity: Joi.number().integer().min(1).max(100).required(),
  price: Joi.number().min(0).required(),
  amenities: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional().default([]),
  status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE").default("AVAILABLE"),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().optional(),
      filename: Joi.string().optional()
    })
  ).optional()
}).unknown(false); // Forbid sensitive/unknown fields like property, listing, organization, tenant

// Allow both wrapped ({ room: { ... } }) and unwrapped payloads
const roomSchema = Joi.alternatives().try(
  Joi.object({
    room: roomInnerSchema.required()
  }),
  roomInnerSchema
);

module.exports = {
  roomSchema,
  roomInnerSchema
};
