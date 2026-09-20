const listingService = require("../services/listingService");
const imageService = require("../services/imageService");

function isJsonRequest(req) {
  return (
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    Boolean(req.headers.accept && req.headers.accept.includes("application/json")) ||
    Boolean(req.headers["content-type"] && req.headers["content-type"].includes("application/json"))
  );
}

module.exports.index = async (req, res) => {
  const query = req.validatedQuery || req.query;
  const allListings = await listingService.getAllListings(query);
  const currentCategory = query.category || "All";
  const searchQuery = query.q || "";
  const pagination = allListings.pagination || {
    page: 1,
    limit: 12,
    total: allListings.length,
    pages: Math.ceil(allListings.length / 12)
  };

  res.render("listings/index.ejs", {
    allListings,
    currentCategory,
    searchQuery,
    pagination,
    query
  });
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
  const uploadFiles = req.files && req.files.length > 0 ? req.files : req.file;
  const savedListing = await listingService.createListing(req.body.listing, req.user, uploadFiles);
  if (isJsonRequest(req)) {
    return res.status(201).json({
      success: true,
      message: "New Property Created Successfully!",
      data: savedListing
    });
  }
  req.flash("success", "New Property Created Successfully!");
  res.redirect(`/listings/${savedListing._id}`);
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await listingService.getListingById(id);
  const originalImageUrl = imageService.getThumbnailUrl(listing.image ? listing.image.url : "");
  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const uploadFiles = req.files && req.files.length > 0 ? req.files : req.file;
  const updatedListing = await listingService.updateListing(id, req.body.listing, uploadFiles);
  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Property Details Updated!",
      data: updatedListing
    });
  }
  req.flash("success", "Property Details Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  await listingService.destroyListing(id);
  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Property Deleted!"
    });
  }
  req.flash("success", "Property Deleted!");
  res.redirect("/listings");
};

// Upload additional images to a property
module.exports.uploadImages = async (req, res) => {
  const { id } = req.params;
  const files = req.files || (req.file ? [req.file] : []);
  const updatedListing = await listingService.addListingImages(id, files);

  if (isJsonRequest(req)) {
    return res.status(201).json({
      success: true,
      message: "Images uploaded successfully",
      data: updatedListing
    });
  }
  req.flash("success", "Images uploaded successfully!");
  res.redirect(`/listings/${id}/edit`);
};

// Delete a property image
module.exports.deleteImage = async (req, res) => {
  const { id, imageId } = req.params;
  const result = await listingService.deleteListingImage(id, imageId);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Image deleted successfully",
      data: result.listing
    });
  }
  req.flash("success", "Image deleted successfully!");
  res.redirect(`/listings/${id}/edit`);
};

// Set an image as primary hero image
module.exports.setPrimaryImage = async (req, res) => {
  const { id, imageId } = req.params;
  const updatedListing = await listingService.setPrimaryImage(id, imageId);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Primary image updated successfully",
      data: updatedListing
    });
  }
  req.flash("success", "Primary image updated!");
  res.redirect(`/listings/${id}/edit`);
};

// Reorder images for a property
module.exports.reorderImages = async (req, res) => {
  const { id } = req.params;
  const imageOrder = req.body.imageOrder || [];
  const updatedListing = await listingService.reorderListingImages(id, imageOrder);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Images reordered successfully",
      data: updatedListing
    });
  }
  req.flash("success", "Images reordered successfully!");
  res.redirect(`/listings/${id}/edit`);
};