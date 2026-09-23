const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Organization = require("../models/organization");
const Room = require("../models/room");
const ServiceIssue = require("../models/serviceIssue");

// Models registry for tenant verification
const MODELS = {
  Listing,
  Organization,
  Room,
  ServiceIssue
};

function isJsonRequest(req) {
  return Boolean(
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    Boolean(req.headers && req.headers.accept && req.headers.accept.includes("application/json")) ||
    Boolean(req.headers && req.headers["content-type"] && req.headers["content-type"].includes("application/json")) ||
    Boolean(req.accepts && req.accepts("json") && req.xhr)
  );
}

/**
 * Tenant Isolation Middleware
 * Enforces that non-ADMIN users can only access or modify resources belonging to their own organization.
 * Rejects cross-tenant access with 403 Forbidden.
 */
function requireTenantAccess(modelName, paramName = "id") {
  return async (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      if (req.session) req.session.redirectUrl = req.originalUrl;
      if (isJsonRequest(req)) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      req.flash("error", "You must be logged in to access that page");
      return res.redirect("/login");
    }

    // System-level ADMIN bypasses tenant boundaries
    if (req.user && req.user.role === "ADMIN") {
      return next();
    }

    const resourceId = req.params[paramName] || 
      (modelName === "Room" ? req.params.roomId : undefined) ||
      (modelName === "ServiceIssue" ? req.params.issueId : undefined);
    if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
      if (isJsonRequest(req)) {
        return res.status(404).json({ success: false, message: "Resource not found" });
      }
      req.flash("error", "Resource not found");
      return res.redirect("/listings");
    }

    const Model = MODELS[modelName];
    if (!Model) {
      console.error(`[Tenant Middleware Error] Unknown model: ${modelName}`);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }

    const resource = await Model.findById(resourceId);
    if (!resource) {
      if (isJsonRequest(req)) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }
      req.flash("error", `${modelName} not found`);
      return res.redirect("/listings");
    }

    // Determine the resource's organization ID
    let resourceOrgId = null;
    if (modelName === "Organization") {
      resourceOrgId = resource._id;
    } else if (resource.organization) {
      resourceOrgId = resource.organization;
    }

    // Check against user's authenticated organization
    const userOrgId = req.user.organization;

    if (!userOrgId || !resourceOrgId || !userOrgId.equals(resourceOrgId)) {
      if (isJsonRequest(req)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Cross-tenant access is strictly prohibited."
        });
      }
      req.flash("error", "Access Denied: You do not have permission to access resources outside your organization.");
      return res.redirect("/listings");
    }

    // Attach verified resource to request for downstream optimization
    req.tenantResource = resource;
    next();
  };
}

module.exports = {
  requireTenantAccess
};
