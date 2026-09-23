// CORS Middleware
// Enforces explicit trusted origins and disables wildcard '*' with credentials

function corsMiddleware(req, res, next) {
  const envOriginsStr = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS;
  const envOrigins = envOriginsStr
    ? envOriginsStr.split(",").map((o) => o.trim())
    : [];
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    ...envOrigins
  ];

  const origin = (req.headers && req.headers.origin) || (typeof req.get === "function" && req.get("origin"));
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, CSRF-Token"
  );

  if (req.method === "OPTIONS") {
    if (typeof res.sendStatus === "function") {
      return res.sendStatus(204);
    }
    if (typeof res.end === "function") {
      return res.end();
    }
    return;
  }

  next();
}

module.exports = corsMiddleware;
