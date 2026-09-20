const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  bookingNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    index: true
  },
  property: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
    index: true
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: "Room",
    required: true,
    index: true
  },
  guest: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  guestsCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  totalNights: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerNight: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
    default: "PENDING",
    index: true
  },
  guestDetails: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  specialRequests: {
    type: String
  }
}, { timestamps: true });

// Compound indexes for fast availability overlap checks and dashboard queries
bookingSchema.index({ room: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ organization: 1, status: 1 });
bookingSchema.index({ organization: 1, createdAt: -1 }); // Optimizes recent bookings per organization
bookingSchema.index({ organization: 1, checkIn: 1, status: 1 }); // Optimizes upcoming check-ins per organization
bookingSchema.index({ organization: 1, checkOut: 1, status: 1 }); // Optimizes upcoming check-outs per organization
bookingSchema.index({ guest: 1, createdAt: -1 });

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
