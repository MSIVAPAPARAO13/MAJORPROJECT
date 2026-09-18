const mongoose = require('mongoose');
const Listing = require('../src/models/listing');

const categoryFallbacks = {
  "Boats": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
  "Hostels": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
  "Camping": "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
  "Arctic": "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80",
  "Domes": "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80",
  "Mountains": "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=1200&q=80",
  "Rooms": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
  "Trending": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
  "Castles": "https://images.unsplash.com/photo-1585543805890-6051f7829f98?auto=format&fit=crop&w=1200&q=80",
  "Amazing pool": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
  "Farms": "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1200&q=80",
  "Iconic Cities": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1200&q=80",
  "default": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"
};

async function fixImages() {
  await mongoose.connect(process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust');
  console.log("Connected to DB, scanning images...");

  const listings = await Listing.find({});
  let fixedCount = 0;

  for (let l of listings) {
    const url = l.image && l.image.url;
    let isBroken = false;

    if (!url || !url.startsWith("http")) {
      isBroken = true;
    } else {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) {
          isBroken = true;
          console.log(`Broken URL (${res.status}) for: "${l.title}" -> ${url}`);
        }
      } catch (err) {
        isBroken = true;
        console.log(`Failed fetch for: "${l.title}" -> ${err.message}`);
      }
    }

    if (isBroken) {
      const fallback = categoryFallbacks[l.category] || categoryFallbacks["default"];
      l.image = {
        filename: "fixed_" + (l.category || "stay").toLowerCase(),
        url: fallback
      };
      await l.save();
      fixedCount++;
      console.log(`  -> Fixed "${l.title}" with: ${fallback}`);
    }
  }

  console.log(`\nScan complete! Fixed ${fixedCount} broken listing images.`);
  process.exit(0);
}

fixImages().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
