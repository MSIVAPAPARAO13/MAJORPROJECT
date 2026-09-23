/**
 * Phase 14: Production Readiness & Deployment Verification Test Suite
 *
 * Verifies:
 * 1. GET /api/health probes live database connection (status 200 vs 503)
 * 2. GET /api/health does not leak any internal credentials or URLs
 * 3. trust proxy configuration in production mode
 * 4. Production environment variable validation
 * 5. CORS configuration with ALLOWED_ORIGINS / CORS_ORIGINS
 * 6. Database cleanliness and non-pollution
 */

const request = require("supertest");
const mongoose = require("mongoose");
const createApp = require("../src/app");
const { validateEnv } = require("../src/config/envValidator");
const { connectTestDb, disconnectTestDb } = require("./helpers/testDb");

let passCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg, err) {
  failCount++;
  console.error(`  ✗ FAIL: ${msg}`, err || "");
}

async function runPhase14Tests() {
  console.log("==================================================");
  console.log("PHASE 14 PRODUCTION READINESS TEST SUITE");
  console.log("==================================================\n");

  await connectTestDb();
  const app = createApp();

  // --- 1. HEALTH CHECK ENDPOINT (LIVE DATABASE) ---
  console.log("--- 1. HEALTH CHECK ENDPOINT (CONNECTED) ---");
  try {
    const res = await request(app).get("/api/health");
    if (res.status === 200) pass("GET /api/health returns HTTP 200 when database connected");
    else fail(`Expected 200, got ${res.status}`);

    if (res.body.status === "ok") pass("Health status is 'ok'");
    else fail(`Expected status 'ok', got ${res.body.status}`);

    if (res.body.database === "connected") pass("Health database status is 'connected'");
    else fail(`Expected database 'connected', got ${res.body.database}`);

    if (typeof res.body.uptime === "number") pass("Health report contains numeric uptime");
    else fail("Uptime missing or non-numeric");

    if (res.body.timestamp && !isNaN(Date.parse(res.body.timestamp))) pass("Health report contains valid ISO timestamp");
    else fail("Timestamp missing or invalid");

    // Leak checks
    const jsonStr = JSON.stringify(res.body);
    if (!jsonStr.includes("mongodb") && !jsonStr.includes("127.0.0.1") && !jsonStr.includes("secret") && !jsonStr.includes("password")) {
      pass("GET /api/health does not leak database credentials, URIs, or secrets");
    } else {
      fail("Sensitive details detected in /api/health response payload");
    }
  } catch (err) {
    fail("Health check request failed", err);
  }

  // --- 2. HEALTH CHECK ENDPOINT (DISCONNECTED SIMULATION) ---
  console.log("\n--- 2. HEALTH CHECK ENDPOINT (DISCONNECTED SIMULATION) ---");
  try {
    // Temporarily mock readyState to 0 (disconnected)
    const originalDesc = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState") || {
      value: mongoose.connection.readyState,
      writable: true,
      configurable: true,
    };
    Object.defineProperty(mongoose.connection, "readyState", { value: 0, writable: true, configurable: true });

    const resDegraded = await request(app).get("/api/health");
    if (resDegraded.status === 503) pass("GET /api/health returns HTTP 503 when database disconnected");
    else fail(`Expected 503, got ${resDegraded.status}`);

    if (resDegraded.body.status === "degraded") pass("Status is 'degraded' when disconnected");
    else fail(`Expected 'degraded', got ${resDegraded.body.status}`);

    if (resDegraded.body.database === "disconnected") pass("Database is reported as 'disconnected'");
    else fail(`Expected 'disconnected', got ${resDegraded.body.database}`);

    // Restore readyState
    if (originalDesc.get) {
      Object.defineProperty(mongoose.connection, "readyState", originalDesc);
    } else {
      Object.defineProperty(mongoose.connection, "readyState", {
        value: originalDesc.value !== undefined ? originalDesc.value : 1,
        writable: true,
        configurable: true,
      });
    }
  } catch (err) {
    fail("Simulated disconnection health check failed", err);
  }

  // --- 3. REVERSE PROXY & TRUST PROXY CONFIGURATION ---
  console.log("\n--- 3. REVERSE PROXY & TRUST PROXY CONFIGURATION ---");
  try {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prodApp = createApp();
    const isTrustProxy = prodApp.get("trust proxy");

    if (isTrustProxy === 1 || isTrustProxy === true) {
      pass("Production app enables 'trust proxy' for reverse proxy TLS termination");
    } else {
      fail(`Expected 'trust proxy' to be 1 or true in production, got: ${isTrustProxy}`);
    }

    process.env.NODE_ENV = "development";
    const devApp = createApp();
    if (!devApp.get("trust proxy")) {
      pass("Development app leaves 'trust proxy' disabled (default)");
    } else {
      fail("Development app unexpectedly enabled trust proxy");
    }

    process.env.NODE_ENV = origEnv;
  } catch (err) {
    fail("Trust proxy verification failed", err);
  }

  // --- 4. PRODUCTION ENVIRONMENT VALIDATION ---
  console.log("\n--- 4. PRODUCTION ENVIRONMENT VALIDATION ---");
  try {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    // Backup current env
    const saved = {
      ATLASDB_URL: process.env.ATLASDB_URL,
      SECRET: process.env.SECRET,
      CLOUD_NAME: process.env.CLOUD_NAME,
      CLOUD_API_KEY: process.env.CLOUD_API_KEY,
      CLOUD_API_SECRET: process.env.CLOUD_API_SECRET,
      MAP_TOKEN: process.env.MAP_TOKEN,
      MONGODB_URI: process.env.MONGODB_URI,
      SESSION_SECRET: process.env.SESSION_SECRET,
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
    };

    // Test: all required present
    process.env.ATLASDB_URL = "mongodb://dummy";
    process.env.SECRET = "dummy_secret";
    process.env.CLOUD_NAME = "dummy_cloud";
    process.env.CLOUD_API_KEY = "dummy_key";
    process.env.CLOUD_API_SECRET = "dummy_secret";
    process.env.MAP_TOKEN = "dummy_map";

    let noThrow = true;
    try {
      validateEnv();
    } catch {
      noThrow = false;
    }
    if (noThrow) pass("validateEnv passes when all authoritative production variables are set");
    else fail("validateEnv unexpectedly threw with all required vars present");

    // Test: missing variable triggers error
    delete process.env.ATLASDB_URL;
    delete process.env.MONGODB_URI;
    let threw = false;
    try {
      validateEnv();
    } catch (e) {
      threw = true;
      if (e.message.includes("ATLASDB_URL")) pass("validateEnv explicitly flags missing ATLASDB_URL");
      else fail(`Unexpected error message: ${e.message}`);
    }
    if (threw) pass("validateEnv successfully blocks production startup when DB url is missing");
    else fail("validateEnv failed to block missing DB url");

    // Restore env
    Object.assign(process.env, saved);
    process.env.NODE_ENV = origEnv;
  } catch (err) {
    fail("validateEnv verification failed", err);
  }

  // --- 5. CORS & ORIGIN ISOLATION ---
  console.log("\n--- 5. CORS & ORIGIN ISOLATION ---");
  try {
    const resAllowed = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    if (resAllowed.headers["access-control-allow-origin"] === "http://localhost:5173") {
      pass("Allowed origin receives Access-Control-Allow-Origin header");
    } else {
      fail(`Expected origin echo, got: ${resAllowed.headers["access-control-allow-origin"]}`);
    }

    if (resAllowed.headers["access-control-allow-credentials"] === "true") {
      pass("Access-Control-Allow-Credentials is set to 'true'");
    } else {
      fail("Credentials header missing or false");
    }

    const resDisallowed = await request(app)
      .get("/api/health")
      .set("Origin", "https://malicious-site.com");

    if (!resDisallowed.headers["access-control-allow-origin"]) {
      pass("Untrusted origin does NOT receive Access-Control-Allow-Origin header");
    } else {
      fail(`Untrusted origin unexpectedly allowed: ${resDisallowed.headers["access-control-allow-origin"]}`);
    }
  } catch (err) {
    fail("CORS verification failed", err);
  }

  // --- 6. TEARDOWN & DATABASE HYGIENE ---
  console.log("\n--- 6. TEARDOWN & DATABASE HYGIENE ---");
  const collections = await mongoose.connection.db.listCollections().toArray();
  const counts = {};
  for (const c of collections) {
    counts[c.name] = await mongoose.connection.db.collection(c.name).countDocuments();
  }

  const expected = {
    listings: 65,
    rooms: 134,
    users: 6,
    organizations: 1,
    reviews: 4,
    bookings: 0,
    migrations: 1,
    serviceissues: 0,
  };

  let allPreserved = true;
  for (const [col, expCount] of Object.entries(expected)) {
    const actual = counts[col] !== undefined ? counts[col] : 0;
    if (actual === expCount) {
      pass(`Baseline ${col} count preserved: ${expCount} (Found: ${actual})`);
    } else {
      allPreserved = false;
      fail(`Baseline ${col} mismatch! Expected ${expCount}, found ${actual}`);
    }
  }

  await disconnectTestDb();

  console.log("\n==================================================");
  console.log(`TOTAL PHASE 14 TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log("==================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase14Tests().catch((err) => {
  console.error("Unhandled error in Phase 14 test runner:", err);
  process.exit(1);
});
