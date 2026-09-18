const listingService = require("../services/listingService");
const wrapAsync = require("../utils/wrapAsync");

module.exports.index = async (req, res) => {
  const allListings = await listingService.getAllListings(req.query);
  const currentCategory = req.query.category || "All";
  const searchQuery = req.query.q || "";
  res.render("listings/index.ejs", { allListings, currentCategory, searchQuery });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;
  const listing = await listingService.getListingById(id);
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res) => {
  const savedListing = await listingService.createListing(req.body.listing, req.user, req.file);
  req.flash("success", "New Property Created Successfully!");
  res.redirect(`/listings/${savedListing._id}`);
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await listingService.getListingById(id);
  let originalImageUrl = listing.image && listing.image.url ? listing.image.url : "";
  if (originalImageUrl.includes("/upload")) {
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  }
  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  await listingService.updateListing(id, req.body.listing, req.file);
  req.flash("success", "Property Details Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  await listingService.destroyListing(id);
  req.flash("success", "Property Deleted!");
  res.redirect("/listings");
};