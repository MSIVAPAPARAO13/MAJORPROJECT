const mongoose = require("mongoose");
const Review = require("./review.js");
const Room = require("./room.js");

const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  propertyType: {
    type: String,
    enum: ["Hostel", "Hotel", "Guest House", "Apartment", "Resort", "Homestay"],
    default: "Apartment"
  },
  category: {
    type: String,
    enum: [
      "Trending",
      "Rooms",
      "Iconic Cities",
      "Mountains",
      "Castles",
      "Amazing pool",
      "Camping",
      "Farms",
      "Arctic",
      "Domes",
      "Boats",
      "Hostels"
    ],
    default: "Rooms"
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    index: true
  },
  image: {
    filename: String,
    url: String,
  },
  images: [
    {
      url: String,
      filename: String,
      isPrimary: { type: Boolean, default: false }
    }
  ],
  price: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [77.2090, 28.6139] // Standard default coordinates [lng, lat]
    }
  },
  amenities: {
    type: [String],
    default: ["WiFi", "Air Conditioning", "Free Breakfast"]
  },
  rooms: [
    {
      type: Schema.Types.ObjectId,
      ref: "Room"
    }
  ],
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review"
    }
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
    default: "ACTIVE"
  }
}, { timestamps: true });

// Middleware to cascade delete associated reviews & rooms after a listing is deleted
listingSchema.post("findOneAndDelete", async function (listing) {
  if (listing) {
    if (listing.reviews && listing.reviews.length > 0) {
      await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
    await Room.deleteMany({ property: listing._id });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
