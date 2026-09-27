const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../../models/user");
const wrapAsync = require("../../utils/wrapAsync");
const {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  getRefreshCookieOptions
} = require("../../services/jwtService");
const { requireApiAuth } = require("../../middleware/apiAuth");

/**
 * POST /api/v2/auth/signup
 * Public customer self-registration.
 * Strictly forces role: 'CUSTOMER' and organization: null.
 */
router.post(
  "/signup",
  wrapAsync(async (req, res) => {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required"
      });
    }

    const newUser = new User({
      username: username.trim(),
      email: email.trim(),
      role: "CUSTOMER",
      organization: null,
      phone: phone ? phone.trim() : undefined
    });

    try {
      const registeredUser = await User.register(newUser, password);
      const accessToken = generateAccessToken(registeredUser);
      const { rawToken } = await generateRefreshToken(registeredUser);

      res.cookie("refreshToken", rawToken, getRefreshCookieOptions());

      return res.status(201).json({
        success: true,
        message: `Welcome to WanderLust, ${registeredUser.username}!`,
        user: {
          _id: registeredUser._id,
          username: registeredUser.username,
          email: registeredUser.email,
          role: registeredUser.role
        },
        accessToken
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  })
);

/**
 * POST /api/v2/auth/login
 * Log into account via credentials.
 * Enforces server-authoritative role validation.
 */
router.post("/login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info ? info.message : "Invalid username or password"
      });
    }

    // Server-authoritative role validation
    const selectedRole = req.body.selectedRole;
    if (selectedRole && selectedRole !== user.role) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Selected role '${selectedRole}' does not match authenticated role '${user.role}'`
      });
    }

    try {
      const accessToken = generateAccessToken(user);
      const { rawToken } = await generateRefreshToken(user);

      res.cookie("refreshToken", rawToken, getRefreshCookieOptions());

      return res.json({
        success: true,
        message: `Welcome back, ${user.username}!`,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          organization: user.organization
        },
        accessToken
      });
    } catch (tokenErr) {
      return next(tokenErr);
    }
  })(req, res, next);
});

/**
 * POST /api/v2/auth/refresh
 * Rotate refresh token and issue a fresh access token.
 */
router.post(
  "/refresh",
  wrapAsync(async (req, res) => {
    const rawRefreshToken =
      (req.cookies && req.cookies.refreshToken) ||
      (req.body && req.body.refreshToken);

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is missing from request"
      });
    }

    try {
      const rotationResult = await rotateRefreshToken(rawRefreshToken);
      res.cookie("refreshToken", rotationResult.refreshToken, getRefreshCookieOptions());

      return res.json({
        success: true,
        message: "Token refreshed successfully",
        accessToken: rotationResult.accessToken,
        user: rotationResult.user
      });
    } catch (err) {
      res.clearCookie("refreshToken", getRefreshCookieOptions());
      return res.status(err.statusCode || 401).json({
        success: false,
        message: err.message
      });
    }
  })
);

/**
 * POST /api/v2/auth/logout
 * Terminate API session, revoke refresh token, clear cookie.
 */
router.post(
  "/logout",
  wrapAsync(async (req, res) => {
    const rawRefreshToken =
      (req.cookies && req.cookies.refreshToken) ||
      (req.body && req.body.refreshToken);

    if (rawRefreshToken) {
      await revokeRefreshToken(rawRefreshToken);
    }

    res.clearCookie("refreshToken", getRefreshCookieOptions());

    return res.json({
      success: true,
      message: "Logged out successfully from API session"
    });
  })
);

/**
 * GET /api/v2/auth/me
 * Retrieve current authenticated API user profile.
 */
router.get(
  "/me",
  requireApiAuth,
  wrapAsync(async (req, res) => {
    const user = await User.findById(req.apiUser._id).select("-hash -salt");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        organization: user.organization
      }
    });
  })
);

module.exports = router;
