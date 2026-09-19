const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const REQUIRED_DB_NAME = "wanderlust";

async function runRollback() {
  const args = process.argv.slice(2);
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const confirmArg = args.includes("--confirm");

  if (!backupDirArg) {
    console.error(`
[SAFETY GUARD] Rollback will NEVER run automatically.
Usage:
  node scripts/migrations/rollback_backup.js --backup-dir=<FULL_PATH_TO_BACKUP> --confirm

Example:
  node scripts/migrations/rollback_backup.js --backup-dir="C:\\Users\\msiva\\wanderlust_mongodb_backups\\wanderlust_backup_XXXX" --confirm
`);
    process.exit(1);
  }

  const backupDir = backupDirArg.split("=")[1].replace(/^["']|["']$/g, "");

  if (!fs.existsSync(backupDir)) {
    console.error(`[ERROR] Specified backup directory does not exist: ${backupDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(backupDir, "backup_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] Backup manifest not found in: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`\n========================================`);
  console.log(`WANDERLUST ROLLBACK RESTORATION`);
  console.log(`========================================`);
  console.log(`Backup Directory: ${backupDir}`);
  console.log(`Backup Timestamp: ${manifest.timestamp}`);
  console.log(`Original DB:      ${manifest.database}`);

  if (!confirmArg) {
    console.error(`
[SAFETY GUARD] Confirmation flag '--confirm' missing!
Rollback will NOT proceed without explicit confirmation.
Append '--confirm' to the command line to restore this backup.
`);
    process.exit(1);
  }

  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  await mongoose.connect(dbUrl);

  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  if (dbName !== REQUIRED_DB_NAME) {
    console.error(`[FATAL ERROR] Expected database '${REQUIRED_DB_NAME}', but connected to '${dbName}'. ABORTING!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Connected to target database: '${dbName}'`);
  console.log(`Beginning controlled restore from verified backup...\n`);

  const collections = Object.keys(manifest.collections);
  for (const name of collections) {
    const filePath = path.join(backupDir, `${name}.ejson`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[Skip] No backup file for collection '${name}'`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const docs = mongoose.mongo.BSON.EJSON.parse(content);
    const col = db.collection(name);

    // Replace docs with backup docs
    await col.deleteMany({});
    if (docs.length > 0) {
      await col.insertMany(docs);
    }
    console.log(`✓ Restored '${name}': ${docs.length} documents.`);
  }

  // Remove migration record if present
  try {
    await db.collection("migrations").deleteOne({ name: "001_saas_foundation" });
    console.log("✓ Removed migration record for '001_saas_foundation'.");
  } catch (_) {}

  await mongoose.disconnect();
  console.log(`\n✓ [Rollback Complete] Database restored to pre-migration baseline from:\n  ${backupDir}\n`);
}

if (require.main === module) {
  runRollback().catch((err) => {
    console.error("[Fatal Error during rollback]:", err);
    process.exit(1);
  });
}

module.exports = runRollback;
