const roomService = require("../services/roomService");
const listingService = require("../services/listingService");

module.exports.renderNewRoomForm = async (req, res) => {
  const { id } = req.params;
  const listing = await listingService.getListingById(id);
  res.render("rooms/new.ejs", { listing });
};

module.exports.createRoom = async (req, res) => {
  const { id } = req.params;
  await roomService.createRoom(id, req.body.room, req.user);
  req.flash("success", "New Room Added to Property!");
  res.redirect(`/listings/${id}`);
};

module.exports.renderEditRoomForm = async (req, res) => {
  const { id, roomId } = req.params;
  const listing = await listingService.getListingById(id);
  const room = await roomService.getRoomById(roomId);
  res.render("rooms/edit.ejs", { listing, room });
};

module.exports.updateRoom = async (req, res) => {
  const { id, roomId } = req.params;
  await roomService.updateRoom(roomId, req.body.room);
  req.flash("success", "Room Details Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyRoom = async (req, res) => {
  const { id, roomId } = req.params;
  await roomService.deleteRoom(roomId);
  req.flash("success", "Room Removed!");
  res.redirect(`/listings/${id}`);
};
