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
