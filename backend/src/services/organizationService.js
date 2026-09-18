const Organization = require("../models/organization");
const Listing = require("../models/listing");
const Room = require("../models/room");
const Booking = require("../models/booking");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");

// Create organization and assign owner
async function createOrganization(orgData, ownerUser) {
  const { name, description, contactEmail, phone, address } = orgData;

  const organization = new Organization({
    name: name.trim(),
    description,
    owner: ownerUser._id,
    members: [{ user: ownerUser._id, role: "OWNER" }],
    contactEmail: contactEmail || ownerUser.email,
    phone,
    address
  });

  await organization.save();

  // Update user role to OWNER and attach organization
  ownerUser.role = "OWNER";
  ownerUser.organization = organization._id;
  await ownerUser.save();

  return organization;
}

// Get organization by ID
async function getOrganizationById(orgId) {
  const org = await Organization.findById(orgId).populate("owner").populate("members.user");
  if (!org) {
    throw new ExpressError("Organization not found", 404);
  }
  return org;
}

// Calculate real metrics for Owner / Manager dashboard
async function getOwnerDashboardMetrics(userId) {
  // Find properties owned directly or via organization
  const user = await User.findById(userId);
  const query = user.organization 
    ? { $or: [{ owner: userId }, { organization: user.organization }] }
    : { owner: userId };

  const properties = await Listing.find(query).sort({ createdAt: -1 });
  const propertyIds = properties.map(p => p._id);

  const rooms = await Room.find({ property: { $in: propertyIds } });
  const roomIds = rooms.map(r => r._id);

  const bookings = await Booking.find({ property: { $in: propertyIds } })
    .populate("property")
    .populate("room")
    .populate("guest")
    .sort({ checkIn: -1 });

  const activeBookings = bookings.filter(b => b.status === "CONFIRMED");
  const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  // Calculate real occupancy: active bookings overlapping today / total rooms
  const today = new Date();
  const todayOccupiedCount = activeBookings.filter(b => b.checkIn <= today && b.checkOut >= today).length;
  const occupancyRate = rooms.length > 0 ? Math.round((todayOccupiedCount / rooms.length) * 100) : 0;

  // Upcoming check-ins within the next 7 days
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingCheckIns = activeBookings.filter(b => b.checkIn >= today && b.checkIn <= nextWeek);

  return {
    properties,
    totalProperties: properties.length,
    rooms,
    totalRooms: rooms.length,
    bookings,
    totalBookings: bookings.length,
    activeBookingsCount: activeBookings.length,
    totalRevenue,
    occupancyRate,
    upcomingCheckIns
  };
}

// Calculate platform-wide metrics for Admin dashboard
async function getAdminDashboardMetrics() {
  const totalUsers = await User.countDocuments();
  const totalOrganizations = await Organization.countDocuments();
  const totalProperties = await Listing.countDocuments();
  const totalRooms = await Room.countDocuments();
  const totalBookings = await Booking.countDocuments();

  const confirmedBookings = await Booking.find({ status: "CONFIRMED" });
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  const recentBookings = await Booking.find()
    .populate("property")
    .populate("guest")
    .sort({ createdAt: -1 })
    .limit(10);

  const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);

  return {
    totalUsers,
    totalOrganizations,
    totalProperties,
    totalRooms,
    totalBookings,
    totalRevenue,
    recentBookings,
    recentUsers
  };
}

module.exports = {
  createOrganization,
  getOrganizationById,
  getOwnerDashboardMetrics,
  getAdminDashboardMetrics
};
