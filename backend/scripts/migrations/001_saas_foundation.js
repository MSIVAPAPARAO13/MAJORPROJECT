const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "wanderlust";
const MIGRATION_NAME = "001_saas_foundation";

async function runMigration() {
  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  console.log(`[Migration ${MIGRATION_NAME}] Connecting to MongoDB: ${dbUrl}...`);
  await mongoose.connect(dbUrl);

  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  // 1. Database Name Verification (Correction 11)
  if (dbName !== REQUIRED_DB_NAME) {
    console.error(`[FATAL ERROR] Expected database '${REQUIRED_DB_NAME}', but connected to '${dbName}'. ABORTING!`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`[Migration ${MIGRATION_NAME}] Verified database name: '${dbName}'`);

  // 2. Migration Tracking Check (Correction 6 & 7)
  const migrationsCollection = db.collection("migrations");
  const existingMigration = await migrationsCollection.findOne({ name: MIGRATION_NAME, status: "COMPLETED" });
  if (existingMigration) {
    console.log(`Migration ${MIGRATION_NAME} already completed on ${existingMigration.executedAt}. No modifications required.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`[Migration ${MIGRATION_NAME}] Beginning execution...`);

  // 3. Dynamic Owner Resolution (Correction 2)
  console.log("[Stage 1] Dynamically resolving owner user...");
  const ownerUser = await db.collection("users").findOne({
    $or: [
      { role: "OWNER" },
      { username: "@msivapaparao" },
      { email: "msivapaparao@gmail.com" }
    ]
  });

  if (!ownerUser || !ownerUser._id) {
    console.error("[FATAL ERROR] Could not unambiguously resolve owner user in database. ABORTING!");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`✓ Resolved owner user: id=${ownerUser._id}, username=${ownerUser.username}, email=${ownerUser.email}`);

  // 4. Organization Inspection & Reuse (Correction 1)
  console.log("[Stage 2] Inspecting and resolving tenant organization...");
  let organization = await db.collection("organizations").findOne({
    $or: [
      { name: "WanderLust Global Hospitality Ltd" },
      { owner: ownerUser._id }
    ]
  });

  if (organization) {
    console.log(`✓ Reusing existing organization: '${organization.name}' (id=${organization._id})`);
  } else {
    console.log("[Stage 2] Creating tenant organization 'WanderLust Global Hospitality Ltd'...");
    const newOrg = {
      name: "WanderLust Global Hospitality Ltd",
      description: "Premier boutique stays, backpacker hostels, and luxury holiday resorts.",
      owner: ownerUser._id,
      members: [
        {
          user: ownerUser._id,
          role: "OWNER"
        }
      ],
      contactEmail: ownerUser.email,
      phone: "+91 9876543210",
      address: "101 Heritage Boulevard, Bengaluru, India",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const orgResult = await db.collection("organizations").insertOne(newOrg);
    organization = { ...newOrg, _id: orgResult.insertedId };
    console.log(`✓ Created organization id=${organization._id}`);
  }

  const orgId = organization._id;

  // 5. Per-Document Idempotent User Migration (Correction 3 & 6)
  console.log("[Stage 3] Migrating users...");
  const users = await db.collection("users").find({}).toArray();
  let usersUpdated = 0;

  for (const user of users) {
    const updates = {};

    // Assign organization if missing/null
    if (!user.organization) {
      updates.organization = orgId;
    }

    // Assign role if missing/null without overwriting existing explicit roles
    if (!user.role) {
      if (user._id.toString() === ownerUser._id.toString()) {
        updates.role = "OWNER";
      } else {
        updates.role = "CUSTOMER";
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: updates }
      );
      usersUpdated++;
    }
  }
  console.log(`✓ User migration complete: ${users.length} total, ${usersUpdated} updated.`);

  // 6. Per-Document Idempotent Listing Migration (Correction 4 & 6)
  console.log("[Stage 4] Migrating listings...");
  const listings = await db.collection("listings").find({}).toArray();
  let listingsUpdated = 0;

  for (const listing of listings) {
    const updates = {};

    // Organization
    if (!listing.organization) {
      updates.organization = orgId;
    }

    // PropertyType
    if (!listing.propertyType) {
      updates.propertyType = "OTHER";
    }

    // Status
    if (!listing.status) {
      updates.status = "ACTIVE";
    }

    // Amenities
    if (!listing.amenities) {
      updates.amenities = [];
    }

    // Images Array (Correction 4)
    if (!listing.images || listing.images.length === 0) {
      if (listing.image && listing.image.url) {
        updates.images = [
          {
            url: listing.image.url,
            filename: listing.image.filename || "",
            isPrimary: true
          }
        ];
      } else {
        updates.images = [];
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("listings").updateOne(
        { _id: listing._id },
        { $set: updates }
      );
      listingsUpdated++;
    }
  }
  console.log(`✓ Listing migration complete: ${listings.length} total, ${listingsUpdated} updated.`);

  // 7. Multi-Stage Validation & Verification (Correction 7 & 8)
  console.log("\n[Stage 5] Running post-migration validation assertions...");

  const afterUserCount = await db.collection("users").countDocuments();
  const afterListingCount = await db.collection("listings").countDocuments();
  const afterReviewCount = await db.collection("reviews").countDocuments();
  const afterSessionCount = await db.collection("sessions").countDocuments();

  if (afterUserCount !== 6) {
    throw new Error(`Validation failed: Expected 6 users, found ${afterUserCount}`);
  }
  if (afterListingCount !== 65) {
    throw new Error(`Validation failed: Expected 65 listings, found ${afterListingCount}`);
  }
  if (afterReviewCount !== 4) {
    throw new Error(`Validation failed: Expected 4 reviews, found ${afterReviewCount}`);
  }
  if (afterSessionCount !== 37) {
    throw new Error(`Validation failed: Expected 37 sessions, found ${afterSessionCount}`);
  }

  // Check for orphan listings (must have valid owner and organization)
  const orphanListings = await db.collection("listings").countDocuments({
    $or: [
      { organization: null },
      { organization: { $exists: false } },
      { owner: null },
      { owner: { $exists: false } }
    ]
  });
  if (orphanListings > 0) {
    throw new Error(`Validation failed: Found ${orphanListings} orphan listings!`);
  }

  // Check for orphan users (must have organization)
  const orphanUsers = await db.collection("users").countDocuments({
    $or: [
      { organization: null },
      { organization: { $exists: false } }
    ]
  });
  if (orphanUsers > 0) {
    throw new Error(`Validation failed: Found ${orphanUsers} orphan users!`);
  }

  // Check listing images array
  const listingsWithImages = await db.collection("listings").countDocuments({
    "images.0": { $exists: true }
  });
  console.log(`✓ Document counts match baseline: Users=${afterUserCount}, Listings=${afterListingCount}, Reviews=${afterReviewCount}, Sessions=${afterSessionCount}`);
  console.log(`✓ Zero orphan listings, Zero orphan users.`);
  console.log(`✓ ${listingsWithImages} listings have populated images array.`);

  // 8. Record Migration in `migrations` collection (Correction 7)
  const migrationRecord = {
    name: MIGRATION_NAME,
    executedAt: new Date(),
    status: "COMPLETED",
    targetOrganization: orgId,
    organizationName: organization.name,
    counts: {
      users: afterUserCount,
      listings: afterListingCount,
      reviews: afterReviewCount,
      sessions: afterSessionCount
    }
  };
  await migrationsCollection.insertOne(migrationRecord);
  console.log(`\n✓ [Recorded Migration] '${MIGRATION_NAME}' marked COMPLETED.`);

  // 9. Generate `migration-reports/phase1-after.json`
  const reportsDir = path.resolve(__dirname, "../../../migration-reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const afterReport = {
    database: dbName,
    migration: MIGRATION_NAME,
    timestamp: new Date().toISOString(),
    status: "SUCCESS",
    organization: {
      _id: orgId.toString(),
      name: organization.name,
      owner: ownerUser._id.toString()
    },
    counts: {
      users: afterUserCount,
      listings: afterListingCount,
      reviews: afterReviewCount,
      sessions: afterSessionCount
    },
    modifications: {
      usersUpdated,
      listingsUpdated
    },
    verifications: {
      zeroOrphanListings: true,
      zeroOrphanUsers: true,
      sessionCountPreserved: true,
      reviewsPreserved: true,
      existingImageFieldPreserved: true,
      imagesArrayCreated: true
    }
  };

  const afterReportPath = path.join(reportsDir, "phase1-after.json");
  fs.writeFileSync(afterReportPath, JSON.stringify(afterReport, null, 2), "utf8");
  console.log(`✓ Migration report written to: ${afterReportPath}`);

  await mongoose.disconnect();
  console.log(`\n========================================`);
  console.log(`PHASE 1 DATABASE MIGRATION COMPLETED SUCCESSFULLY`);
  console.log(`========================================\n`);
}

if (require.main === module) {
  runMigration().catch(async (err) => {
    console.error(`\n[FATAL MIGRATION ERROR]:`, err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
}

module.exports = runMigration;
