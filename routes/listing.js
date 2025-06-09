const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn,isOwner,validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer  = require('multer')
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });




router
.route("/")
.get(wrapAsync(listingController.index))
.post(isLoggedIn, 
     upload.single('listing[image]'),
      validateListing,
 wrapAsync(listingController.createListing));

//New Route
router.get("/new", isLoggedIn, listingController.renderNewForm);

//Update Route
router.route("/:id")
.put(isLoggedIn, isOwner, upload.single('listing[image]'),validateListing, wrapAsync(listingController.updateListing));

//show Route
router.get("/:id", validateListing, wrapAsync(listingController.showListing));


//Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, validateListing, wrapAsync(listingController.renderEditForm));



//Delete Route
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));
module.exports = router;