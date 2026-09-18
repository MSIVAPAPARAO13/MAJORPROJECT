const express = require("express");
const router = express.Router();

// Privacy Policy
router.get("/privacy", (req, res) => {
  res.render("pages/privacy.ejs", { pageTitle: "Privacy Policy" });
});

// Terms of Service
router.get("/terms", (req, res) => {
  res.render("pages/terms.ejs", { pageTitle: "Terms of Service" });
});

// Visual Sitemap
router.get("/sitemap", (req, res) => {
  res.render("pages/sitemap.ejs", { pageTitle: "Platform Sitemap" });
});

// Support & Trust Center
router.get("/trust", (req, res) => {
  res.render("pages/trust.ejs", { pageTitle: "Support & Trust Center" });
});

module.exports = router;
