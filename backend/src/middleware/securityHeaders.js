// Security Headers & Content-Security-Policy middleware
// Configured specifically for WanderLust resources (Mapbox, Cloudinary, Bootstrap, FontAwesome, Google Fonts, Unsplash)

function securityHeaders(req, res, next) {
  // 1. Remove technology fingerprinting
  res.removeHeader("X-Powered-By");

  // 2. Standard Defense-in-Depth Headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");

  // 3. Strict-Transport-Security (production only)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");
  }

  // 4. Content Security Policy
  // Note: 'unsafe-inline' is required for scripts due to server-rendered EJS variables (Mapbox token & config)
  // and for styles due to Bootstrap styling and inline style attributes.
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://api.mapbox.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://api.mapbox.com",
    "connect-src 'self' https://api.mapbox.com https://events.mapbox.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ];

  res.setHeader("Content-Security-Policy", cspDirectives.join("; "));

  next();
}

module.exports = securityHeaders;
