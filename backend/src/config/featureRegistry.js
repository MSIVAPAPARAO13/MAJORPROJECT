const { PERMISSIONS, hasPermission } = require("./permissions");

/**
 * Centralized Role Feature Registry
 * Single authoritative source of truth for platform feature discovery and entitlements.
 */
const FEATURES = [
  // --- PROPERTY CATEGORY ---
  {
    id: "exploreStays",
    name: "Explore Stays",
    description: "Browse verified stays, backpacker hostels, and boutique hotels.",
    route: "/listings",
    api: "/api/listings",
    allowedRoles: ["CUSTOMER", "STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    category: "PROPERTY",
    icon: "fa-solid fa-compass",
    enabled: true
  },
  {
    id: "propertyManagement",
    name: "Property & Room Management",
    description: "Portfolio oversight, property creation, room tiers, and inventory.",
    route: "/listings",
    api: "/api/listings",
    allowedRoles: ["MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.PROPERTY_CREATE,
    category: "PROPERTY",
    icon: "fa-solid fa-hotel",
    enabled: true
  },
  {
    id: "roomManagement",
    name: "Room Inventory & Pricing",
    description: "Manage physical rooms, pricing per night, bed types, and amenities.",
    route: "/listings",
    api: "/api/listings",
    allowedRoles: ["STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.ROOM_VIEW,
    category: "PROPERTY",
    icon: "fa-solid fa-bed",
    enabled: true
  },
  {
    id: "bookingEngine",
    name: "Atomic Booking Engine",
    description: "Real-time room reservation engine with date overlap conflict rejection.",
    route: "/listings",
    api: "/api/bookings",
    allowedRoles: ["CUSTOMER", "STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.BOOKING_CREATE,
    category: "PROPERTY",
    icon: "fa-solid fa-calendar-check",
    enabled: true
  },
  {
    id: "myTrips",
    name: "My Trips & Reservations",
    description: "Personal travel reservations, booking vouchers, and cancellations.",
    route: "/bookings",
    api: "/api/bookings",
    allowedRoles: ["CUSTOMER"],
    permission: PERMISSIONS.BOOKING_VIEW,
    category: "PROPERTY",
    icon: "fa-solid fa-suitcase",
    enabled: true
  },

  // --- OPERATIONS CATEGORY ---
  {
    id: "hospitalityOperations",
    name: "Hospitality Operations Center",
    description: "Live daily operational queue: arrivals, departures, in-house guests, and room turnover.",
    route: "/staff/operations",
    api: "/api/v2/staff/operations",
    allowedRoles: ["STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.DASHBOARD_VIEW,
    category: "OPERATIONS",
    icon: "fa-solid fa-clipboard-user",
    enabled: true
  },
  {
    id: "serviceIssues",
    name: "Service & Maintenance Ticketing",
    description: "Log, assign, track, and resolve maintenance issues across all rooms.",
    route: "/staff/operations",
    api: "/api/v2/staff/operations",
    allowedRoles: ["STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.ISSUE_VIEW,
    category: "OPERATIONS",
    icon: "fa-solid fa-screwdriver-wrench",
    enabled: true
  },
  {
    id: "guestReady",
    name: "Guest Readiness Verification",
    description: "Dynamically evaluated room readiness ensuring zero unresolved issues before check-in.",
    route: "/staff/operations",
    api: "/api/v2/staff/operations",
    allowedRoles: ["STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.ROOM_VIEW,
    category: "OPERATIONS",
    icon: "fa-solid fa-circle-check",
    enabled: true
  },
  {
    id: "guestImpact",
    name: "Guest Impact Alert System",
    description: "Automated early warning when upcoming check-ins are assigned to rooms under maintenance.",
    route: "/staff/operations",
    api: "/api/v2/staff/operations",
    allowedRoles: ["STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.ISSUE_VIEW,
    category: "OPERATIONS",
    icon: "fa-solid fa-triangle-exclamation",
    enabled: true
  },

  // --- PLATFORM CATEGORY ---
  {
    id: "searchDiscovery",
    name: "Search & Discovery",
    description: "Full-text property and city discovery with price and amenity filters.",
    route: "/listings",
    api: "/api/listings",
    allowedRoles: ["CUSTOMER", "STAFF", "MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    category: "PLATFORM",
    icon: "fa-solid fa-magnifying-glass",
    enabled: true
  },
  {
    id: "analytics",
    name: "Performance & Financial Analytics",
    description: "Realized booking value, occupancy trends, and period revenue summaries.",
    route: "/dashboard",
    api: "/api/dashboard",
    allowedRoles: ["MANAGER", "OWNER", "ADMIN"],
    permission: PERMISSIONS.ANALYTICS_VIEW,
    category: "PLATFORM",
    icon: "fa-solid fa-chart-line",
    enabled: true
  },
  {
    id: "organizationManagement",
    name: "Organization & Team Management",
    description: "Manage multi-tenant hospitality organization members, profile, and listings.",
    route: "/organizations",
    api: "/api/organizations",
    allowedRoles: ["OWNER", "ADMIN"],
    permission: PERMISSIONS.ORGANIZATION_MANAGE,
    category: "PLATFORM",
    icon: "fa-solid fa-building",
    enabled: true
  },
  {
    id: "platformAdministration",
    name: "Platform System Administration",
    description: "Cross-tenant oversight, new organization registration, and global monitoring.",
    route: "/admin/dashboard",
    api: "/api/v2/admin/dashboard",
    allowedRoles: ["ADMIN"],
    permission: PERMISSIONS.SYSTEM_MANAGE,
    category: "PLATFORM",
    icon: "fa-solid fa-shield-halved",
    enabled: true
  }
];

/**
 * Filter features available to an authenticated user
 */
function getFeaturesForUser(user) {
  if (!user || !user.role) {
    // Unauthenticated: only public features
    return FEATURES.filter(
      (f) => f.enabled && f.permission === PERMISSIONS.PROPERTY_VIEW_PUBLIC
    );
  }

  return FEATURES.filter((feature) => {
    if (!feature.enabled) return false;
    if (!feature.allowedRoles.includes(user.role)) return false;
    if (feature.permission && !hasPermission(user, feature.permission)) return false;
    return true;
  });
}

function getAllFeatures() {
  return FEATURES.filter((f) => f.enabled);
}

function getFeatureById(id) {
  return FEATURES.find((f) => f.id === id && f.enabled) || null;
}

module.exports = {
  FEATURES,
  getFeaturesForUser,
  getAllFeatures,
  getFeatureById
};
