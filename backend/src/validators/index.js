const { listingSchema } = require("./listingValidator");
const { reviewSchema } = require("./reviewValidator");
const { userSchema } = require("./userValidator");
const { organizationSchema } = require("./organizationValidator");
const { roomSchema } = require("./roomValidator");
const { bookingSchema } = require("./bookingValidator");
const { searchQuerySchema } = require("./searchValidator");

module.exports = {
  listingSchema,
  reviewSchema,
  userSchema,
  organizationSchema,
  roomSchema,
  bookingSchema,
  searchQuerySchema
};
