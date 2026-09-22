/**
 * Phase 11 Test Fixtures
 * Provides deterministic sample payloads and data templates for unit and integration testing.
 */

const sampleUserPayloads = {
  customer: {
    username: "test_customer_deterministic",
    email: "customer_det@example.com",
    role: "CUSTOMER"
  },
  staff: {
    username: "test_staff_deterministic",
    email: "staff_det@example.com",
    role: "STAFF"
  },
  manager: {
    username: "test_manager_deterministic",
    email: "manager_det@example.com",
    role: "MANAGER"
  },
  owner: {
    username: "test_owner_deterministic",
    email: "owner_det@example.com",
    role: "OWNER"
  },
  admin: {
    username: "test_admin_deterministic",
    email: "admin_det@example.com",
    role: "ADMIN"
  }
};

const sampleOrgPayload = {
  name: "Deterministic Test Hospitality Ltd",
  slug: "det-test-hospitality"
};

const sampleListingPayload = {
  title: "Deterministic Grand Coastal Villa",
  description: "A luxury private beachfront villa used for automated deterministic test suites.",
  location: "Goa",
  country: "India",
  propertyType: "Villa",
  price: 5000
};

const sampleRoomPayloads = {
  deluxe: {
    roomNumber: "DET-101",
    roomType: "Deluxe",
    capacity: 2,
    price: 3000,
    status: "AVAILABLE",
    amenities: ["WiFi", "Air Conditioning", "Ocean View"]
  },
  familySuite: {
    roomNumber: "DET-102",
    roomType: "Suite",
    capacity: 4,
    price: 6000,
    status: "AVAILABLE",
    amenities: ["WiFi", "Air Conditioning", "Balcony", "Kitchenette"]
  }
};

const sampleBookingDates = {
  slot1: {
    checkIn: new Date("2026-11-01T14:00:00.000Z"),
    checkOut: new Date("2026-11-04T11:00:00.000Z")
  },
  slot1Adjacent: {
    checkIn: new Date("2026-11-04T14:00:00.000Z"),
    checkOut: new Date("2026-11-07T11:00:00.000Z")
  },
  slot1Overlap: {
    checkIn: new Date("2026-11-02T14:00:00.000Z"),
    checkOut: new Date("2026-11-05T11:00:00.000Z")
  },
  slot1Surround: {
    checkIn: new Date("2026-10-31T14:00:00.000Z"),
    checkOut: new Date("2026-11-05T11:00:00.000Z")
  }
};

module.exports = {
  sampleUserPayloads,
  sampleOrgPayload,
  sampleListingPayload,
  sampleRoomPayloads,
  sampleBookingDates
};
