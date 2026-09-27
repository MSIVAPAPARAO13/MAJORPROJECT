const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const { isLoggedIn, requireRole, validateDashboardFilters } = require("../../middleware");
const dashboardController = require("../../controllers/dashboardController");

// Thin Role Dashboard REST APIs (/api/v1/:role/dashboard and /api/:role/dashboard)
// Enforces authentication, server-authoritative RBAC, and tenant isolation.
// Reuses dashboardController.renderDashboard JSON output (no business logic duplication).

// CUSTOMER dashboard API
router.get(
  "/customer/dashboard",
  isLoggedIn,
  requireRole("CUSTOMER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// STAFF dashboard API
router.get(
  "/staff/dashboard",
  isLoggedIn,
  requireRole("STAFF"),
  wrapAsync(dashboardController.renderDashboard)
);

// MANAGER dashboard API
router.get(
  "/manager/dashboard",
  isLoggedIn,
  requireRole("MANAGER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// OWNER dashboard API
router.get(
  "/owner/dashboard",
  isLoggedIn,
  requireRole("OWNER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// ADMIN dashboard API
router.get(
  "/admin/dashboard",
  isLoggedIn,
  requireRole("ADMIN"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

module.exports = router;
