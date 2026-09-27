const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const { validateDashboardFilters } = require("../../middleware");
const { requireApiRole } = require("../../middleware/apiAuth");
const dashboardController = require("../../controllers/dashboardController");
const operationsController = require("../../controllers/operationsController");

// Authentication middleware accepting both JWT (Authorization header) and existing Session
function requireAnyAuth(req, res, next) {
  // If already authenticated via Passport session
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // If JWT bearer token is provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const { requireApiAuth } = require("../../middleware/apiAuth");
    return requireApiAuth(req, res, next);
  }

  return res.status(401).json({
    success: false,
    message: "Authentication required: Provide Bearer token or active session"
  });
}

/**
 * /api/v2/ Dashboard Endpoints
 */

// CUSTOMER Dashboard
router.get(
  "/customer/dashboard",
  requireAnyAuth,
  requireApiRole("CUSTOMER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// STAFF Dashboard
router.get(
  "/staff/dashboard",
  requireAnyAuth,
  requireApiRole("STAFF"),
  wrapAsync(dashboardController.renderDashboard)
);

// MANAGER Dashboard
router.get(
  "/manager/dashboard",
  requireAnyAuth,
  requireApiRole("MANAGER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// OWNER Dashboard
router.get(
  "/owner/dashboard",
  requireAnyAuth,
  requireApiRole("OWNER"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// ADMIN Dashboard
router.get(
  "/admin/dashboard",
  requireAnyAuth,
  requireApiRole("ADMIN"),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

/**
 * /api/v2/ Operations Endpoints
 */

// STAFF Operations
router.get(
  "/staff/operations",
  requireAnyAuth,
  requireApiRole("STAFF"),
  wrapAsync(operationsController.renderOperations)
);

// MANAGER Operations
router.get(
  "/manager/operations",
  requireAnyAuth,
  requireApiRole("MANAGER"),
  wrapAsync(operationsController.renderOperations)
);

// OWNER Operations
router.get(
  "/owner/operations",
  requireAnyAuth,
  requireApiRole("OWNER"),
  wrapAsync(operationsController.renderOperations)
);

// ADMIN Operations
router.get(
  "/admin/operations",
  requireAnyAuth,
  requireApiRole("ADMIN"),
  wrapAsync(operationsController.renderOperations)
);

module.exports = router;
