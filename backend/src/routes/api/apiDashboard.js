const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const {
  isLoggedIn,
  requirePermission,
  validateDashboardFilters
} = require("../../middleware");
const { PERMISSIONS } = require("../../config/permissions");
const dashboardController = require("../../controllers/dashboardController");

// GET /api/dashboard - Canonical REST analytics endpoint (Role-aware, Tenant-isolated)
router.get(
  "/",
  isLoggedIn,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// GET /api/dashboard/metrics - Backward-compatible endpoint
router.get(
  "/metrics",
  isLoggedIn,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

module.exports = router;
