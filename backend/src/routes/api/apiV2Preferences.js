const express = require("express");
const router = express.Router();
const UserPreference = require("../../models/userPreference");
const wrapAsync = require("../../utils/wrapAsync");

// Auth helper for preferences: requires active session or Bearer token
function requireUserAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const { requireApiAuth } = require("../../middleware/apiAuth");
    return requireApiAuth(req, res, next);
  }
  return res.status(401).json({ success: false, message: "Authentication required" });
}

/**
 * GET /api/v2/preferences
 * Fetch user UI presentation preferences.
 */
router.get(
  "/",
  requireUserAuth,
  wrapAsync(async (req, res) => {
    const userId = (req.apiUser && req.apiUser._id) || (req.user && req.user._id);
    let prefs = await UserPreference.findOne({ user: userId });

    if (!prefs) {
      prefs = {
        theme: "light",
        density: "comfortable",
        sidebarState: "expanded",
        dashboardLayout: {},
        notifications: true
      };
    }

    return res.json({
      success: true,
      preferences: prefs
    });
  })
);

/**
 * PATCH /api/v2/preferences
 * Update user UI presentation preferences.
 * Cannot be used to elevate role or alter security permissions.
 */
router.patch(
  "/",
  requireUserAuth,
  wrapAsync(async (req, res) => {
    const userId = (req.apiUser && req.apiUser._id) || (req.user && req.user._id);
    const { theme, density, sidebarState, dashboardLayout, notifications } = req.body;

    const updates = {};
    if (["light", "dark", "system"].includes(theme)) updates.theme = theme;
    if (["comfortable", "compact"].includes(density)) updates.density = density;
    if (["expanded", "collapsed"].includes(sidebarState)) updates.sidebarState = sidebarState;
    if (typeof notifications === "boolean") updates.notifications = notifications;
    if (dashboardLayout && typeof dashboardLayout === "object") updates.dashboardLayout = dashboardLayout;

    const prefs = await UserPreference.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: "Preferences updated successfully",
      preferences: prefs
    });
  })
);

module.exports = router;
