const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Room = require("../models/room");
const Listing = require("../models/listing");
const User = require("../models/user");
const Organization = require("../models/organization");
const ExpressError = require("../utils/ExpressError");

/**
 * Phase 8 Canonical Dashboard Service
 *
 * Core Principles:
 * 1. Read-Only: Never mutates bookings, rooms, properties, users, or organizations.
 * 2. Tenant-Scoped: Aggregations use server-derived organization ObjectId; never user input.
 * 3. Zero N+1: Bounded database queries using MongoDB aggregation pipelines.
 * 4. Distinct Semantics:
 *    - Analytics period: applied to booking volumes, booking values, and status distributions.
 *    - Operational metrics: evaluated against current time (today's check-ins, check-outs, in-house guests).
 *    - Booking Value: distinguishes realized value (CONFIRMED + COMPLETED) from pipeline value (PENDING)
 *      and excludes CANCELLED bookings.
 */

// Helper to calculate analytics period date bounds
function getAnalyticsDateFilter(options = {}) {
  const preset = options.preset || "30d";
  const now = new Date();
  let startDate = null;
  let endDate = new Date();

  if (preset === "custom" && options.startDate && options.endDate) {
    startDate = new Date(options.startDate);
    endDate = new Date(options.endDate);
  } else if (preset === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (preset === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (preset === "90d") {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (preset === "all") {
    return { filter: {}, label: "All Time", startDate: null, endDate: null };
  }

  const PRESET_LABELS = {
    today: "Today",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    all: "All Time"
  };

  if (startDate && endDate) {
    return {
      filter: { createdAt: { $gte: startDate, $lte: endDate } },
      label: preset === "custom"
        ? `${startDate.toISOString().split("T")[0]} - ${endDate.toISOString().split("T")[0]}`
        : (PRESET_LABELS[preset] || preset.toUpperCase()),
      startDate,
      endDate
    };
  }
  return { filter: {}, label: "All Time", startDate: null, endDate: null };
}

// Operational current-time bounds
function getOperationalTimeBounds() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { now, startOfToday, endOfToday };
}

// =========================================================================
// 1. ORGANIZATION DASHBOARD (OWNER / MANAGER)
// =========================================================================
async function getOrganizationDashboard(organizationId, filterOptions = {}) {
  if (!organizationId) {
    throw new ExpressError("Organization scope is required for tenant dashboard", 400);
  }
  const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
  const { filter: dateMatch, label: dateLabel, startDate, endDate } = getAnalyticsDateFilter(filterOptions);
  const { now, startOfToday, endOfToday } = getOperationalTimeBounds();

  // Parallel Execution: Bounded aggregation pipelines
  const [
    propertyStats,
    roomStatusStats,
    bookingStatusAgg,
    operationalStats,
    upcomingCheckIns,
    upcomingCheckOuts,
    recentBookings,
    propertyBreakdown
  ] = await Promise.all([
    // A. Property count in organization
    Listing.countDocuments({ organization: orgObjectId }),

    // B. Room physical status counts
    Room.aggregate([
      { $match: { organization: orgObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),

    // C. Booking Status & Booking Value breakdown in selected analytics period
    Booking.aggregate([
      {
        $match: {
          organization: orgObjectId,
          ...dateMatch
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" }
        }
      }
    ]),

    // D. Operational stats (Current occupancy & Today's arrivals/departures)
    Booking.aggregate([
      {
        $match: {
          organization: orgObjectId,
          status: { $in: ["PENDING", "CONFIRMED"] }
        }
      },
      {
        $group: {
          _id: null,
          inHouseCount: {
            $sum: {
              $cond: [
                { $and: [{ $lte: ["$checkIn", now] }, { $gt: ["$checkOut", now] }] },
                1,
                0
              ]
            }
          },
          todayArrivalsCount: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$checkIn", startOfToday] }, { $lte: ["$checkIn", endOfToday] }] },
                1,
                0
              ]
            }
          },
          todayDeparturesCount: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$checkOut", startOfToday] }, { $lte: ["$checkOut", endOfToday] }] },
                1,
                0
              ]
            }
          },
          activeUpcomingCount: {
            $sum: {
              $cond: [{ $gte: ["$checkIn", now] }, 1, 0]
            }
          }
        }
      }
    ]),

    // E. Upcoming check-ins (limit 10)
    Booking.find({
      organization: orgObjectId,
      checkIn: { $gte: now },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkIn: 1 })
      .limit(10)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType")
      .populate("guest", "username email")
      .lean(),

    // F. Upcoming check-outs (limit 10)
    Booking.find({
      organization: orgObjectId,
      checkOut: { $gte: now },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkOut: 1 })
      .limit(10)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType")
      .populate("guest", "username email")
      .lean(),

    // G. Recent bookings (limit 10)
    Booking.find({
      organization: orgObjectId
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType")
      .populate("guest", "username email")
      .lean(),

    // H. Property Performance Breakdown (Zero N+1: single aggregation joins rooms and bookings)
    Listing.aggregate([
      { $match: { organization: orgObjectId } },
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "property",
          as: "propertyRooms"
        }
      },
      {
        $lookup: {
          from: "bookings",
          let: { propId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$property", "$$propId"] },
                ...dateMatch
              }
            }
          ],
          as: "periodBookings"
        }
      },
      {
        $project: {
          title: 1,
          location: 1,
          country: 1,
          propertyType: 1,
          price: 1,
          roomCount: { $size: "$propertyRooms" },
          bookingCount: { $size: "$periodBookings" },
          confirmedValue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$periodBookings",
                    as: "b",
                    cond: { $in: ["$$b.status", ["CONFIRMED", "COMPLETED"]] }
                  }
                },
                as: "cb",
                in: "$$cb.totalPrice"
              }
            }
          },
          pendingValue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$periodBookings",
                    as: "b",
                    cond: { $eq: ["$$b.status", "PENDING"] }
                  }
                },
                as: "pb",
                in: "$$pb.totalPrice"
              }
            }
          }
        }
      },
      { $sort: { bookingCount: -1, title: 1 } },
      { $limit: 25 }
    ])
  ]);

  // Format Room Physical Statuses
  let totalRooms = 0;
  let availableRooms = 0;
  let occupiedRoomsPhysical = 0;
  let maintenanceRooms = 0;

  for (const r of roomStatusStats) {
    totalRooms += r.count;
    if (r._id === "AVAILABLE") availableRooms = r.count;
    else if (r._id === "OCCUPIED") occupiedRoomsPhysical = r.count;
    else if (r._id === "MAINTENANCE") maintenanceRooms = r.count;
  }

  // Format Booking Status & Value Metrics
  let totalPeriodBookings = 0;
  let confirmedCompletedValue = 0;
  let pendingPipelineValue = 0;
  let cancelledValue = 0;
  const statusCounts = {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0
  };

  for (const b of bookingStatusAgg) {
    statusCounts[b._id] = b.count;
    totalPeriodBookings += b.count;
    if (b._id === "CONFIRMED" || b._id === "COMPLETED") {
      confirmedCompletedValue += b.totalValue;
    } else if (b._id === "PENDING") {
      pendingPipelineValue += b.totalValue;
    } else if (b._id === "CANCELLED") {
      cancelledValue += b.totalValue;
    }
  }

  const opData = operationalStats[0] || {
    inHouseCount: 0,
    todayArrivalsCount: 0,
    todayDeparturesCount: 0,
    activeUpcomingCount: 0
  };

  // Date-Aware Occupancy Calculation:
  // In-house guests currently occupying rooms / totalRooms
  const currentOccupancyRate = totalRooms > 0
    ? Number(((opData.inHouseCount / totalRooms) * 100).toFixed(1))
    : 0;

  return {
    organizationId: orgObjectId.toString(),
    dateFilter: {
      preset: filterOptions.preset || "30d",
      label: dateLabel,
      startDate,
      endDate
    },
    summary: {
      totalProperties: propertyStats,
      totalRooms,
      availableRooms,
      occupiedRoomsPhysical,
      maintenanceRooms,
      currentlyOccupied: opData.inHouseCount,
      currentOccupancyRate,
      totalBookings: totalPeriodBookings,
      activeUpcomingBookings: opData.activeUpcomingCount,
      todayArrivals: opData.todayArrivalsCount,
      todayDepartures: opData.todayDeparturesCount,
      // Precise financial semantics: Booking Value, not Net Revenue
      confirmedCompletedValue,
      pendingPipelineValue,
      totalBookingValue: confirmedCompletedValue + pendingPipelineValue,
      cancelledValue
    },
    bookingStatusBreakdown: statusCounts,
    upcomingCheckIns,
    upcomingCheckOuts,
    recentBookings,
    propertyBreakdown
  };
}

// =========================================================================
// 2. STAFF OPERATIONAL DASHBOARD
// =========================================================================
async function getStaffDashboard(organizationId) {
  if (!organizationId) {
    throw new ExpressError("Organization scope is required for staff operational dashboard", 400);
  }
  const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
  const { now, startOfToday, endOfToday } = getOperationalTimeBounds();

  // Parallel Execution of purely operational data (zero revenue/financials exposed)
  const [
    todayArrivals,
    todayDepartures,
    inHouseBookings,
    roomInventory,
    maintenanceRooms
  ] = await Promise.all([
    // 1. Today's Arrivals
    Booking.find({
      organization: orgObjectId,
      checkIn: { $gte: startOfToday, $lte: endOfToday },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkIn: 1 })
      .limit(20)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType capacity")
      .populate("guest", "username email")
      .lean(),

    // 2. Today's Departures
    Booking.find({
      organization: orgObjectId,
      checkOut: { $gte: startOfToday, $lte: endOfToday },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkOut: 1 })
      .limit(20)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType")
      .populate("guest", "username email")
      .lean(),

    // 3. Current In-House Guests
    Booking.find({
      organization: orgObjectId,
      checkIn: { $lte: now },
      checkOut: { $gt: now },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkOut: 1 })
      .limit(25)
      .populate("property", "title location")
      .populate("room", "roomNumber roomType")
      .populate("guest", "username email")
      .lean(),

    // 4. Room Operational Counts
    Room.aggregate([
      { $match: { organization: orgObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),

    // 5. Rooms Currently in Maintenance
    Room.find({
      organization: orgObjectId,
      status: "MAINTENANCE"
    })
      .populate("property", "title location")
      .limit(20)
      .lean()
  ]);

  const roomStatus = {
    AVAILABLE: 0,
    OCCUPIED: 0,
    MAINTENANCE: 0,
    total: 0
  };

  for (const r of roomInventory) {
    roomStatus[r._id] = r.count;
    roomStatus.total += r.count;
  }

  return {
    organizationId: orgObjectId.toString(),
    operationalDate: startOfToday.toISOString().split("T")[0],
    summary: {
      todayArrivalsCount: todayArrivals.length,
      todayDeparturesCount: todayDepartures.length,
      inHouseGuestsCount: inHouseBookings.length,
      availableRoomsCount: roomStatus.AVAILABLE,
      occupiedRoomsCount: roomStatus.OCCUPIED,
      maintenanceRoomsCount: roomStatus.MAINTENANCE,
      totalRoomsCount: roomStatus.total
    },
    todayArrivals,
    todayDepartures,
    inHouseBookings,
    maintenanceRooms
  };
}

// =========================================================================
// 3. CUSTOMER DASHBOARD (OWN BOOKINGS ONLY)
// =========================================================================
async function getCustomerDashboard(userId, filterOptions = {}) {
  if (!userId) {
    throw new ExpressError("Authentication required for customer dashboard", 401);
  }
  const userObjectId = new mongoose.Types.ObjectId(userId.toString());
  const now = new Date();

  // Parallel lookup of user's own bookings
  const [
    upcomingTrips,
    activeStays,
    pastStays,
    cancelledTrips,
    valueAgg
  ] = await Promise.all([
    // Upcoming trips: checkIn >= now and active
    Booking.find({
      guest: userObjectId,
      checkIn: { $gte: now },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .sort({ checkIn: 1 })
      .populate("property", "title location country image images")
      .populate("room", "roomNumber roomType")
      .lean(),

    // Current active stays
    Booking.find({
      guest: userObjectId,
      checkIn: { $lte: now },
      checkOut: { $gt: now },
      status: { $in: ["PENDING", "CONFIRMED"] }
    })
      .populate("property", "title location country image images")
      .populate("room", "roomNumber roomType")
      .lean(),

    // Past completed trips
    Booking.find({
      guest: userObjectId,
      $or: [
        { checkOut: { $lte: now } },
        { status: "COMPLETED" }
      ],
      status: { $ne: "CANCELLED" }
    })
      .sort({ checkOut: -1 })
      .limit(10)
      .populate("property", "title location country image images")
      .populate("room", "roomNumber roomType")
      .lean(),

    // Cancelled trips
    Booking.find({
      guest: userObjectId,
      status: "CANCELLED"
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("property", "title location country image images")
      .populate("room", "roomNumber roomType")
      .lean(),

    // Personal booking value aggregation
    Booking.aggregate([
      { $match: { guest: userObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" }
        }
      }
    ])
  ]);

  let totalSpent = 0;
  let totalBookings = 0;

  for (const item of valueAgg) {
    totalBookings += item.count;
    if (item._id !== "CANCELLED") {
      totalSpent += item.totalValue;
    }
  }

  return {
    userId: userObjectId.toString(),
    summary: {
      totalTrips: totalBookings,
      upcomingCount: upcomingTrips.length,
      activeStaysCount: activeStays.length,
      pastCount: pastStays.length,
      cancelledCount: cancelledTrips.length,
      totalBookingValue: totalSpent
    },
    upcomingTrips,
    activeStays,
    pastStays,
    cancelledTrips
  };
}

// =========================================================================
// 4. ADMIN DASHBOARD (SYSTEM-WIDE)
// =========================================================================
async function getAdminDashboard(filterOptions = {}) {
  const { filter: dateMatch, label: dateLabel, startDate, endDate } = getAnalyticsDateFilter(filterOptions);
  const now = new Date();

  const [
    totalUsers,
    totalOrganizations,
    totalProperties,
    totalRooms,
    bookingStatsAgg,
    organizationPerformance,
    recentPlatformBookings
  ] = await Promise.all([
    User.countDocuments(),
    Organization.countDocuments(),
    Listing.countDocuments(),
    Room.countDocuments(),

    // Global booking status & value breakdown
    Booking.aggregate([
      { $match: { ...dateMatch } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" }
        }
      }
    ]),

    // Bounded Organization Performance (Rule 9: limit 25 to prevent memory overflow)
    Organization.aggregate([
      {
        $lookup: {
          from: "listings",
          localField: "_id",
          foreignField: "organization",
          as: "orgListings"
        }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "organization",
          as: "orgRooms"
        }
      },
      {
        $lookup: {
          from: "bookings",
          let: { orgId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$organization", "$$orgId"] },
                ...dateMatch
              }
            }
          ],
          as: "orgBookings"
        }
      },
      {
        $project: {
          name: 1,
          contactEmail: 1,
          propertyCount: { $size: "$orgListings" },
          roomCount: { $size: "$orgRooms" },
          bookingCount: { $size: "$orgBookings" },
          confirmedValue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$orgBookings",
                    as: "b",
                    cond: { $in: ["$$b.status", ["CONFIRMED", "COMPLETED"]] }
                  }
                },
                as: "cb",
                in: "$$cb.totalPrice"
              }
            }
          },
          pendingValue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$orgBookings",
                    as: "b",
                    cond: { $eq: ["$$b.status", "PENDING"] }
                  }
                },
                as: "pb",
                in: "$$pb.totalPrice"
              }
            }
          }
        }
      },
      { $sort: { bookingCount: -1, propertyCount: -1 } },
      { $limit: 25 }
    ]),

    // Recent platform bookings
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("organization", "name")
      .populate("property", "title location")
      .populate("guest", "username email")
      .lean()
  ]);

  let totalBookings = 0;
  let confirmedCompletedValue = 0;
  let pendingPipelineValue = 0;
  let cancelledValue = 0;

  const statusCounts = {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0
  };

  for (const b of bookingStatsAgg) {
    statusCounts[b._id] = b.count;
    totalBookings += b.count;
    if (b._id === "CONFIRMED" || b._id === "COMPLETED") {
      confirmedCompletedValue += b.totalValue;
    } else if (b._id === "PENDING") {
      pendingPipelineValue += b.totalValue;
    } else if (b._id === "CANCELLED") {
      cancelledValue += b.totalValue;
    }
  }

  return {
    dateFilter: {
      preset: filterOptions.preset || "30d",
      label: dateLabel,
      startDate,
      endDate
    },
    platformKPIs: {
      totalUsers,
      totalOrganizations,
      totalProperties,
      totalRooms,
      totalBookings,
      confirmedCompletedValue,
      pendingPipelineValue,
      totalBookingValue: confirmedCompletedValue + pendingPipelineValue,
      cancelledValue
    },
    bookingStatusBreakdown: statusCounts,
    organizationPerformance,
    recentPlatformBookings
  };
}

module.exports = {
  getOrganizationDashboard,
  getStaffDashboard,
  getCustomerDashboard,
  getAdminDashboard,
  getAnalyticsDateFilter,
  getOperationalTimeBounds
};
