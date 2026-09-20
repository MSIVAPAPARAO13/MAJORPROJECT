const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const {
  isLoggedIn,
  isOwner,
  validateRoom,
  requirePermission,
  requireTenantAccess,
  validateRoomBelongsToListing
} = require("../middleware");
const { PERMISSIONS } = require("../config/permissions");
const roomController = require("../controllers/roomController");

// 1. Browse All Rooms for Property (PUBLIC)
router.get("/", wrapAsync(roomController.listRooms));

// 2. Render Form to Add Room (Protected by Tenant Isolation, ROOM_CREATE, and Ownership)
router.get(
  "/new",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.ROOM_CREATE),
  isOwner,
  wrapAsync(roomController.renderNewRoomForm)
);

// 3. Create New Room under Property (Protected by Tenant Isolation, ROOM_CREATE, and Ownership)
router.post(
  "/",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.ROOM_CREATE),
  isOwner,
  validateRoom,
  wrapAsync(roomController.createRoom)
);

// 4. Show Specific Room (PUBLIC with parent relationship verification)
router.get("/:roomId", validateRoomBelongsToListing, wrapAsync(roomController.showRoom));

// 5. Render Form to Edit Room (Protected by Tenant Isolation, ROOM_UPDATE, Ownership, and Parent Resource Check)
router.get(
  "/:roomId/edit",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.ROOM_UPDATE),
  isOwner,
  validateRoomBelongsToListing,
  wrapAsync(roomController.renderEditRoomForm)
);

// 6. Update Room (Protected by Tenant Isolation, ROOM_UPDATE, Ownership, Parent Resource Check, and Validation)
router.put(
  "/:roomId",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.ROOM_UPDATE),
  isOwner,
  validateRoomBelongsToListing,
  validateRoom,
  wrapAsync(roomController.updateRoom)
);

// 7. Delete Room (Protected by Tenant Isolation, ROOM_DELETE, Ownership, and Parent Resource Check)
router.delete(
  "/:roomId",
  isLoggedIn,
  requireTenantAccess("Listing"),
  requirePermission(PERMISSIONS.ROOM_DELETE),
  isOwner,
  validateRoomBelongsToListing,
  wrapAsync(roomController.destroyRoom)
);

module.exports = router;
