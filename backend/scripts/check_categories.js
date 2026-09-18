const mongoose = require("mongoose");
const Listing = require("../src/models/listing");

async function check() {
  await mongoose.connect(process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust");
  const categories = [
    "All", "Hostels", "Rooms", "Trending", "Iconic Cities", "Mountains",
    "Castles", "Amazing pool", "Camping", "Farms", "Arctic", "Domes", "Boats"
  ];
  console.log("Category counts in DB:");
  for (let cat of categories) {
    if (cat === "All") {
      const count = await Listing.countDocuments();
      console.log(`- ${cat}: ${count}`);
    } else {
      const count = await Listing.countDocuments({ category: cat });
      console.log(`- ${cat}: ${count}`);
    }
  }
  process.exit(0);
}
check();
