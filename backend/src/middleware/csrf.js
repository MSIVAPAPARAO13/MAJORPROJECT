// Session-backed Cryptographic CSRF Protection Middleware
// Conforms to Phase 10 rules:
// - Safe methods (GET, HEAD, OPTIONS) bypassed
// - Cryptographically strong tokens via crypto.randomBytes(32)
// - Supports hidden form input (_csrf) and headers (x-csrf-token, csrf-token)
// - Validates all state-changing mutations (POST, PUT, PATCH, DELETE) using session cookies
// - No blanket exemption for /api/* routes relying on session cookies

const crypto = require("crypto");

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function csrfMiddleware(req, res, next) {
  // Ensure session has a cryptographically secure CSRF token
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    if (res) {
      if (!res.locals) res.locals = {};
      res.locals.csrfToken = req.session.csrfToken;
    }
  }

  // Safe HTTP methods do not mutate state
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Allow controlled test bypass strictly when NODE_ENV === 'test' and explicitly set on request
  if (process.env.NODE_ENV === "test" && req.bypassCsrf === true) {
    return next();
  }

  // Unauthenticated public API login/signup do not have an active session to guard against session-riding CSRF
  if (
    (req.path === "/api/auth/login" || req.path === "/api/auth/signup") &&
    (!req.session || !req.session.passport || !req.session.passport.user)
  ) {
    return next();
  }

  // Extract submitted CSRF token from body, query, or headers
  const token =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.headers["x-csrf-token"] ||
    req.headers["csrf-token"];

  const sessionToken = req.session && req.session.csrfToken;

  if (!sessionToken || !token || !safeCompare(token, sessionToken)) {
    const isJson = Boolean(
      (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
      (req.baseUrl && req.baseUrl.startsWith("/api/")) ||
      req.xhr ||
      (req.headers.accept && req.headers.accept.includes("application/json"))
    );

    if (isJson) {
      return res.status(403).json({
        success: false,
        message: "Invalid or missing CSRF token"
      });
    }

    if (req.flash) {
      req.flash("error", "Session expired or invalid CSRF token. Please try again.");
    }
    return res.status(403).render("error.ejs", {
      message: "Forbidden: Invalid or missing CSRF token"
    });
  }

  next();
}

csrfMiddleware.safeCompare = safeCompare;
module.exports = csrfMiddleware;
