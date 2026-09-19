const Joi = require("joi");

const userSchema = Joi.object({
  username: Joi.string().trim().required(),
  email: Joi.string().email().trim().required(),
  password: Joi.string().required(),
  role: Joi.string().valid("CUSTOMER", "OWNER").optional(),
  phone: Joi.string().allow("", null).optional()
});

module.exports = {
  userSchema
};
