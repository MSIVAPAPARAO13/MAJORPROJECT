const mongoose = require("mongoose");
const Listing = require("../src/models/listing");
const Room = require("../src/models/room");
const User = require("../src/models/user");
const Organization = require("../src/models/organization");

const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

const categoryListings = [
  // 1. CAMPING
  {
    title: "Serene Luxury Glamping Camp - Rishikesh",
    description: "Experience luxury glamping by the sacred Ganges with panoramic mountain views, evening bonfires, guided rafting, and spacious safari tents with attached bathrooms.",
    image: {
      filename: "camping_rishikesh",
      url: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80"
    },
    price: 1800,
    location: "Rishikesh",
    country: "India",
    propertyType: "Resort",
    category: "Camping",
    geometry: { type: "Point", coordinates: [78.2676, 30.0869] },
    amenities: ["Bonfire", "Free Breakfast", "River Access", "Rafting", "Attached Bathroom"]
  },
  {
    title: "Royal Desert Safari Camp - Jaisalmer",
    description: "Sleep under millions of desert stars in traditional Swiss luxury tents nestled among golden Thar desert dunes. Includes camel safari, folk dance, and authentic Rajasthani dinner.",
    image: {
      filename: "camping_jaisalmer",
      url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 2500,
    location: "Jaisalmer",
    country: "India",
    propertyType: "Resort",
    category: "Camping",
    geometry: { type: "Point", coordinates: [70.9083, 26.9157] },
    amenities: ["Camel Safari", "Bonfire", "Folk Music", "Free Breakfast", "Stargazing"]
  },
  {
    title: "Yosemite Wilderness Eco-Camp",
    description: "Nestled in pine groves near Yosemite Valley. Enjoy canvas glamping tents, solar-powered heating, outdoor fire pits, and immediate access to scenic hiking trails.",
    image: {
      filename: "camping_yosemite",
      url: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80"
    },
    price: 3200,
    location: "Yosemite National Park",
    country: "United States",
    propertyType: "Resort",
    category: "Camping",
    geometry: { type: "Point", coordinates: [-119.5383, 37.8651] },
    amenities: ["Hiking Trails", "Campfire", "Free Parking", "Solar Heated", "Mountain View"]
  },

  // 2. FARMS
  {
    title: "Organic Vineyard Tuscan Farmhouse",
    description: "A centuries-old restored stone farmhouse overlooking Chianti vineyards and olive groves. Fresh wine tasting, handmade pasta workshops, and private swimming pool.",
    image: {
      filename: "farm_tuscany",
      url: "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1200&q=80"
    },
    price: 4500,
    location: "Florence",
    country: "Italy",
    propertyType: "Homestay",
    category: "Farms",
    geometry: { type: "Point", coordinates: [11.2558, 43.7696] },
    amenities: ["Wine Tasting", "Swimming Pool", "Organic Garden", "Free WiFi", "Cooking Class"]
  },
  {
    title: "Green Valley Heritage Coffee Estate",
    description: "Wake up to misty hills and the aroma of arabica coffee beans. Situated in a sprawling 50-acre private coffee plantation in Coorg, Karnataka.",
    image: {
      filename: "farm_coorg",
      url: "https://images.unsplash.com/photo-1592417817098-8f3d69102353?auto=format&fit=crop&w=1200&q=80"
    },
    price: 2800,
    location: "Coorg",
    country: "India",
    propertyType: "Homestay",
    category: "Farms",
    geometry: { type: "Point", coordinates: [75.7382, 12.3375] },
    amenities: ["Plantation Walk", "Bird Watching", "Home Cooked Meals", "Free Breakfast", "Bonfire"]
  },
  {
    title: "Provence Lavender Farm Villa",
    description: "Surrounded by purple lavender fields and sunlit cypress trees. Enjoy tranquil French countryside living with outdoor dining, artisan cheese, and cycling.",
    image: {
      filename: "farm_provence",
      url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80"
    },
    price: 3900,
    location: "Provence",
    country: "France",
    propertyType: "Homestay",
    category: "Farms",
    geometry: { type: "Point", coordinates: [5.0428, 43.9493] },
    amenities: ["Lavender Fields", "Bicycle Rental", "Outdoor Dining", "Kitchen", "Free WiFi"]
  },

  // 3. ARCTIC
  {
    title: "Aurora Borealis Glass Igloo",
    description: "Watch the dancing Northern Lights directly from your heated motorized glass igloo bed. Features thermal glass that prevents frosting and panoramic arctic views.",
    image: {
      filename: "arctic_tromso",
      url: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80"
    },
    price: 7500,
    location: "Tromso",
    country: "Norway",
    propertyType: "Resort",
    category: "Arctic",
    geometry: { type: "Point", coordinates: [18.9553, 69.6492] },
    amenities: ["Heated Glass Roof", "Sauna", "Aurora Alarm", "Husky Safari", "Snowshoeing"]
  },
  {
    title: "Arctic Ice Hotel & Wilderness Lodge",
    description: "Sculpted completely from natural ice and snow from the Torne River. Includes reindeer sledding, wood-fired arctic sauna, and sub-zero ice cocktail bar.",
    image: {
      filename: "arctic_kiruna",
      url: "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1200&q=80"
    },
    price: 6800,
    location: "Kiruna",
    country: "Sweden",
    propertyType: "Hotel",
    category: "Arctic",
    geometry: { type: "Point", coordinates: [20.2253, 67.8558] },
    amenities: ["Ice Bar", "Reindeer Sledding", "Sauna", "Warm Winter Gear", "Free Breakfast"]
  },
  {
    title: "Glacier View Polar Cabin",
    description: "Private secluded Nordic timber cabin with direct views of snow-capped volcanic glaciers. Unwind in your private geothermal outdoor hot tub under polar skies.",
    image: {
      filename: "arctic_iceland",
      url: "https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80"
    },
    price: 5200,
    location: "Reykjavik",
    country: "Iceland",
    propertyType: "Guest House",
    category: "Arctic",
    geometry: { type: "Point", coordinates: [-21.9426, 64.1466] },
    amenities: ["Geothermal Hot Tub", "Glacier View", "Fireplace", "High-speed WiFi", "Kitchen"]
  },

  // 4. DOMES
  {
    title: "Stargazing Geodesic Eco Dome - Manali",
    description: "Perched on a cliff edge at 8,500 feet in Hampta Valley. Features 360-degree transparent panels for stargazing, pellet stoves, plush king beds, and hot showers.",
    image: {
      filename: "dome_manali",
      url: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80"
    },
    price: 3400,
    location: "Manali",
    country: "India",
    propertyType: "Resort",
    category: "Domes",
    geometry: { type: "Point", coordinates: [77.1887, 32.2396] },
    amenities: ["Telescope", "Pellet Fireplace", "Mountain View", "Balcony Deck", "Free Breakfast"]
  },
  {
    title: "Desert Mirage Luxury Martian Dome",
    description: "Experience life on Mars in the breathtaking red sand dunes of Wadi Rum. Futuristic luxury geodesic dome equipped with air conditioning, en-suite bathroom, and terrace.",
    image: {
      filename: "dome_wadirum",
      url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80"
    },
    price: 4200,
    location: "Wadi Rum",
    country: "Jordan",
    propertyType: "Resort",
    category: "Domes",
    geometry: { type: "Point", coordinates: [35.4194, 29.5736] },
    amenities: ["Air Conditioning", "Private Terrace", "Jeep Safari", "Star Viewing", "Dinner Included"]
  },
  {
    title: "Skyview Canopy Forest Dome",
    description: "Elevated high above the Douglas fir canopy in the Pacific Northwest. Transparent ceiling reveals swaying treetops by day and dazzling constellations by night.",
    image: {
      filename: "dome_oregon",
      url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 2900,
    location: "Portland",
    country: "United States",
    propertyType: "Resort",
    category: "Domes",
    geometry: { type: "Point", coordinates: [-122.6784, 45.5152] },
    amenities: ["Hot Tub", "Forest View", "Stargazing Roof", "Coffee Maker", "WiFi"]
  },

  // 5. BOATS
  {
    title: "Traditional Luxury Houseboat - Alleppey",
    description: "Glide serenely through Kerala's emerald palm-fringed backwaters aboard a handcrafted wooden Kettuvallam. Includes private onboard chef, sun deck, and air-conditioned bedrooms.",
    image: {
      filename: "boat_alleppey",
      url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80"
    },
    price: 5500,
    location: "Alleppey",
    country: "India",
    propertyType: "Resort",
    category: "Boats",
    geometry: { type: "Point", coordinates: [76.3388, 9.4981] },
    amenities: ["Private Chef", "Backwater Cruise", "Air Conditioning", "Sun Deck", "All Meals Included"]
  },
  {
    title: "Historic Canal Houseboat - Amsterdam",
    description: "Live like a local on this lovingly converted 1920s Dutch freight boat docked in the picturesque Prinsengracht canal. Walking distance to museums and trendy cafes.",
    image: {
      filename: "boat_amsterdam",
      url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80"
    },
    price: 3600,
    location: "Amsterdam",
    country: "Netherlands",
    propertyType: "Apartment",
    category: "Boats",
    geometry: { type: "Point", coordinates: [4.9041, 52.3676] },
    amenities: ["Canal View", "Kitchen", "Free WiFi", "Waterfront Deck", "Heating"]
  },
  {
    title: "Aegean Luxury Sailing Yacht",
    description: "Anchor in secluded turquoise bays along the Athenian Riviera. Fully skippered modern 48ft monohull yacht with luxury cabins, teak deck, and snorkeling gear.",
    image: {
      filename: "boat_athens",
      url: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=1200&q=80"
    },
    price: 8500,
    location: "Athens",
    country: "Greece",
    propertyType: "Resort",
    category: "Boats",
    geometry: { type: "Point", coordinates: [23.7275, 37.9838] },
    amenities: ["Skipper Included", "Snorkeling Gear", "Ocean View", "Kitchen", "Sound System"]
  },

  // 6. CASTLES
  {
    title: "Highland Royal Castle Estate",
    description: "Step into centuries of Scottish aristocracy in this 16th-century Baronial fortress. Features grand roaring fireplaces, antique four-poster beds, and expansive estate gardens.",
    image: {
      filename: "castle_edinburgh",
      url: "https://images.unsplash.com/photo-1585543805890-6051f7829f98?auto=format&fit=crop&w=1200&q=80"
    },
    price: 9200,
    location: "Edinburgh",
    country: "United Kingdom",
    propertyType: "Hotel",
    category: "Castles",
    geometry: { type: "Point", coordinates: [-3.1883, 55.9533] },
    amenities: ["Historic Architecture", "Banquet Hall", "Library", "Fireplace", "Breakfast Included"]
  },
  {
    title: "Château de Chambord Vineyard Estate",
    description: "An authentic Renaissance French château nestled amidst Loire Valley wine country. Features marble staircases, private moat, and guided wine cellar tours.",
    image: {
      filename: "castle_france",
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"
    },
    price: 8800,
    location: "Paris",
    country: "France",
    propertyType: "Hotel",
    category: "Castles",
    geometry: { type: "Point", coordinates: [1.5178, 47.6161] },
    amenities: ["Private Moat", "Wine Cellar", "Gardens", "Butler Service", "Free Parking"]
  },

  // 7. AMAZING POOL
  {
    title: "Ubud Jungle Infinity Edge Pool Villa",
    description: "Suspended above the lush Ayung river valley, this multi-tiered bamboo villa boasts a heated infinity plunge pool looking out onto cascading rainforest canopies.",
    image: {
      filename: "pool_bali",
      url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80"
    },
    price: 6200,
    location: "Bali",
    country: "Indonesia",
    propertyType: "Resort",
    category: "Amazing pool",
    geometry: { type: "Point", coordinates: [115.1889, -8.4095] },
    amenities: ["Private Infinity Pool", "Floating Breakfast", "Spa Services", "Jungle View", "WiFi"]
  },
  {
    title: "Santorini Cliffside Caldera Pool Villa",
    description: "Whitewashed Cycladic cave villa carved directly into the Oia cliff face. Features a private heated infinity pool merging seamlessly with the Aegean sunset.",
    image: {
      filename: "pool_santorini",
      url: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80"
    },
    price: 9500,
    location: "Santorini",
    country: "Greece",
    propertyType: "Resort",
    category: "Amazing pool",
    geometry: { type: "Point", coordinates: [25.4317, 36.3932] },
    amenities: ["Caldera Sunset View", "Heated Pool", "Cave Architecture", "Breakfast", "Butler"]
  },

  // 8. MOUNTAINS
  {
    title: "Alpine Luxury Ski Chalet - Swiss Alps",
    description: "Ski-in/ski-out timber chalet in the elite resort of Verbier. Features private cedar hot tub, sauna, floor-to-ceiling glass windows, and roaring stone hearth.",
    image: {
      filename: "mountain_swiss",
      url: "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=1200&q=80"
    },
    price: 7200,
    location: "Verbier",
    country: "Switzerland",
    propertyType: "Resort",
    category: "Mountains",
    geometry: { type: "Point", coordinates: [7.2286, 46.0968] },
    amenities: ["Ski-In/Ski-Out", "Sauna", "Hot Tub", "Fireplace", "Mountain Panorama"]
  },
  {
    title: "Banff Rocky Mountain Lodge",
    description: "Surrounded by turquoise glacial lakes and pine forests. Ideal basecamp for hiking, skiing, and observing elk and bighorn sheep in Canada's premier national park.",
    image: {
      filename: "mountain_banff",
      url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80"
    },
    price: 4800,
    location: "Banff",
    country: "Canada",
    propertyType: "Hotel",
    category: "Mountains",
    geometry: { type: "Point", coordinates: [-115.5708, 51.1784] },
    amenities: ["Glacier View", "Indoor Fireplace", "Ski Locker", "Hiking Guide", "Hot Tub"]
  },

  // 9. ICONIC CITIES
  {
    title: "Champs-Elysees Luxury Penthouse",
    description: "Elegantly furnished Parisian apartment with wrought-iron balconies looking straight out onto the Eiffel Tower and Arc de Triomphe.",
    image: {
      filename: "city_paris",
      url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80"
    },
    price: 5800,
    location: "Paris",
    country: "France",
    propertyType: "Apartment",
    category: "Iconic Cities",
    geometry: { type: "Point", coordinates: [2.3522, 48.8566] },
    amenities: ["Eiffel Tower View", "Balcony", "Elevator", "Designer Kitchen", "High-speed WiFi"]
  },
  {
    title: "Tokyo Shinjuku Skyscraper Suite",
    description: "Sleek high-floor apartment in Shinjuku with floor-to-ceiling panoramic views over Tokyo's neon skyline and Mount Fuji on clear mornings.",
    image: {
      filename: "city_tokyo",
      url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80"
    },
    price: 4200,
    location: "Tokyo",
    country: "Japan",
    propertyType: "Apartment",
    category: "Iconic Cities",
    geometry: { type: "Point", coordinates: [139.6917, 35.6895] },
    amenities: ["Skyline View", "Subway Access", "Air Conditioning", "Modern Bath", "Fast WiFi"]
  },

  // 10. TRENDING
  {
    title: "Sunset Cliffside Villa - Anjuna",
    description: "North Goa's most talked-about luxury coastal retreat. Direct beach trail, open-air cocktail patio, and spectacular sunset views over the Arabian Sea.",
    image: {
      filename: "trending_goa",
      url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80"
    },
    price: 5100,
    location: "Goa",
    country: "India",
    propertyType: "Resort",
    category: "Trending",
    geometry: { type: "Point", coordinates: [73.7431, 15.5808] },
    amenities: ["Sunset View", "Cocktail Bar", "Beach Path", "Swimming Pool", "Chef On Demand"]
  }
];

async function seedCategories() {
  console.log("Connecting to database...");
  await mongoose.connect(MONGO_URL);

  let hostUser = await User.findOne({ username: "@msivapaparao" });
  if (!hostUser) {
    hostUser = await User.findOne();
  }
  let org = await Organization.findOne({ owner: hostUser._id });

  console.log("Seeding all categories into database...");

  for (let p of categoryListings) {
    const existing = await Listing.findOne({ title: p.title });
    if (!existing) {
      const listing = new Listing({
        ...p,
        owner: hostUser._id,
        organization: org ? org._id : null
      });
      await listing.save();

      // Create 2 rooms for this property
      const room1 = new Room({
        property: listing._id,
        organization: org ? org._id : null,
        roomNumber: "101",
        roomType: p.category === "Hostels" ? "Dormitory" : "Deluxe",
        capacity: p.category === "Hostels" ? 1 : 2,
        price: listing.price,
        amenities: listing.amenities,
        status: "AVAILABLE"
      });
      await room1.save();

      const room2 = new Room({
        property: listing._id,
        organization: org ? org._id : null,
        roomNumber: "201",
        roomType: p.category === "Hostels" ? "Dormitory" : "Suite",
        capacity: p.category === "Hostels" ? 1 : 4,
        price: Math.round(listing.price * 1.5),
        amenities: listing.amenities,
        status: "AVAILABLE"
      });
      await room2.save();

      listing.rooms = [room1._id, room2._id];
      await listing.save();

      console.log(`[+] Added [${p.category}] -> "${p.title}"`);
    } else {
      // Ensure category matches
      existing.category = p.category;
      existing.geometry = p.geometry;
      await existing.save();
      console.log(`[=] Updated [${p.category}] -> "${p.title}"`);
    }
  }

  // Also reclassify some existing generic "Rooms" properties to Mountains, Iconic Cities, Trending, Castles, etc.
  await Listing.updateMany({ location: "Aspen" }, { $set: { category: "Mountains" } });
  await Listing.updateMany({ location: "Florence" }, { $set: { category: "Farms" } });
  await Listing.updateMany({ location: "New York City" }, { $set: { category: "Iconic Cities" } });
  await Listing.updateMany({ location: "Malibu" }, { $set: { category: "Trending" } });
  await Listing.updateMany({ location: "Cancun" }, { $set: { category: "Trending" } });
  await Listing.updateMany({ location: "Amsterdam" }, { $set: { category: "Boats" } });
  await Listing.updateMany({ location: "Paris" }, { $set: { category: "Iconic Cities" } });
  await Listing.updateMany({ location: "Bali" }, { $set: { category: "Amazing pool" } });
  await Listing.updateMany({ location: "Lake Tahoe" }, { $set: { category: "Camping" } });

  console.log("All categories populated!");
  process.exit(0);
}

seedCategories().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
