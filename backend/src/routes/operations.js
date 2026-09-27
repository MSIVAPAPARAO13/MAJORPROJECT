const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn, requireRole } = require('../middleware');
const operationsController = require('../controllers/operationsController');

/**
 * Operations Routes — Separate "Operations Center" distinct from Dashboard.
 * Strict role guards: each URL only admits the matching role.
 * Server uses req.user.role — URL role prefix is purely for UX clarity.
 */

// STAFF Operations Center
router.get('/staff/operations',
  isLoggedIn,
  requireRole('STAFF'),
  wrapAsync(operationsController.renderOperations)
);

// MANAGER Operations Center
router.get('/manager/operations',
  isLoggedIn,
  requireRole('MANAGER'),
  wrapAsync(operationsController.renderOperations)
);

// OWNER Operations Center
router.get('/owner/operations',
  isLoggedIn,
  requireRole('OWNER'),
  wrapAsync(operationsController.renderOperations)
);

// ADMIN Operations Center
router.get('/admin/operations',
  isLoggedIn,
  requireRole('ADMIN'),
  wrapAsync(operationsController.renderOperations)
);

module.exports = router;
