const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn, requireRole, requirePermission, validateDashboardFilters } = require('../middleware');
const { PERMISSIONS } = require('../config/permissions');
const dashboardController = require('../controllers/dashboardController');

/**
 * Role-specific Dashboard URLs.
 * Each URL enforces the exact role via requireRole(), preventing cross-role access.
 * The actual rendering logic stays in dashboardController.renderDashboard (no duplication).
 */

// CUSTOMER dashboard
router.get('/customer/dashboard',
  isLoggedIn,
  requireRole('CUSTOMER'),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// STAFF dashboard
router.get('/staff/dashboard',
  isLoggedIn,
  requireRole('STAFF'),
  wrapAsync(dashboardController.renderDashboard)
);

// MANAGER dashboard
router.get('/manager/dashboard',
  isLoggedIn,
  requireRole('MANAGER'),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// OWNER dashboard
router.get('/owner/dashboard',
  isLoggedIn,
  requireRole('OWNER'),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

// ADMIN dashboard
router.get('/admin/dashboard',
  isLoggedIn,
  requireRole('ADMIN'),
  validateDashboardFilters,
  wrapAsync(dashboardController.renderDashboard)
);

module.exports = router;
