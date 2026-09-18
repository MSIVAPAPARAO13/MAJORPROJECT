const express = require("express");
const router = express.Router();
const passport = require("passport");
const User = require("../../models/user");
const wrapAsync = require("../../utils/wrapAsync");

// GET /api/auth/me - Current user session check
router.get("/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      success: true,
      user: {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        organization: req.user.organization,
      },
    });
  }
  res.json({ success: true, user: null });
});

// POST /api/auth/signup - Register new account
router.post(
  "/signup",
  wrapAsync(async (req, res, next) => {
    const { username, email, password, role, phone } = req.body;
    const allowedRoles = ["CUSTOMER", "OWNER"];
    const userRole = allowedRoles.includes(role) ? role : "CUSTOMER";

    const newUser = new User({
      username: (username || "").trim(),
      email: (email || "").trim(),
      role: userRole,
      phone: phone ? phone.trim() : undefined,
    });

    try {
      const registeredUser = await User.register(newUser, password);
      req.login(registeredUser, (err) => {
        if (err) return next(err);
        return res.status(201).json({
          success: true,
          message: `Welcome to WanderLust, ${registeredUser.username}!`,
          user: {
            _id: registeredUser._id,
            username: registeredUser.username,
            email: registeredUser.email,
            role: registeredUser.role,
          },
        });
      });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  })
);

// POST /api/auth/login - Log into existing account
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: info ? info.message : "Invalid username or password",
      });
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({
        success: true,
        message: `Welcome back, ${user.username}!`,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    });
  })(req, res, next);
});

// POST /api/auth/logout - Terminate session
router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      return res.json({ success: true, message: "Logged out successfully" });
    });
  });
});

module.exports = router;
