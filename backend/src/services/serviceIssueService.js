const mongoose = require("mongoose");
const ServiceIssue = require("../models/serviceIssue");
const Room = require("../models/room");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const ExpressError = require("../utils/ExpressError");

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const VALID_STATUSES = ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

// Allowed forward transitions: REPORTED -> ASSIGNED -> IN_PROGRESS -> RESOLVED
// Direct resolution is allowed from any active state. Reopening is forbidden.
const ALLOWED_TRANSITIONS = {
  REPORTED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [] // Terminal state: no reopening
};

/**
 * 1. Create a new Service Issue for a specific Room under a Property
 */
async function createIssue(listingId, roomId, data, user) {
  if (!user) throw new ExpressError("Authentication required", 401);

  // Validate Listing and Room
  const listing = await Listing.findById(listingId);
  if (!listing) throw new ExpressError("Property not found", 404);

  const room = await Room.findById(roomId);
  if (!room) throw new ExpressError("Room not found", 404);

  // Verify room belongs to listing (Anti-IDOR)
  if (room.property.toString() !== listingId.toString()) {
    throw new ExpressError("Resource mismatch: Room does not belong to the specified property", 400);
  }

  // Tenant Isolation Check (for non-admin)
  if (user.role !== "ADMIN") {
    const userOrgId = user.organization?.toString();
    const roomOrgId = room.organization?.toString() || listing.organization?.toString();
    if (!userOrgId || !roomOrgId || userOrgId !== roomOrgId) {
      throw new ExpressError("Forbidden: Cannot create issues for another organization's properties", 403);
    }
  }

  // Strict anti-tampering: strip client-supplied tenant, creator, and resource IDs
  const sanitized = { ...data };
  delete sanitized.organization;
  delete sanitized.property;
  delete sanitized.room;
  delete sanitized.createdBy;
  delete sanitized._id;
  delete sanitized.resolvedAt;

  const title = (sanitized.title || "").toString().trim();
  const description = (sanitized.description || "").toString().trim();
  if (!title) throw new ExpressError("Title is required", 400);
  if (!description) throw new ExpressError("Description is required", 400);

  const priority = (sanitized.priority || "MEDIUM").toString().toUpperCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new ExpressError(`Invalid priority: must be one of [${VALID_PRIORITIES.join(", ")}]`, 400);
  }

  let status = "REPORTED";
  if (sanitized.status) {
    const requestedStatus = sanitized.status.toString().toUpperCase();
    if (!["REPORTED", "ASSIGNED"].includes(requestedStatus)) {
      throw new ExpressError("New issues must start as REPORTED or ASSIGNED", 400);
    }
    status = requestedStatus;
  }

  const authoritativeOrg = room.organization || listing.organization || user.organization;

  const issue = new ServiceIssue({
    property: listing._id,
    room: room._id,
    organization: authoritativeOrg,
    title,
    description,
    priority,
    status,
    createdBy: user._id,
    assignedTo: sanitized.assignedTo || null
  });

  await issue.save();
  return issue;
}

/**
 * 2. Get all Service Issues for a Room
 */
async function getIssuesForRoom(roomId, listingId, user) {
  const room = await Room.findById(roomId);
  if (!room) throw new ExpressError("Room not found", 404);

  if (listingId && room.property.toString() !== listingId.toString()) {
    throw new ExpressError("Resource mismatch: Room does not belong to specified property", 400);
  }

  const query = { room: roomId };
  if (user && user.role !== "ADMIN") {
    if (!user.organization) throw new ExpressError("User has no organization assignment", 403);
    query.organization = user.organization;
  }

  return await ServiceIssue.find(query)
    .sort({ createdAt: -1 })
    .populate("createdBy", "username email")
    .populate("assignedTo", "username email")
    .lean();
}

/**
 * 3. Get Active Service Issues for an Organization
 */
async function getIssuesForOrganization(organizationId, filter = {}) {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
  const query = { organization: orgObjectId };

  if (filter.status) {
    query.status = filter.status;
  } else if (filter.unresolvedOnly) {
    query.status = { $in: ["REPORTED", "ASSIGNED", "IN_PROGRESS"] };
  }

  return await ServiceIssue.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .populate("property", "title location")
    .populate("room", "roomNumber roomType status")
    .populate("createdBy", "username")
    .populate("assignedTo", "username")
    .limit(filter.limit || 50)
    .lean();
}

/**
 * 4. Get a single Service Issue by ID with Tenant and Resource Validation
 */
async function getIssueById(issueId, user) {
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    throw new ExpressError("Invalid issue ID", 400);
  }

  const issue = await ServiceIssue.findById(issueId)
    .populate("property", "title location organization")
    .populate("room", "roomNumber roomType status organization")
    .populate("createdBy", "username email")
    .populate("assignedTo", "username email");

  if (!issue) throw new ExpressError("Service issue not found", 404);

  // Tenant Isolation Enforcement
  if (user && user.role !== "ADMIN") {
    const userOrgId = user.organization?.toString();
    const issueOrgId = issue.organization?.toString();
    if (!userOrgId || !issueOrgId || userOrgId !== issueOrgId) {
      throw new ExpressError("Forbidden: Cannot access issue from another organization", 403);
    }
  }

  return issue;
}

/**
 * 5. Update a Service Issue (Strict State Machine & Anti-Tampering)
 */
async function updateIssue(issueId, data, user) {
  const issue = await getIssueById(issueId, user);

  // Strip non-updatable fields
  delete data.organization;
  delete data.property;
  delete data.room;
  delete data.createdBy;
  delete data._id;

  // State Transition Validation
  if (data.status && data.status !== issue.status) {
    const nextStatus = data.status.toString().toUpperCase();
    if (!VALID_STATUSES.includes(nextStatus)) {
      throw new ExpressError(`Invalid status: must be one of [${VALID_STATUSES.join(", ")}]`, 400);
    }

    if (issue.status === "RESOLVED") {
      throw new ExpressError("Resolved issues cannot be modified or reopened", 400);
    }

    const allowedNext = ALLOWED_TRANSITIONS[issue.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new ExpressError(`Invalid status transition from ${issue.status} to ${nextStatus}`, 400);
    }

    issue.status = nextStatus;
    if (nextStatus === "RESOLVED") {
      issue.resolvedAt = new Date();
    }
  }

  if (data.title) {
    const trimmedTitle = data.title.toString().trim();
    if (!trimmedTitle) throw new ExpressError("Title cannot be empty", 400);
    issue.title = trimmedTitle;
  }

  if (data.description) {
    const trimmedDesc = data.description.toString().trim();
    if (!trimmedDesc) throw new ExpressError("Description cannot be empty", 400);
    issue.description = trimmedDesc;
  }

  if (data.priority) {
    const prio = data.priority.toString().toUpperCase();
    if (!VALID_PRIORITIES.includes(prio)) {
      throw new ExpressError(`Invalid priority: must be one of [${VALID_PRIORITIES.join(", ")}]`, 400);
    }
    issue.priority = prio;
  }

  if (data.assignedTo !== undefined) {
    issue.assignedTo = data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo.toString()) : null;
  }

  await issue.save();
  return issue;
}

/**
 * 6. Resolve a Service Issue directly
 */
async function resolveIssue(issueId, user) {
  return await updateIssue(issueId, { status: "RESOLVED" }, user);
}

/**
 * 7. Dynamic Guest Readiness Calculation (Zero DB Persistence)
 */
async function getRoomReadiness(roomId) {
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ExpressError("Invalid room ID", 400);
  }

  const room = await Room.findById(roomId).lean();
  if (!room) throw new ExpressError("Room not found", 404);

  // Check for unresolved issues (priority sort: HIGH first)
  const unresolvedIssue = await ServiceIssue.findOne({
    room: roomId,
    status: { $in: ["REPORTED", "ASSIGNED", "IN_PROGRESS"] }
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  if (unresolvedIssue) {
    return {
      isGuestReady: false,
      reason: `Unresolved ${unresolvedIssue.priority} priority issue: "${unresolvedIssue.title}"`,
      issue: unresolvedIssue
    };
  }

  // If no unresolved issues, check physical room status
  if (room.status !== "AVAILABLE") {
    return {
      isGuestReady: false,
      reason: `Room physical status is ${room.status}`,
      issue: null
    };
  }

  return {
    isGuestReady: true,
    reason: "Ready for check-in",
    issue: null
  };
}

/**
 * 8. Dynamic Guest Impact Alert Engine (Zero N+1 Query Loops)
 */
async function getGuestImpactAlerts(organizationId) {
  if (!organizationId) return [];

  const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Step 1: Query relevant active upcoming bookings (Single indexed tenant-scoped query)
  const upcomingBookings = await Booking.find({
    organization: orgObjectId,
    checkIn: { $gte: startOfToday },
    status: { $in: ["PENDING", "CONFIRMED"] }
  })
    .sort({ checkIn: 1 })
    .populate("property", "title location")
    .populate("room", "roomNumber roomType status")
    .populate("guest", "username email")
    .lean();

  if (!upcomingBookings || upcomingBookings.length === 0) {
    return [];
  }

  // Step 2: Extract room IDs to batch query issues
  const roomIds = [
    ...new Set(
      upcomingBookings
        .map((b) => b.room?._id)
        .filter(Boolean)
        .map((id) => id.toString())
    )
  ];

  if (roomIds.length === 0) return [];

  // Step 3: Query all unresolved issues for these rooms in a single query (Zero N+1)
  const unresolvedIssues = await ServiceIssue.find({
    organization: orgObjectId,
    room: { $in: roomIds },
    status: { $in: ["REPORTED", "ASSIGNED", "IN_PROGRESS"] }
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  if (!unresolvedIssues || unresolvedIssues.length === 0) {
    return [];
  }

  // Step 4: Group issues by room ID in memory
  const issuesByRoom = {};
  for (const issue of unresolvedIssues) {
    const rId = issue.room.toString();
    if (!issuesByRoom[rId]) {
      issuesByRoom[rId] = [];
    }
    issuesByRoom[rId].push(issue);
  }

  // Step 5: Derive deterministic alerts
  const alerts = [];
  for (const booking of upcomingBookings) {
    if (!booking.room) continue;
    const rId = booking.room._id.toString();
    const roomIssues = issuesByRoom[rId];

    if (roomIssues && roomIssues.length > 0) {
      const topIssue = roomIssues[0];
      const checkInDateFormatted = new Date(booking.checkIn).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric"
      });

      alerts.push({
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guest?.username || (booking.guestDetails && booking.guestDetails.name) || "Upcoming Guest",
        guestEmail: booking.guest?.email || (booking.guestDetails && booking.guestDetails.email) || "",
        checkInDate: booking.checkIn,
        checkInFormatted: checkInDateFormatted,
        roomId: booking.room._id,
        roomNumber: booking.room.roomNumber,
        propertyId: booking.property?._id,
        propertyTitle: booking.property?.title || "Property",
        issueId: topIssue._id,
        issueTitle: topIssue.title,
        issuePriority: topIssue.priority,
        issueStatus: topIssue.status,
        severity: topIssue.priority, // HIGH, MEDIUM, LOW
        explanation: `Guest arrives ${checkInDateFormatted} but Room ${booking.room.roomNumber} has an unresolved ${topIssue.priority} priority issue: "${topIssue.title}".`
      });
    }
  }

  return alerts;
}

module.exports = {
  createIssue,
  getIssuesForRoom,
  getIssuesForOrganization,
  getIssueById,
  updateIssue,
  resolveIssue,
  getRoomReadiness,
  getGuestImpactAlerts
};
