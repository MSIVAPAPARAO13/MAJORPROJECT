const { hasRole, hasPermission } = require("../config/permissions");
const ExpressError = require("../utils/ExpressError");

// Middleware to enforce specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      if (req.session) req.session.redirectUrl = req.originalUrl;
      const isApiRoute = req.originalUrl && req.originalUrl.startsWith("/api/");
      if (isApiRoute || (req.accepts("json") && req.xhr)) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      req.flash("error", "You must be logged in to access that page");
      return res.redirect("/login");
    }

    if (!hasRole(req.user, ...roles)) {
      const isApiRoute = req.originalUrl && req.originalUrl.startsWith("/api/");
      if (isApiRoute || (req.accepts("json") && req.xhr)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires role [${roles.join(", ")}]`
        });
      }
      req.flash("error", `Access Denied: Requires one of [${roles.join(", ")}]`);
      return res.redirect("/listings");
    }

    next();
  };
}

// Middleware to enforce specific permissions
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      if (req.session) req.session.redirectUrl = req.originalUrl;
      const isApiRoute = req.originalUrl && req.originalUrl.startsWith("/api/");
      if (isApiRoute || (req.accepts("json") && req.xhr)) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }
      req.flash("error", "You must be logged in to access that page");
      return res.redirect("/login");
    }

    // Check if user has all required permissions
    const isAuthorized = permissions.every((perm) => hasPermission(req.user, perm));

    if (!isAuthorized) {
      const isApiRoute = req.originalUrl && req.originalUrl.startsWith("/api/");
      if (isApiRoute || (req.accepts("json") && req.xhr)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Lacking required permission(s) [${permissions.join(", ")}]`
        });
      }
      req.flash("error", "Access Denied: You do not have permission to perform this action.");
      return res.redirect("/listings");
    }

    next();
  };
}

module.exports = {
  requireRole,
  requirePermission
};
