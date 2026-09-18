const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, validateOrganization } = require("../middleware");
const organizationController = require("../controllers/organizationController");

router.get("/new", isLoggedIn, organizationController.renderNewForm);
router.post("/", isLoggedIn, validateOrganization, wrapAsync(organizationController.createOrganization));
router.get("/:orgId", isLoggedIn, wrapAsync(organizationController.showOrganization));

module.exports = router;
