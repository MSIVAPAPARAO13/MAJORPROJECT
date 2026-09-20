const mongoose = require("mongoose");
const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

/**
 * Validates that the requested room exists and strictly belongs to the specified parent property/listing.
 * Prevents nested-resource IDOR attacks.
 */
async function validateRoomBelongsToListing(req, res, next) {
  const listingId = req.params.id || req.params.listingId;
  const roomId = req.params.roomId;

  // 1. Validate ObjectIds
  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
    if (req.accepts("json") && req.xhr) {
      return res.status(400).json({ success: false, message: "Invalid property ID" });
    }
    throw new ExpressError("Invalid property ID", 400);
  }

  if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
    if (req.accepts("json") && req.xhr) {
      return res.status(400).json({ success: false, message: "Invalid room ID" });
    }
    throw new ExpressError("Invalid room ID", 400);
  }

  // 2. Fetch the room
  const room = await Room.findById(roomId);
  if (!room) {
    if (req.accepts("json") && req.xhr) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    req.flash("error", "Room not found");
    return res.redirect(`/listings/${listingId}`);
  }

  // 3. Verify room.property matches listingId (Nested IDOR check)
  const roomPropertyId = room.property ? room.property.toString() : null;
  if (!roomPropertyId || roomPropertyId !== listingId.toString()) {
    if (req.accepts("json") && req.xhr) {
      return res.status(400).json({
        success: false,
        message: "Resource mismatch: This room does not belong to the specified property."
      });
    }
    req.flash("error", "Security violation: Room does not belong to this property.");
    return res.redirect(`/listings/${listingId}`);
  }

  // 4. Attach verified room to req
  req.room = room;
  next();
}

module.exports = {
  validateRoomBelongsToListing
};
