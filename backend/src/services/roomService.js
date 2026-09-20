const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Get all rooms for a property
async function getRoomsByProperty(propertyId) {
  return await Room.find({ property: propertyId }).sort({ roomNumber: 1 });
}

// Get public rooms for a property (sanitized for public consumers)
async function getPublicRoomsByProperty(propertyId) {
  return await Room.find({ property: propertyId })
    .select("roomNumber roomType capacity price amenities status images property")
    .sort({ roomNumber: 1 });
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

  // Security: Ignore & reject any client-supplied tenant or property association
  const sanitizedData = { ...roomData };
  delete sanitizedData.property;
  delete sanitizedData.listing;
  delete sanitizedData.organization;
  delete sanitizedData.tenant;

  const { roomNumber, roomType, capacity, price, amenities, status } = sanitizedData;
  const trimmedRoomNumber = roomNumber ? roomNumber.toString().trim() : "";

  // 1. Check for duplicate room number in this property
  const existingRoom = await Room.findOne({ property: propertyId, roomNumber: trimmedRoomNumber });
  if (existingRoom) {
    throw new ExpressError(`Room number ${trimmedRoomNumber} already exists in this property`, 409);
  }

  // 2. Derive organization authoritative from parent property or user
  const derivedOrganization = property.organization || (user && user.organization) || null;

  const room = new Room({
    property: property._id,
    organization: derivedOrganization,
    roomNumber: trimmedRoomNumber,
    roomType: roomType || "Deluxe",
    capacity: Number(capacity) || 2,
    price: Number(price),
    amenities: Array.isArray(amenities) ? amenities : (amenities ? [amenities] : []),
    status: status || "AVAILABLE"
  });

  try {
    await room.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ExpressError(`Room number ${trimmedRoomNumber} already exists in this property`, 409);
    }
    throw err;
  }

  // Synchronize Listing.rooms array
  if (property.rooms && Array.isArray(property.rooms)) {
    property.rooms.push(room._id);
    await property.save();
  }

  return room;
}

// Update room
async function updateRoom(roomId, updateData, propertyId) {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }

  // Parent resource verification if propertyId provided
  if (propertyId && room.property.toString() !== propertyId.toString()) {
    throw new ExpressError("Room does not belong to the specified property", 400);
  }

  // Security: Client must NOT be able to change organization, property, or tenant
  delete updateData.property;
  delete updateData.listing;
  delete updateData.organization;
  delete updateData.tenant;
  delete updateData._id;

  // Duplicate room number check if roomNumber is being updated
  if (updateData.roomNumber && updateData.roomNumber.trim() !== room.roomNumber) {
    const trimmedNum = updateData.roomNumber.trim();
    const existing = await Room.findOne({
      property: room.property,
      roomNumber: trimmedNum,
      _id: { $ne: roomId }
    });
    if (existing) {
      throw new ExpressError(`Room number ${trimmedNum} already exists in this property`, 409);
    }
    room.roomNumber = trimmedNum;
  }

  if (updateData.roomType) room.roomType = updateData.roomType;
  if (updateData.capacity !== undefined) room.capacity = Number(updateData.capacity);
  if (updateData.price !== undefined) room.price = Number(updateData.price);
  if (updateData.status) room.status = updateData.status;
  if (updateData.amenities) {
    room.amenities = Array.isArray(updateData.amenities) ? updateData.amenities : [updateData.amenities];
  }

  try {
    await room.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ExpressError(`Room number already exists in this property`, 409);
    }
    throw err;
  }

  return room;
}

// Delete room
async function deleteRoom(roomId, propertyId) {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new ExpressError("Room not found", 404);
  }

  if (propertyId && room.property.toString() !== propertyId.toString()) {
    throw new ExpressError("Room does not belong to the specified property", 400);
  }

  // Remove reference from property
  await Listing.findByIdAndUpdate(room.property, { $pull: { rooms: room._id } });
  await Room.findByIdAndDelete(roomId);
  return room;
}

module.exports = {
  getRoomsByProperty,
  getPublicRoomsByProperty,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom
};
