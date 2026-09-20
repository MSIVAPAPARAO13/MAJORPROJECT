const ExpressError = require("../utils/ExpressError");

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function sanitizeInput(obj) {
  if (!obj || typeof obj !== "object") return {};
  const cleaned = {};
  for (const key of Object.keys(obj)) {
    // Block MongoDB operator injection
    if (key.startsWith("$")) continue;
    const value = obj[key];
    if (typeof value === "string") {
      cleaned[key] = value.trim();
    } else if (typeof value === "number" || typeof value === "boolean") {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function isJsonRequest(req) {
  if (!req) return false;
  const acceptsJson = typeof req.accepts === "function" && req.accepts("json");
  const isApiUrl = req.originalUrl && typeof req.originalUrl === "string" && req.originalUrl.startsWith("/api/");
  const hasJsonHeader = req.headers && req.headers.accept && req.headers.accept.includes("application/json");
  return Boolean((acceptsJson && (req.xhr || isApiUrl)) || hasJsonHeader);
}

function sendValidationError(req, res, next, message) {
  if (isJsonRequest(req) && res && typeof res.status === "function") {
    return res.status(400).json({ success: false, message });
  }
  return next(new ExpressError(message, 400));
}

function validateDashboardFilters(req, res, next) {
  const rawQuery = req.query || {};
  const query = sanitizeInput(rawQuery);

  const filter = {
    preset: "30d",
    startDate: null,
    endDate: null,
    limit: 10
  };

  const allowedPresets = ["today", "7d", "30d", "90d", "all", "custom"];
  if (query.preset) {
    const p = query.preset.toLowerCase();
    if (!allowedPresets.includes(p)) {
      return sendValidationError(req, res, next, `Invalid preset '${query.preset}'. Allowed presets: ${allowedPresets.join(", ")}`);
    }
    filter.preset = p;
  }

  // Handle custom date range
  if (query.startDate || query.endDate) {
    if (!query.startDate || !query.endDate) {
      return sendValidationError(req, res, next, "Both startDate and endDate are required for custom date range");
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendValidationError(req, res, next, "Invalid date format. Expected YYYY-MM-DD or ISO string.");
    }

    if (end < start) {
      return sendValidationError(req, res, next, "endDate must be greater than or equal to startDate");
    }

    const maxDays = 366;
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > maxDays) {
      return sendValidationError(req, res, next, `Date range cannot exceed ${maxDays} days`);
    }

    filter.preset = "custom";
    filter.startDate = start;
    filter.endDate = end;
  }

  // Bounded limit
  if (query.limit !== undefined) {
    const num = Number(query.limit);
    if (!Number.isInteger(num) || num < 1 || num > 50) {
      return sendValidationError(req, res, next, "Limit must be an integer between 1 and 50");
    }
    filter.limit = num;
  }

  req.validatedDashboardQuery = filter;
  next();
}

module.exports = {
  validateDashboardFilters
};
