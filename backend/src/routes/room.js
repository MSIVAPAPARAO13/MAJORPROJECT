const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn, isOwner, validateRoom } = require("../middleware");
const roomController = require("../controllers/roomController");

// Render form to add room to property
router.get("/new", isLoggedIn, isOwner, wrapAsync(roomController.renderNewRoomForm));

// Create new room under property
router.post("/", isLoggedIn, isOwner, validateRoom, wrapAsync(roomController.createRoom));

// Render form to edit room
router.get("/:roomId/edit", isLoggedIn, isOwner, wrapAsync(roomController.renderEditRoomForm));

// Update room
router.put("/:roomId", isLoggedIn, isOwner, validateRoom, wrapAsync(roomController.updateRoom));

// Delete room
router.delete("/:roomId", isLoggedIn, isOwner, wrapAsync(roomController.destroyRoom));

module.exports = router;
