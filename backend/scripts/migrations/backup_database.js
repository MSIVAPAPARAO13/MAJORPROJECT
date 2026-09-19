const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "wanderlust";
const BACKUP_ROOT = path.resolve("C:/Users/msiva/wanderlust_mongodb_backups");

async function runBackup() {
  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  console.log(`[Backup] Connecting to MongoDB: ${dbUrl}...`);
  await mongoose.connect(dbUrl);

  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  if (dbName !== REQUIRED_DB_NAME) {
    console.error(`[FATAL ERROR] Expected database '${REQUIRED_DB_NAME}', but connected to '${dbName}'. ABORTING!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`[Backup] Confirmed database name: '${dbName}'`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(BACKUP_ROOT, `wanderlust_backup_${timestamp}`);

  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`[Backup] Target directory: ${backupDir}`);

  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);
  console.log(`[Backup] Collections found (${collectionNames.length}): ${collectionNames.join(", ")}`);

  const summary = {
    database: dbName,
    timestamp: new Date().toISOString(),
    backupDir,
    collections: {}
  };

  // 1. Export each collection
  for (const name of collectionNames) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    const filePath = path.join(backupDir, `${name}.ejson`);
    const ejsonContent = mongoose.mongo.BSON.EJSON.stringify(docs, null, 2);
    fs.writeFileSync(filePath, ejsonContent, "utf8");
    summary.collections[name] = {
      liveCount: docs.length,
      filePath,
      fileSizeBytes: fs.statSync(filePath).size
    };
    console.log(`[Backup] Exported '${name}': ${docs.length} documents (${summary.collections[name].fileSizeBytes} bytes)`);
  }

  // 2. Deep Verification (Correction 8)
  console.log("\n[Backup Verification] Performing deep verification of backed up files...");
  let verificationPassed = true;

  for (const name of collectionNames) {
    const filePath = path.join(backupDir, `${name}.ejson`);
    if (!fs.existsSync(filePath)) {
      console.error(`[Verification Failed] Backup file does not exist: ${filePath}`);
      verificationPassed = false;
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    let parsedDocs;
    try {
      parsedDocs = mongoose.mongo.BSON.EJSON.parse(content);
    } catch (parseErr) {
      console.error(`[Verification Failed] Could not parse EJSON in '${filePath}':`, parseErr.message);
      verificationPassed = false;
      continue;
    }

    const liveCount = summary.collections[name].liveCount;
    if (parsedDocs.length !== liveCount) {
      console.error(`[Verification Failed] Count mismatch for '${name}': parsed ${parsedDocs.length} != live ${liveCount}`);
      verificationPassed = false;
      continue;
    }

    console.log(`✓ '${name}': verified ${parsedDocs.length} documents match live database count.`);
  }

  // Write backup manifest
  fs.writeFileSync(path.join(backupDir, "backup_manifest.json"), JSON.stringify(summary, null, 2), "utf8");

  await mongoose.disconnect();

  if (!verificationPassed) {
    console.error("\n[FATAL ERROR] Backup verification FAILED! Aborting migration.");
    process.exit(1);
  }

  console.log(`\n✓ [Backup Success] All ${collectionNames.length} collections backed up and verified successfully at:`);
  console.log(`  ${backupDir}\n`);
  return backupDir;
}

if (require.main === module) {
  runBackup().catch((err) => {
    console.error("[Fatal Error in Backup Script]:", err);
    process.exit(1);
  });
}

module.exports = runBackup;
