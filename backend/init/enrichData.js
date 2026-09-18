// Database enrichment & migration script
// 1. Sets exact Mapbox GeoJSON [lng, lat] coordinates for all properties
// 2. Classifies properties into Hostels, Hotels, Resorts, Apartments, etc.
// 3. Adds dedicated social hostel properties
// 4. Initializes Organization and assigns role 'OWNER' to the primary host
// 5. Generates rooms with capacities and rates for every property

const mongoose = require("mongoose");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");

const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

const locationCoords = {
  "Malibu": [-118.6923, 34.0381],
  "New York City": [-74.0060, 40.7128],
  "Aspen": [-106.8235, 39.1911],
  "Florence": [11.2558, 43.7696],
  "Portland": [-122.6784, 45.5152],
  "Cancun": [-86.8515, 21.1619],
  "Lake Tahoe": [-120.0324, 39.0968],
  "Los Angeles": [-118.2437, 34.0522],
  "Verbier": [7.2286, 46.0968],
  "Serengeti National Park": [34.8333, -2.3333],
  "Amsterdam": [4.9041, 52.3676],
  "Fiji": [178.0650, -17.7134],
  "Cotswolds": [-1.8839, 51.8330],
  "Boston": [-71.0589, 42.3601],
  "Bali": [115.1889, -8.4095],
  "Banff": [-115.5708, 51.1784],
  "Miami": [-80.1918, 25.7617],
  "Phuket": [98.3923, 7.8804],
  "Tokyo": [139.6917, 35.6895],
  "Scottish Highlands": [-4.7167, 57.3833],
  "Dubai": [55.2708, 25.2048],
  "Paris": [2.3522, 48.8566],
  "London": [-0.1276, 51.5074],
  "Rome": [12.4964, 41.9028],
  "Goa": [73.8180, 15.2993],
  "Manali": [77.1887, 32.2396],
  "Jaipur": [75.7873, 26.9124],
  "Pushkar": [74.5511, 26.4897],
  "Berlin": [13.4050, 52.5200],
  "Sydney": [151.2093, -33.8688],
  "Santorini": [25.4317, 36.3932]
};

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URL);
  console.log("Connected successfully to DB");

  // 1. Ensure primary host user
  let hostUser = await User.findOne({ username: "@msivapaparao" });
  if (!hostUser) {
    hostUser = await User.findOne();
  }
  if (!hostUser) {
    console.error("No users found to assign properties to.");
    process.exit(1);
  }

  // Update role to OWNER
  hostUser.role = "OWNER";
  await hostUser.save();
  console.log(`Updated user @${hostUser.username} role to OWNER`);

  // 2. Ensure Organization exists
  let org = await Organization.findOne({ owner: hostUser._id });
  if (!org) {
    org = new Organization({
      name: "WanderLust Global Hospitality Ltd",
      description: "Premier boutique stays, backpacker hostels, and luxury holiday resorts.",
      owner: hostUser._id,
      members: [{ user: hostUser._id, role: "OWNER" }],
      contactEmail: hostUser.email || "host@wanderlust.com",
      phone: "+91 9876543210",
      address: "101 Heritage Boulevard, Bengaluru, India"
    });
    await org.save();
    console.log("Created demo Organization:", org.name);
  }

  hostUser.organization = org._id;
  await hostUser.save();

  // 3. Add dedicated Hostels if not already present
  const hostelListings = [
    {
      title: "Zostel Backpacker Hub - Old Manali",
      description: "Perched amidst apple orchards with panoramic Himalayan views, this social backpacker hostel features private rooms, mixed dormitories, a vibrant cafe, high-speed WiFi, and bonfire evenings.",
      image: {
        filename: "hostel_manali",
        url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80"
      },
      price: 650,
      location: "Manali",
      country: "India",
      propertyType: "Hostel",
      category: "Hostels",
      geometry: { type: "Point", coordinates: [77.1887, 32.2396] },
      amenities: ["Free WiFi", "Bonfire", "Mountain View", "Cafe", "Lockers", "Board Games"]
    },
    {
      title: "Nomad Backpackers Beach Hostel - Anjuna",
      description: "Steps from Anjuna Beach, this energetic beach hostel offers lively social vibes, co-working spaces, outdoor swimming pool, and comfortable bunk beds for digital nomads and global travelers.",
      image: {
        filename: "hostel_goa",
        url: "https://images.unsplash.com/photo-1520277739336-7bf67edfa768?auto=format&fit=crop&w=1200&q=80"
      },
      price: 800,
      location: "Goa",
      country: "India",
      propertyType: "Hostel",
      category: "Hostels",
      geometry: { type: "Point", coordinates: [73.7431, 15.5808] },
      amenities: ["Swimming Pool", "Free WiFi", "Bar & Cafe", "Air Conditioning", "Beach Access"]
    },
    {
      title: "The Madpackers Social Hostel - Pushkar",
      description: "Located near Pushkar's sacred lake, featuring a rooftop terrace, yoga sessions, community kitchen, and heritage courtyard designed for backpackers and culture enthusiasts.",
      image: {
        filename: "hostel_pushkar",
        url: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80"
      },
      price: 550,
      location: "Pushkar",
      country: "India",
      propertyType: "Hostel",
      category: "Hostels",
      geometry: { type: "Point", coordinates: [74.5511, 26.4897] },
      amenities: ["Rooftop Cafe", "Free WiFi", "Yoga", "Community Kitchen", "Lockers"]
    },
    {
      title: "Wombat's City Hostel - London",
      description: "A stylish modern hostel near Tower Bridge and the River Thames. Features a historic cellar bar, comfortable dorms with private USB sockets, and spacious private en-suite rooms.",
      image: {
        filename: "hostel_london",
        url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"
      },
      price: 2200,
      location: "London",
      country: "United Kingdom",
      propertyType: "Hostel",
      category: "Hostels",
      geometry: { type: "Point", coordinates: [-0.0712, 51.5118] },
      amenities: ["Bar", "Free WiFi", "Luggage Storage", "24/7 Reception", "Laundry"]
    }
  ];

  for (let h of hostelListings) {
    const existing = await Listing.findOne({ title: h.title });
    if (!existing) {
      const newHostel = new Listing({
        ...h,
        owner: hostUser._id,
        organization: org._id
      });
      await newHostel.save();
      console.log("Added hostel listing:", h.title);
    }
  }

  // 4. Update all properties in DB with exact coordinates and rooms
  const allListings = await Listing.find();
  console.log(`Processing ${allListings.length} total properties...`);

  for (let listing of allListings) {
    let modified = false;

    // Match exact coordinates
    for (let [city, coords] of Object.entries(locationCoords)) {
      if (listing.location && listing.location.toLowerCase().includes(city.toLowerCase())) {
        listing.geometry = {
          type: "Point",
          coordinates: coords
        };
        modified = true;
        break;
      }
    }

    // Default fallback coordinates if no city matched
    if (!listing.geometry || !listing.geometry.coordinates || listing.geometry.coordinates.length !== 2) {
      listing.geometry = {
        type: "Point",
        coordinates: [77.2090, 28.6139] // Delhi fallback
      };
      modified = true;
    }

    // Ensure organization & owner
    if (!listing.organization) {
      listing.organization = org._id;
      modified = true;
    }
    if (!listing.owner) {
      listing.owner = hostUser._id;
      modified = true;
    }

    // Set appropriate propertyType if missing
    if (!listing.propertyType) {
      if (listing.title.toLowerCase().includes("hostel") || listing.category === "Hostels") {
        listing.propertyType = "Hostel";
      } else if (listing.title.toLowerCase().includes("resort") || listing.title.toLowerCase().includes("paradise")) {
        listing.propertyType = "Resort";
      } else if (listing.title.toLowerCase().includes("villa") || listing.title.toLowerCase().includes("cottage")) {
        listing.propertyType = "Guest House";
      } else if (listing.title.toLowerCase().includes("hotel")) {
        listing.propertyType = "Hotel";
      } else {
        listing.propertyType = "Apartment";
      }
      modified = true;
    }

    // Ensure at least 2-3 rooms exist for this property
    const existingRooms = await Room.find({ property: listing._id });
    if (existingRooms.length === 0) {
      const roomConfigs = listing.propertyType === "Hostel" 
        ? [
            { roomNumber: "Dorm-A", roomType: "Dormitory", capacity: 1, price: Math.round(listing.price * 0.7) },
            { roomNumber: "Dorm-B", roomType: "Dormitory", capacity: 1, price: Math.round(listing.price * 0.8) },
            { roomNumber: "P-101", roomType: "Deluxe", capacity: 2, price: Math.round(listing.price * 1.5) }
          ]
        : [
            { roomNumber: "101", roomType: "Deluxe", capacity: 2, price: listing.price },
            { roomNumber: "201", roomType: "Suite", capacity: 4, price: Math.round(listing.price * 1.6) }
          ];

      const createdRoomIds = [];
      for (let rc of roomConfigs) {
        const room = new Room({
          property: listing._id,
          organization: org._id,
          roomNumber: rc.roomNumber,
          roomType: rc.roomType,
          capacity: rc.capacity,
          price: rc.price,
          amenities: listing.amenities || ["WiFi", "Air Conditioning"],
          status: "AVAILABLE"
        });
        await room.save();
        createdRoomIds.push(room._id);
      }

      listing.rooms = createdRoomIds;
      modified = true;
    }

    if (modified) {
      await listing.save();
    }
  }

  console.log("Database enrichment complete! All properties have exact GeoJSON coordinates, organizations, and rooms.");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
