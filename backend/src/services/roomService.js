const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Get all rooms for a property
async function getRoomsByProperty(propertyId) {
  return await Room.find({ property: propertyId }).sort({ roomNumber: 1 });
}

// Get single room by ID
async function getRoomById(roomId) {
  const room = await Room.findById(roomId).populate("property");
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }
  return room;
}

// Create new room under a property
async function createRoom(propertyId, roomData, user) {
  const property = await Listing.findById(propertyId);
  if (!property) {
    throw new ExpressError("Property not found", 404);
  }

  const { roomNumber, roomType, capacity, price, amenities, status } = roomData;

  // Check for duplicate room number in this property
  const existingRoom = await Room.findOne({ property: propertyId, roomNumber: roomNumber.trim() });
  if (existingRoom) {
    throw new ExpressError(`Room number ${roomNumber} already exists in this property`, 400);
  }

  const room = new Room({
    property: propertyId,
    organization: property.organization || user.organization || null,
    roomNumber: roomNumber.trim(),
    roomType: roomType || "Deluxe",
    capacity: Number(capacity) || 2,
    price: Number(price),
    amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
    status: status || "AVAILABLE"
  });

  await room.save();

  // Add room reference to listing
  property.rooms.push(room._id);
  await property.save();

  return room;
}

// Update room
async function updateRoom(roomId, updateData) {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }

  if (updateData.roomNumber) room.roomNumber = updateData.roomNumber.trim();
  if (updateData.roomType) room.roomType = updateData.roomType;
  if (updateData.capacity) room.capacity = Number(updateData.capacity);
  if (updateData.price) room.price = Number(updateData.price);
  if (updateData.status) room.status = updateData.status;
  if (updateData.amenities) {
    room.amenities = Array.isArray(updateData.amenities) ? updateData.amenities : [updateData.amenities];
  }

  await room.save();
  return room;
}

// Delete room
async function deleteRoom(roomId) {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }

  // Remove reference from property
  await Listing.findByIdAndUpdate(room.property, { $pull: { rooms: room._id } });
  await Room.findByIdAndDelete(roomId);
  return room;
}

module.exports = {
  getRoomsByProperty,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom
};
