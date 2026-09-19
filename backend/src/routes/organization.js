const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  validateOrganization,
  requirePermission,
  requireTenantAccess
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const organizationController = require("../controllers/organizationController");

// Organization Creation: Restricted to ADMIN only (Requirement 2)
router.get(
  "/new",
  isLoggedIn,
  requirePermission(PERMISSIONS.ORGANIZATION_CREATE),
  organizationController.renderNewForm
);

router.post(
  "/",
  isLoggedIn,
  requirePermission(PERMISSIONS.ORGANIZATION_CREATE),
  validateOrganization,
  wrapAsync(organizationController.createOrganization)
);

// Organization View / Management: Protected by Tenant Isolation & Permission
router.get(
  "/:orgId",
  isLoggedIn,
  requireTenantAccess("Organization", "orgId"),
  requirePermission(PERMISSIONS.ORGANIZATION_VIEW),
  wrapAsync(organizationController.showOrganization)
);

module.exports = router;
