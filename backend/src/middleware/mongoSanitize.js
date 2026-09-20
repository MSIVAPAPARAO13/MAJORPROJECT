// Middleware to prevent NoSQL operator injection by stripping keys starting with $ or containing .
// Sanitize ONLY untrusted incoming request inputs (req.body, req.query, req.params)

function sanitizeObject(target) {
  if (!target || typeof target !== "object") return target;

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeObject(target[i]);
    }
    return target;
  }

  for (const key of Object.keys(target)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete target[key];
    } else if (typeof target[key] === "object" && target[key] !== null) {
      sanitizeObject(target[key]);
      if (!Array.isArray(target[key]) && Object.keys(target[key]).length === 0) {
        delete target[key];
      }
    }
  }
  return target;
}

function mongoSanitize(req, res, next) {
  if (req.body) {
    sanitizeObject(req.body);
  }
  if (req.query) {
    sanitizeObject(req.query);
  }
  if (req.params) {
    sanitizeObject(req.params);
  }
  next();
}

module.exports = {
  mongoSanitize,
  sanitizeObject
};
