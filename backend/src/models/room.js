const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  property: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
    index: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    index: true
  },
  roomNumber: {
    type: String,
    required: true,
    trim: true
  },
  roomType: {
    type: String,
    enum: ["Single", "Double", "Triple", "Dormitory", "Deluxe", "Suite"],
    required: true,
    default: "Deluxe"
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    default: 2
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  amenities: {
    type: [String],
    default: []
  },
  images: [
    {
      url: String,
      filename: String
    }
  ],
  status: {
    type: String,
    enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
    default: "AVAILABLE"
  }
}, { timestamps: true });

const Room = mongoose.model("Room", roomSchema);
module.exports = Room;
