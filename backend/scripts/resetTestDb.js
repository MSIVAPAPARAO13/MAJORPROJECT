/**
 * Local Test Database Reset Script
 * Empties all collections in TEST_MONGODB_URI.
 * Protected with hard safety guards against touching production Atlas.
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/wanderlust_test";

if (
  TEST_DB_URI.includes("mongodb.net") ||
  TEST_DB_URI.includes("cluster") ||
  (process.env.ATLASDB_URL && TEST_DB_URI === process.env.ATLASDB_URL)
) {
  console.error("CRITICAL SAFETY ERROR: Attempted to run test reset against production Atlas! Aborting immediately.");
  process.exit(1);
}

async function resetTestDb() {
  console.log(`Resetting test database: ${TEST_DB_URI}...`);
  await mongoose.connect(TEST_DB_URI);

  const collections = await mongoose.connection.db.collections();
  for (const col of collections) {
    await col.deleteMany({});
  }

  console.log(`Cleared all collections in ${TEST_DB_URI}.`);
  await mongoose.disconnect();
}

resetTestDb().catch((err) => {
  console.error("Reset test DB error:", err);
  process.exit(1);
});
