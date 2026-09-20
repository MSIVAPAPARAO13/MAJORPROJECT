// In-memory rate limiter middleware for abuse prevention
// Follows strict Phase 10 rules: Zero client-controlled header bypasses.
// Test environment bypass is strictly scoped to process.env.NODE_ENV === "test"

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests, please try again later." }) {
  const hits = new Map();

  // Periodic cleanup of expired windows every 5 minutes
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.startTime > windowMs) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (interval.unref) interval.unref();

  const limiter = (req, res, next) => {
    // Only allow bypass when NODE_ENV is strictly 'test' AND explicitly flagged in internal code (not via headers)
    if (process.env.NODE_ENV === "test" && req.bypassRateLimit === true) {
      return next();
    }

    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      hits.set(ip, record);
    } else {
      record.count++;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - record.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil((record.startTime + windowMs) / 1000));

    if (record.count > max) {
      const isJson = Boolean(
        (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
        (req.baseUrl && req.baseUrl.startsWith("/api/")) ||
        req.xhr ||
        (req.headers.accept && req.headers.accept.includes("application/json"))
      );

      res.setHeader("Retry-After", Math.ceil((record.startTime + windowMs - now) / 1000));

      if (isJson) {
        return res.status(429).json({ success: false, message });
      }
      return res.status(429).send(`<h3>429 Too Many Requests</h3><p>${message}</p>`);
    }

    next();
  };

  limiter.reset = () => hits.clear();
  return limiter;
}

// 1. Strict Limiter for Authentication Endpoints (login, signup) - 20 requests per 15 minutes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again in 15 minutes."
});

// 2. Sensitive Mutation Limiter (bookings, reviews, image uploads) - 100 requests per 15 minutes
const mutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many write requests. Please slow down and try again later."
});

module.exports = {
  createRateLimiter,
  authLimiter,
  mutationLimiter
};
