const { verifyAccessToken } = require("../services/jwtService");
const { hasRole, hasPermission } = require("../config/permissions");

/**
 * JWT API Authentication Middleware
 * Enforces stateless Bearer token validation for /api/v2/* routes.
 * Populates req.apiUser with cryptographically verified token claims.
 */
function requireApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required: Missing or malformed Bearer token"
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token);
    req.apiUser = {
      _id: decoded.sub,
      role: decoded.role,
      organization: decoded.organizationId || null
    };

    // Forward compatibility for downstream middleware expecting req.user
    if (!req.user) {
      req.user = req.apiUser;
      req.isAuthenticated = () => true;
    }

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token has expired. Please refresh your token.",
        code: "TOKEN_EXPIRED"
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid or forged access token"
    });
  }
}

/**
 * Enforce role authorization on JWT-authenticated API routes
 */
function requireApiRole(...roles) {
  return (req, res, next) => {
    const user = req.apiUser || req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!hasRole(user, ...roles)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of [${roles.join(", ")}]`
      });
    }

    next();
  };
}

/**
 * Enforce granular permission on JWT-authenticated API routes
 */
function requireApiPermission(...permissions) {
  return (req, res, next) => {
    const user = req.apiUser || req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const isAuthorized = permissions.every((perm) => hasPermission(user, perm));
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Lacking required permission(s) [${permissions.join(", ")}]`
      });
    }

    next();
  };
}

/**
 * Enforce multi-tenant organization boundary
 */
function requireApiTenantScope(extractOrgId = (req) => req.params.orgId || req.body.organization || req.query.organization) {
  return (req, res, next) => {
    const user = req.apiUser || req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Platform ADMIN bypasses tenant scope checks
    if (user.role === "ADMIN") {
      return next();
    }

    const targetOrgId = typeof extractOrgId === "function" ? extractOrgId(req) : req.params[extractOrgId];
    if (!targetOrgId) {
      return next();
    }

    if (!user.organization || user.organization.toString() !== targetOrgId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cross-tenant access denied"
      });
    }

    next();
  };
}

/**
 * Optional API Auth Middleware
 * If Authorization: Bearer token is provided, decodes and populates req.apiUser / req.user.
 * Does not reject requests if missing or invalid.
 */
function optionalApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = verifyAccessToken(token);
      req.apiUser = {
        _id: decoded.sub,
        role: decoded.role,
        organization: decoded.organizationId || null
      };
      if (!req.user) {
        req.user = req.apiUser;
        req.isAuthenticated = () => true;
      }
    } catch (_) {
      // In optional mode, continue without attaching apiUser
    }
  }
  next();
}

module.exports = {
  requireApiAuth,
  optionalApiAuth,
  requireApiRole,
  requireApiPermission,
  requireApiTenantScope
};
