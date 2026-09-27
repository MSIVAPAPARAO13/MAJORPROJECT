const express = require("express");
const router = express.Router();
const { getFeaturesForUser, getAllFeatures } = require("../../config/featureRegistry");
const { optionalApiAuth } = require("../../middleware/apiAuth");

/**
 * GET /api/v2/features
 * Returns platform features allowed for the current authenticated user.
 * Supports both Session (SSR) and Bearer JWT (API) authentication contexts.
 */
router.get("/", optionalApiAuth, (req, res) => {
  const user = req.apiUser || req.user || null;
  const availableFeatures = getFeaturesForUser(user);

  return res.json({
    success: true,
    role: user ? user.role : "ANONYMOUS",
    count: availableFeatures.length,
    features: availableFeatures
  });
});

module.exports = router;
