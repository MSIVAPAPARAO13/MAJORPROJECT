const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const dashboardController = require("../controllers/dashboardController");

router.get("/", isLoggedIn, wrapAsync(dashboardController.renderDashboard));

module.exports = router;
