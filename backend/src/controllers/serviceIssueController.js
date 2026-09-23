const serviceIssueService = require("../services/serviceIssueService");
const Room = require("../models/room");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

function isJsonRequest(req) {
  return Boolean(
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    Boolean(req.headers && req.headers.accept && req.headers.accept.includes("application/json")) ||
    Boolean(req.headers && req.headers["content-type"] && req.headers["content-type"].includes("application/json")) ||
    Boolean(req.accepts && req.accepts("json") && req.xhr)
  );
}

// 1. List Issues for a Room
async function listRoomIssues(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;

  const [issues, readiness, room, listing] = await Promise.all([
    serviceIssueService.getIssuesForRoom(roomId, listingId, req.user),
    serviceIssueService.getRoomReadiness(roomId),
    Room.findById(roomId).lean(),
    Listing.findById(listingId).lean()
  ]);

  if (!room) throw new ExpressError("Room not found", 404);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      data: {
        room: {
          _id: room._id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          status: room.status
        },
        readiness,
        issues
      }
    });
  }

  res.render("issues/index.ejs", {
    issues,
    readiness,
    room,
    listing,
    listingId,
    roomId
  });
}

// 2. Render Form to Create a Service Issue
async function renderNewIssueForm(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;

  const [room, listing] = await Promise.all([
    Room.findById(roomId).lean(),
    Listing.findById(listingId).lean()
  ]);

  if (!room) throw new ExpressError("Room not found", 404);

  res.render("issues/new.ejs", {
    room,
    listing,
    listingId,
    roomId
  });
}

// 3. Create a Service Issue
async function createIssue(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;
  const issueData = req.body.issue || req.body;

  const newIssue = await serviceIssueService.createIssue(listingId, roomId, issueData, req.user);

  if (isJsonRequest(req)) {
    return res.status(201).json({
      success: true,
      message: "Service issue reported successfully",
      data: newIssue
    });
  }

  req.flash("success", "Service issue reported successfully");
  res.redirect(`/listings/${listingId}/rooms/${roomId}/issues`);
}

// 4. Show a Single Service Issue
async function showIssue(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;
  const issueId = req.params.issueId;

  const issue = await serviceIssueService.getIssueById(issueId, req.user);

  // Validate room and property match if nested route accessed
  if (roomId && issue.room?._id.toString() !== roomId.toString()) {
    throw new ExpressError("Resource mismatch: Issue does not belong to specified room", 400);
  }
  if (listingId && issue.property?._id.toString() !== listingId.toString()) {
    throw new ExpressError("Resource mismatch: Issue does not belong to specified property", 400);
  }

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      data: issue
    });
  }

  res.render("issues/show.ejs", {
    issue,
    listingId,
    roomId,
    room: issue.room,
    property: issue.property
  });
}

// 5. Update a Service Issue
async function updateIssue(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;
  const issueId = req.params.issueId;
  const updateData = req.body.issue || req.body;

  const updated = await serviceIssueService.updateIssue(issueId, updateData, req.user);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Service issue updated successfully",
      data: updated
    });
  }

  req.flash("success", "Service issue updated successfully");
  res.redirect(`/listings/${listingId}/rooms/${roomId}/issues/${issueId}`);
}

// 6. Resolve a Service Issue
async function resolveIssue(req, res) {
  const listingId = req.params.id;
  const roomId = req.params.roomId;
  const issueId = req.params.issueId;

  const resolved = await serviceIssueService.resolveIssue(issueId, req.user);

  if (isJsonRequest(req)) {
    return res.json({
      success: true,
      message: "Service issue marked as RESOLVED",
      data: resolved
    });
  }

  req.flash("success", "Service issue marked as RESOLVED");
  res.redirect(`/listings/${listingId}/rooms/${roomId}/issues`);
}

// 7. Dynamic Room Readiness API Endpoint
async function getRoomReadiness(req, res) {
  const roomId = req.params.roomId;
  const readiness = await serviceIssueService.getRoomReadiness(roomId);

  return res.json({
    success: true,
    data: readiness
  });
}

// 8. Dynamic Guest Impact Alerts API Endpoint
async function getGuestImpactAlerts(req, res) {
  const orgId = req.user.role === "ADMIN" && req.query.organization
    ? req.query.organization
    : req.user.organization;

  if (!orgId) {
    return res.status(400).json({ success: false, message: "Organization scope is required" });
  }

  const alerts = await serviceIssueService.getGuestImpactAlerts(orgId);

  return res.json({
    success: true,
    count: alerts.length,
    data: alerts
  });
}

module.exports = {
  listRoomIssues,
  renderNewIssueForm,
  createIssue,
  showIssue,
  updateIssue,
  resolveIssue,
  getRoomReadiness,
  getGuestImpactAlerts
};
