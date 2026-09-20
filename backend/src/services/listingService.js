const Listing = require("../models/listing");
const Room = require("../models/room");
const Booking = require("../models/booking");
require("../models/user");
require("../models/review");
require("../models/organization");
const mapService = require("./mapService");
const imageService = require("./imageService");
const ExpressError = require("../utils/ExpressError");

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Build query for search, categories, propertyType, room constraints, availability, price range
async function buildListingQuery(queryParams = {}) {
  const {
    q,
    location,
    category,
    propertyType,
    roomType,
    guests,
    minPrice,
    maxPrice,
    checkIn,
    checkOut,
    amenities
  } = queryParams;

  const filter = { status: "ACTIVE" };

  // 1. Text keyword search across title, location, country, description (safely escaped)
  if (q && q.trim()) {
    const searchRegex = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [
      { title: searchRegex },
      { location: searchRegex },
      { country: searchRegex },
      { description: searchRegex }
    ];
  }

  // 2. Specific Location / Destination search
  if (location && location.trim()) {
    const locRegex = new RegExp(escapeRegex(location.trim()), "i");
    const locCondition = {
      $or: [
        { location: locRegex },
        { country: locRegex }
      ]
    };
    if (filter.$or) {
      filter.$and = filter.$and || [];
      filter.$and.push(locCondition);
    } else {
      filter.$or = locCondition.$or;
    }
  }

  // 3. Category filter (case-insensitive)
  if (category && category.trim() && category.toLowerCase() !== "all") {
    filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, "i");
  }

  // 4. Property type filter
  if (propertyType && propertyType.trim()) {
    filter.propertyType = new RegExp(`^${escapeRegex(propertyType.trim())}$`, "i");
  }

  // 5. Amenities filter: parse array or comma-separated string
  let amenityList = [];
  if (Array.isArray(amenities)) {
    amenityList = amenities.filter(Boolean);
  } else if (typeof amenities === "string" && amenities.trim()) {
    amenityList = amenities.split(",").map((a) => a.trim()).filter(Boolean);
  }

  // 6. Same-Room Constraint Evaluation (Rule 1 & Rule 5: Zero N+1)
  // When room-level filters (guests, roomType, room pricing, availability) are supplied,
  // ALL room-level constraints MUST be satisfied by the EXACT SAME Room document!
  const hasRoomConstraints = Boolean(
    guests ||
    roomType ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    (checkIn && checkOut)
  );

  if (hasRoomConstraints) {
    const roomCriteria = {
      status: "AVAILABLE"
    };

    // Capacity constraint: same room capacity >= guests
    if (guests && Number(guests) >= 1) {
      roomCriteria.capacity = { $gte: Number(guests) };
    }

    // Room type constraint: same room roomType == roomType
    if (roomType && roomType.trim()) {
      roomCriteria.roomType = new RegExp(`^${escapeRegex(roomType.trim())}$`, "i");
    }

    // Price constraint: evaluated against authoritative Room.price for the qualifying room
    if (minPrice !== undefined || maxPrice !== undefined) {
      roomCriteria.price = {};
      if (minPrice !== undefined && !isNaN(minPrice)) {
        roomCriteria.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        roomCriteria.price.$lte = Number(maxPrice);
      }
    }

    // Availability constraint: same room must not be booked during [checkIn, checkOut)
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        // Find blocked rooms using Phase 5 half-open interval overlap rules:
        // existing.checkIn < requestedCheckOut AND existing.checkOut > requestedCheckIn
        // Blocking statuses: PENDING, CONFIRMED (CANCELLED and COMPLETED do not block)
        const blockedRoomIds = await Booking.distinct("room", {
          status: { $in: ["PENDING", "CONFIRMED"] },
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate }
        });

        if (blockedRoomIds && blockedRoomIds.length > 0) {
          roomCriteria._id = { $nin: blockedRoomIds };
        }
      }
    }

    // Single indexed query to find all property IDs having at least ONE room satisfying ALL constraints simultaneously
    const qualifyingPropertyIds = await Room.distinct("property", roomCriteria);

    // Apply qualifying property IDs to the Listing query
    if (filter._id) {
      filter._id = { $in: qualifyingPropertyIds, ...filter._id };
    } else {
      filter._id = { $in: qualifyingPropertyIds };
    }
  } else {
    // If no room-level constraints, but price filter is supplied at listing level:
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && !isNaN(minPrice)) {
        filter.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        filter.price.$lte = Number(maxPrice);
      }
    }
  }

  // 7. Amenities: match property-level amenities
  if (amenityList.length > 0) {
    const amenityRegexes = amenityList.map((a) => new RegExp(`^${escapeRegex(a)}$`, "i"));
    filter.amenities = { $all: amenityRegexes };
  }

  return filter;
}

// Get all listings with validated server-side search, availability, sorting, and pagination
async function getAllListings(queryParams = {}) {
  const filter = await buildListingQuery(queryParams);

  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit, 10) || 12));
  const skip = (page - 1) * limit;

  // Sorting
  const sort = queryParams.sort || "newest";
  let sortCriteria = { createdAt: -1 };
  if (sort === "price_asc") sortCriteria = { price: 1 };
  else if (sort === "price_desc") sortCriteria = { price: -1 };
  else if (sort === "newest") sortCriteria = { createdAt: -1 };
  else if (sort === "oldest") sortCriteria = { createdAt: 1 };
  else if (sort === "title_asc") sortCriteria = { title: 1 };
  else if (sort === "title_desc") sortCriteria = { title: -1 };

  const total = await Listing.countDocuments(filter);
  const pages = Math.ceil(total / limit) || 0;

  const listings = await Listing.find(filter)
    .sort(sortCriteria)
    .skip(skip)
    .limit(limit)
    .populate("owner")
    .populate("organization");

  const pagination = {
    page,
    limit,
    total,
    pages
  };

  // Expose both array interface and structured object for 100% backward compatibility
  listings.pagination = pagination;
  listings.listings = listings;
  listings.total = total;
  listings.pages = pages;

  return listings;
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
async function createListing(listingData, user, filesOrFile) {
  const { location, country, title, price, description, propertyType, category, amenities } = listingData;

  // Geocode address to get GeoJSON [lng, lat] (Rule 8: only geocodes when creating or changing location)
  const geoResult = await mapService.geocodeLocation(location, country);

  // Process uploaded image(s)
  let rawImages = [];
  if (Array.isArray(filesOrFile) && filesOrFile.length > 0) {
    rawImages = imageService.processMultipleUploadedImages(filesOrFile);
  } else if (filesOrFile && filesOrFile.path) {
    rawImages = [imageService.processUploadedImage(filesOrFile)];
  } else {
    rawImages = [imageService.processUploadedImage(null)];
  }

  const { images: normalizedImages, primaryImage } = imageService.normalizeListingImages(rawImages);

  const newListing = new Listing({
    title,
    description,
    price: Number(price),
    location,
    country,
    propertyType: propertyType || "Apartment",
    category: category || "Rooms",
    amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : ["WiFi", "Air Conditioning"]),
    image: primaryImage || { url: imageService.DEFAULT_IMAGE_FALLBACK, filename: "default_fallback" },
    images: normalizedImages,
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
async function updateListing(id, updateData, filesOrFile) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  // If location changed, re-geocode (Rule 8: geocode ONLY when location changes)
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

  // If new image(s) provided, append & normalize
  if (filesOrFile) {
    let newRawImages = [];
    if (Array.isArray(filesOrFile) && filesOrFile.length > 0) {
      newRawImages = imageService.processMultipleUploadedImages(filesOrFile, listing.images.length);
    } else if (filesOrFile.path) {
      newRawImages = [imageService.processUploadedImage(filesOrFile, listing.images.length)];
    }

    if (newRawImages.length > 0) {
      const combined = [...listing.images, ...newRawImages];
      const { images: normalized, primaryImage } = imageService.normalizeListingImages(combined);
      listing.images = normalized;
      if (primaryImage) listing.image = primaryImage;
    }
  }

  await listing.save();
  return listing;
}

/**
 * CONSISTENCY BOUNDARY (Cloudinary & MongoDB):
 * Cloudinary is an external media store, MongoDB is our primary document store.
 * Multi-system distributed transactions are not available on standalone MongoDB.
 * 
 * Safe partial failure handling:
 * 1. Upload: Files uploaded by Multer first. If MongoDB save fails, we attempt
 *    cleanup of newly uploaded Cloudinary assets to avoid orphaned media.
 * 2. Delete: We attempt Cloudinary deletion first. If Cloudinary returns 404 or fails,
 *    we log a warning and still proceed with removing the subdocument from MongoDB,
 *    ensuring the application is never blocked by external service downtime.
 */

// Add multiple images to an existing listing
async function addListingImages(listingId, files) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new ExpressError("No image files provided for upload", 400);
  }

  const newImages = imageService.processMultipleUploadedImages(files, listing.images.length);
  const combined = [...listing.images, ...newImages];
  const { images: normalized, primaryImage } = imageService.normalizeListingImages(combined);

  listing.images = normalized;
  if (primaryImage) {
    listing.image = primaryImage;
  }

  try {
    await listing.save();
    return listing;
  } catch (err) {
    // Partial failure cleanup: attempt best-effort removal of newly uploaded Cloudinary assets
    for (const img of newImages) {
      if (img.publicId) {
        imageService.deleteCloudinaryAsset(img.publicId).catch(() => {});
      }
    }
    throw err;
  }
}

// Delete an image from a listing
async function deleteListingImage(listingId, imageId) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  const imageIndex = listing.images.findIndex(
    (img) => img._id && img._id.toString() === imageId.toString()
  );

  if (imageIndex === -1) {
    throw new ExpressError("Image not found on this property", 404);
  }

  const targetImage = listing.images[imageIndex];

  // Cloudinary safe deletion: only genuine Cloudinary assets destroyed
  // Never delete legacy seed filenames ("listingimage") or external Unsplash URLs
  if (imageService.isCloudinaryAsset(targetImage)) {
    await imageService.deleteCloudinaryAsset(targetImage);
  }

  // Remove the image from the array
  listing.images.splice(imageIndex, 1);

  // Normalize remaining images (auto-promotes first image if deleted image was primary)
  const { images: normalized, primaryImage } = imageService.normalizeListingImages(listing.images);
  listing.images = normalized;
  listing.image = primaryImage;

  await listing.save();
  return { listing, deletedImageId: imageId };
}

// Set a specific image as the primary hero image
async function setPrimaryImage(listingId, imageId) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  const target = listing.images.find(
    (img) => img._id && img._id.toString() === imageId.toString()
  );

  if (!target) {
    throw new ExpressError("Image not found on this property", 404);
  }

  // Mark only target image as primary, all others as false
  listing.images.forEach((img) => {
    img.isPrimary = img._id && img._id.toString() === imageId.toString();
  });

  listing.image = {
    url: target.url,
    filename: target.filename || ""
  };

  await listing.save();
  return listing;
}

// Reorder images for a listing
async function reorderListingImages(listingId, orderedImageIds) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
    throw new ExpressError("Invalid image ordering list", 400);
  }

  const idToStr = (id) => (id ? id.toString() : "");
  const orderMap = new Map();
  orderedImageIds.forEach((id, idx) => {
    orderMap.set(idToStr(id), idx);
  });

  // Sort images according to provided order; unmentioned images placed at the end
  listing.images.sort((a, b) => {
    const orderA = orderMap.has(idToStr(a._id)) ? orderMap.get(idToStr(a._id)) : 9999;
    const orderB = orderMap.has(idToStr(b._id)) ? orderMap.get(idToStr(b._id)) : 9999;
    return orderA - orderB;
  });

  // Assign sequential positions reflecting the newly sorted order
  listing.images.forEach((img, idx) => {
    img.position = idx;
  });

  // Re-normalize positions sequentially (0, 1, 2, ...) preserving new array order
  const { images: normalized, primaryImage } = imageService.normalizeListingImages(listing.images, { preserveOrder: true });
  listing.images = normalized;
  if (primaryImage) {
    listing.image = primaryImage;
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
  addListingImages,
  deleteListingImage,
  setPrimaryImage,
  reorderListingImages,
  destroyListing,
  buildListingQuery
};

