const roomService = require("../services/roomService");
const listingService = require("../services/listingService");

// Helper to determine if incoming request is an API / JSON request
const isApiRequest = (req) => {
  return (
    (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    (req.baseUrl && req.baseUrl.startsWith("/api/")) ||
    (req.accepts("json") && !req.accepts("html")) ||
    Boolean(req.xhr)
  );
};

// List all rooms for a property
module.exports.listRooms = async (req, res) => {
  const { id } = req.params;
  const isApi = isApiRequest(req);

  // If public / API request, sanitize operational details
  const rooms = isApi
    ? await roomService.getPublicRoomsByProperty(id)
    : await roomService.getRoomsByProperty(id);

  if (isApi) {
    return res.json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  }

  res.redirect(`/listings/${id}`);
};

// Show a single room
module.exports.showRoom = async (req, res) => {
  const { id, roomId } = req.params;
  const room = req.room || (await roomService.getRoomById(roomId));

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      data: room
    });
  }

  res.redirect(`/listings/${id}`);
};

// Render form to add room to property
module.exports.renderNewRoomForm = async (req, res) => {
  const { id } = req.params;
  const listing = req.tenantResource || (await listingService.getListingById(id));
  res.render("rooms/new.ejs", { listing });
};

// Create new room under property
module.exports.createRoom = async (req, res) => {
  const { id } = req.params;
  const roomData = req.validatedRoom || (req.body.room || req.body);
  const room = await roomService.createRoom(id, roomData, req.user);

  if (isApiRequest(req)) {
    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: room
    });
  }

  req.flash("success", "New Room Added to Property!");
  res.redirect(`/listings/${id}`);
};

// Render form to edit room
module.exports.renderEditRoomForm = async (req, res) => {
  const { id, roomId } = req.params;
  const listing = req.tenantResource || (await listingService.getListingById(id));
  const room = req.room || (await roomService.getRoomById(roomId));
  res.render("rooms/edit.ejs", { listing, room });
};

// Update room
module.exports.updateRoom = async (req, res) => {
  const { id, roomId } = req.params;
  const roomData = req.validatedRoom || (req.body.room || req.body);
  const updatedRoom = await roomService.updateRoom(roomId, roomData, id);

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      message: "Room updated successfully",
      data: updatedRoom
    });
  }

  req.flash("success", "Room Details Updated!");
  res.redirect(`/listings/${id}`);
};

// Delete room
module.exports.destroyRoom = async (req, res) => {
  const { id, roomId } = req.params;
  await roomService.deleteRoom(roomId, id);

  if (isApiRequest(req)) {
    return res.json({
      success: true,
      message: "Room removed successfully"
    });
  }

  req.flash("success", "Room Removed!");
  res.redirect(`/listings/${id}`);
};
