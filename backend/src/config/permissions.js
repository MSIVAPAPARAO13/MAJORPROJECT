// Centralized RBAC Permissions and Roles Configuration

const PERMISSIONS = {
  // System & Organization
  SYSTEM_MANAGE: "system:manage",
  ORGANIZATION_CREATE: "organization:create",
  ORGANIZATION_VIEW: "organization:view",
  ORGANIZATION_MANAGE: "organization:manage",

  // Listings / Properties
  PROPERTY_VIEW_PUBLIC: "property:view_public",
  PROPERTY_CREATE: "property:create",
  PROPERTY_UPDATE: "property:update",
  PROPERTY_DELETE: "property:delete",

  // Rooms (Phase 4)
  ROOM_VIEW: "room:view",
  ROOM_CREATE: "room:create",
  ROOM_UPDATE: "room:update",
  ROOM_DELETE: "room:delete",

  // Bookings (Phase 5)
  BOOKING_VIEW: "booking:view",
  BOOKING_CREATE: "booking:create",
  BOOKING_UPDATE: "booking:update",
  BOOKING_CANCEL: "booking:cancel",
  BOOKING_MANAGE: "booking:manage",

  // Images (Phase 7)
  IMAGE_VIEW: "image:view",
  IMAGE_UPLOAD: "image:upload",
  IMAGE_DELETE: "image:delete",
  IMAGE_REORDER: "image:reorder",
  IMAGE_SET_PRIMARY: "image:set_primary",

  // Dashboards & Analytics (Phase 8)
  DASHBOARD_VIEW: "dashboard:view",
  ANALYTICS_VIEW: "analytics:view",

  // Reviews
  REVIEW_CREATE: "review:create",
  REVIEW_DELETE_OWN: "review:delete_own",
  REVIEW_DELETE_ANY: "review:delete_any",

  // Users
  USER_VIEW: "user:view",
  USER_MANAGE: "user:manage"
};

const ROLE_PERMISSIONS = {
  ADMIN: [
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.ORGANIZATION_CREATE,
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    PERMISSIONS.PROPERTY_CREATE,
    PERMISSIONS.PROPERTY_UPDATE,
    PERMISSIONS.PROPERTY_DELETE,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.ROOM_UPDATE,
    PERMISSIONS.ROOM_DELETE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.IMAGE_VIEW,
    PERMISSIONS.IMAGE_UPLOAD,
    PERMISSIONS.IMAGE_DELETE,
    PERMISSIONS.IMAGE_REORDER,
    PERMISSIONS.IMAGE_SET_PRIMARY,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.REVIEW_DELETE_ANY,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE
  ],
  OWNER: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    PERMISSIONS.PROPERTY_CREATE,
    PERMISSIONS.PROPERTY_UPDATE,
    PERMISSIONS.PROPERTY_DELETE,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.ROOM_UPDATE,
    PERMISSIONS.ROOM_DELETE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.IMAGE_VIEW,
    PERMISSIONS.IMAGE_UPLOAD,
    PERMISSIONS.IMAGE_DELETE,
    PERMISSIONS.IMAGE_REORDER,
    PERMISSIONS.IMAGE_SET_PRIMARY,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.USER_VIEW
  ],
  MANAGER: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    PERMISSIONS.PROPERTY_CREATE,
    PERMISSIONS.PROPERTY_UPDATE,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_CREATE,
    PERMISSIONS.ROOM_UPDATE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.IMAGE_VIEW,
    PERMISSIONS.IMAGE_UPLOAD,
    PERMISSIONS.IMAGE_DELETE,
    PERMISSIONS.IMAGE_REORDER,
    PERMISSIONS.IMAGE_SET_PRIMARY,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.USER_VIEW
  ],
  STAFF: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    PERMISSIONS.PROPERTY_UPDATE,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.ROOM_UPDATE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.IMAGE_VIEW,
    PERMISSIONS.IMAGE_UPLOAD,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_DELETE_OWN
  ],
  CUSTOMER: [
    PERMISSIONS.PROPERTY_VIEW_PUBLIC,
    PERMISSIONS.IMAGE_VIEW,
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_DELETE_OWN
  ]
};

// Check if user has a specific role
function hasRole(user, ...roles) {
  const role = typeof user === "string" ? user : user?.role;
  if (!role) return false;
  return roles.includes(role);
}

// Check if user has any of the specified roles
function hasAnyRole(user, roles) {
  const role = typeof user === "string" ? user : user?.role;
  if (!role || !Array.isArray(roles)) return false;
  return roles.includes(role);
}

// Check if user has a specific permission
function hasPermission(user, permission) {
  const role = typeof user === "string" ? user : user?.role;
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

// Check if user has any of the specified permissions
function hasAnyPermission(user, permissions) {
  const role = typeof user === "string" ? user : user?.role;
  if (!role || !Array.isArray(permissions)) return false;
  const userPermissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some((p) => userPermissions.includes(p));
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasRole,
  hasAnyRole,
  hasPermission,
  hasAnyPermission
};
