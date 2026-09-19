const Joi = require("joi");

const organizationSchema = Joi.object({
  organization: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow("", null).optional(),
    contactEmail: Joi.string().email().allow("", null).optional(),
    phone: Joi.string().allow("", null).optional(),
    address: Joi.string().allow("", null).optional()
  }).required()
});

module.exports = {
  organizationSchema
};
