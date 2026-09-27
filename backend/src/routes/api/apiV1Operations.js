const express = require("express");
const router = express.Router();
const wrapAsync = require("../../utils/wrapAsync");
const { isLoggedIn, requireRole } = require("../../middleware");
const operationsController = require("../../controllers/operationsController");

// Thin Role Operations REST APIs (/api/v1/:role/operations and /api/:role/operations)
// Enforces authentication, server-authoritative RBAC, and tenant isolation.
// Reuses operationsController.renderOperations JSON output (no business logic duplication).

// STAFF operations API
router.get(
  "/staff/operations",
  isLoggedIn,
  requireRole("STAFF"),
  wrapAsync(operationsController.renderOperations)
);

// MANAGER operations API
router.get(
  "/manager/operations",
  isLoggedIn,
  requireRole("MANAGER"),
  wrapAsync(operationsController.renderOperations)
);

// OWNER operations API
router.get(
  "/owner/operations",
  isLoggedIn,
  requireRole("OWNER"),
  wrapAsync(operationsController.renderOperations)
);

// ADMIN operations API
router.get(
  "/admin/operations",
  isLoggedIn,
  requireRole("ADMIN"),
  wrapAsync(operationsController.renderOperations)
);

module.exports = router;
