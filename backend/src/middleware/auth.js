// Authentication Middleware

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    if (req.accepts("json") && req.xhr) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    req.flash("error", "You must be logged in to access that page");
    return res.redirect("/login");
  }
  next();
};

// Safely sanitize redirect URLs: allow only relative internal paths starting with a single '/'
function sanitizeRedirectUrl(url, defaultUrl = "/listings") {
  if (!url || typeof url !== "string") return defaultUrl;
  const trimmed = url.trim();
  // Reject protocol-relative URLs (//example.com), backslash tricks (/\\example.com), absolute scheme URLs (http:, javascript:), and CRLF
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":") &&
    !trimmed.includes("\r") &&
    !trimmed.includes("\n")
  ) {
    return trimmed;
  }
  return defaultUrl;
}

const saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = sanitizeRedirectUrl(req.session.redirectUrl, "/listings");
  }
  next();
};

module.exports = {
  isLoggedIn,
  saveRedirectUrl,
  sanitizeRedirectUrl
};
