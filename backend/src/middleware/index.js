const { isLoggedIn, saveRedirectUrl } = require("./auth");
const { isOwner, isReviewAuthor } = require("./ownership");
const {
  validateListing,
  validateReview,
  validateOrganization,
  validateRoom,
  validateBooking,
  validateSearchQuery,
  validateDashboardFilters
} = require("./validation");
const { requireRole, requirePermission } = require("./authorization");
const { requireTenantAccess } = require("./tenant");
const { validateRoomBelongsToListing } = require("./roomAuth");
const { canAccessBooking, canCancelBooking } = require("./bookingAuth");

module.exports = {
  isLoggedIn,
  saveRedirectUrl,
  isOwner,
  isReviewAuthor,
  validateListing,
  validateReview,
  validateOrganization,
  validateRoom,
  validateBooking,
  validateSearchQuery,
  validateDashboardFilters,
  requireRole,
  requirePermission,
  requireTenantAccess,
  validateRoomBelongsToListing,
  canAccessBooking,
  canCancelBooking
};
