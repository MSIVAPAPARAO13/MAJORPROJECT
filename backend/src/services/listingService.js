const Listing = require("../models/listing");
require("../models/user");
require("../models/review");
require("../models/organization");
const mapService = require("./mapService");
const imageService = require("./imageService");
const ExpressError = require("../utils/ExpressError");

// Build query for search, categories, propertyType, price range
function buildListingQuery(queryParams) {
  const { q, category, propertyType, minPrice, maxPrice } = queryParams;
  const filter = { status: "ACTIVE" };

  // Search keyword across title, location, country
  if (q && q.trim()) {
    const searchRegex = new RegExp(q.trim(), "i");
    filter.$or = [
      { title: searchRegex },
      { location: searchRegex },
      { country: searchRegex },
      { description: searchRegex }
    ];
  }

  // Category filter (case-insensitive)
  if (category && category.trim() && category.toLowerCase() !== "all") {
    filter.category = new RegExp(`^${category.trim()}$`, "i");
  }

  // Property type filter (Hostel, Hotel, Apartment, etc.)
  if (propertyType && propertyType.trim()) {
    filter.propertyType = propertyType.trim();
  }

  // Price range
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice && !isNaN(minPrice)) filter.price.$gte = Number(minPrice);
    if (maxPrice && !isNaN(maxPrice)) filter.price.$lte = Number(maxPrice);
  }

  return filter;
}

// Get all listings with optional filtering
async function getAllListings(queryParams = {}) {
  const filter = buildListingQuery(queryParams);
  return await Listing.find(filter).sort({ createdAt: -1 });
}

// Get single listing populated with owner, reviews (and review authors)
async function getListingById(id) {
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" }
    })
    .populate("owner")
    .populate("organization");

  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }
  return listing;
}

// Get all listings for an organization
async function getListingsByOrganization(orgId) {
  return await Listing.find({ organization: orgId }).sort({ createdAt: -1 });
}

// Create new listing
async function createListing(listingData, user, file) {
  const { location, country, title, price, description, propertyType, category, amenities } = listingData;

  // Geocode address to get GeoJSON [lng, lat]
  const geoResult = await mapService.geocodeLocation(location, country);

  // Process uploaded image
  const processedImage = imageService.processUploadedImage(file);

  const newListing = new Listing({
    title,
    description,
    price: Number(price),
    location,
    country,
    propertyType: propertyType || "Apartment",
    category: category || "Rooms",
    amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : ["WiFi", "Air Conditioning"]),
    image: processedImage,
    images: [{ ...processedImage, isPrimary: true }],
    geometry: {
      type: "Point",
      coordinates: geoResult.coordinates
    },
    owner: user._id,
    organization: user.organization || null
  });

  return await newListing.save();
}

// Update listing
async function updateListing(id, updateData, file) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  // If location changed, re-geocode
  if (updateData.location && updateData.location !== listing.location) {
    const country = updateData.country || listing.country;
    const geoResult = await mapService.geocodeLocation(updateData.location, country);
    listing.geometry = {
      type: "Point",
      coordinates: geoResult.coordinates
    };
  }

  // Ensure ownership and tenant boundaries cannot be tampered with via updates
  delete updateData.owner;
  delete updateData.organization;

  // Apply scalar fields
  if (updateData.title) listing.title = updateData.title;
  if (updateData.description) listing.description = updateData.description;
  if (updateData.price) listing.price = Number(updateData.price);
  if (updateData.location) listing.location = updateData.location;
  if (updateData.country) listing.country = updateData.country;
  if (updateData.propertyType) listing.propertyType = updateData.propertyType;
  if (updateData.category) listing.category = updateData.category;
  if (updateData.amenities) {
    listing.amenities = Array.isArray(updateData.amenities) ? updateData.amenities : [updateData.amenities];
  }

  // If new image provided, update image
  if (file) {
    const processedImage = imageService.processUploadedImage(file);
    listing.image = processedImage;
    listing.images.unshift({ ...processedImage, isPrimary: true });
  }

  await listing.save();
  return listing;
}

// Destroy listing
async function destroyListing(id) {
  const deletedListing = await Listing.findByIdAndDelete(id);
  if (!deletedListing) {
    throw new ExpressError("Listing not found", 404);
  }
  return deletedListing;
}

module.exports = {
  getAllListings,
  getListingById,
  getListingsByOrganization,
  createListing,
  updateListing,
  destroyListing,
  buildListingQuery
};
