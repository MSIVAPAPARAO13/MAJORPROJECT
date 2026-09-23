const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  requirePermission,
  requireTenantAccess,
  validateRoomBelongsToListing
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const serviceIssueController = require("../controllers/serviceIssueController");

// 1. List all issues for a room (Protected: STAFF, MANAGER, OWNER, ADMIN)
router.get(
  "/",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_VIEW),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.listRoomIssues)
);

// 2. Render form to report new issue
router.get(
  "/new",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_CREATE),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.renderNewIssueForm)
);

// 3. Create new service issue
router.post(
  "/",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_CREATE),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.createIssue)
);

// 4. View single service issue
router.get(
  "/:issueId",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_VIEW),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.showIssue)
);

// 5. Update service issue (status/priority/notes)
router.put(
  "/:issueId",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_UPDATE),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.updateIssue)
);

// 6. Direct Resolve action
router.post(
  "/:issueId/resolve",
  isLoggedIn,
  requirePermission(PERMISSIONS.ISSUE_RESOLVE),
  validateRoomBelongsToListing,
  wrapAsync(serviceIssueController.resolveIssue)
);

module.exports = router;
