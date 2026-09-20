const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  requirePermission,
  validateDashboardFilters
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const dashboardController = require("../controllers/dashboardController");

// Canonical Dashboard Route (Role-aware, Tenant-isolated, RBAC-protected)
router.get(
  "/",
  isLoggedIn,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

module.exports = router;
