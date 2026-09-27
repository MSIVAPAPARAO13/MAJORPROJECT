const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient, BSON } = require('mongodb');

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

async function backupDatabase(connectionUri, dbName, outDir, label) {
  console.log(`\n========================================`);
  console.log(`Starting ${label} Backup...`);
  console.log(`Target database: ${dbName}`);
  console.log(`Output folder: ${outDir}`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const client = new MongoClient(connectionUri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(dbName);
  
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`Collections found:`, collectionNames);

  const manifest = {
    label,
    dbName,
    timestamp: new Date().toISOString(),
    collections: {}
  };

  for (const colName of collectionNames) {
    const col = db.collection(colName);
    const docs = await col.find({}).toArray();
    console.log(`[Backup] ${colName}: dumping ${docs.length} documents...`);

    // 1. Save Canonical Extended JSON
    const jsonPath = path.join(outDir, `${colName}.json`);
    const canonicalJson = BSON.EJSON.stringify(docs, { relaxed: false }, 2);
    fs.writeFileSync(jsonPath, canonicalJson, 'utf8');

    // 2. Save raw BSON (standard mongodump format)
    const bsonPath = path.join(outDir, `${colName}.bson`);
    const bsonBuffers = docs.map(d => BSON.serialize(d));
    const combinedBuffer = Buffer.concat(bsonBuffers);
    fs.writeFileSync(bsonPath, combinedBuffer);

    manifest.collections[colName] = {
      count: docs.length,
      jsonSizeBytes: fs.statSync(jsonPath).size,
      bsonSizeBytes: fs.statSync(bsonPath).size
    };
  }

  const manifestPath = path.join(outDir, 'metadata.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Manifest written to: ${manifestPath}`);

  await client.close();
  console.log(`${label} Backup completed successfully!`);
  return manifest;
}

async function runBackups() {
  const ts = getTimestamp();
  const backupsBase = path.resolve(__dirname, '../backups');

  // Read .env to get Atlas URL
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  const match = envContent.match(/ATLASDB_URL\s*=\s*(mongodb\+srv:\/\/[^\r\n]+)/);
  if (!match) {
    throw new Error('ATLASDB_URL not found in backend/.env');
  }
  const atlasUrl = match[1].trim();

  // 1. Local backup
  const localOut = path.join(backupsBase, `local_backup_${ts}`);
  const localManifest = await backupDatabase('mongodb://127.0.0.1:27017', 'wanderlust', localOut, 'LOCAL');

  // 2. Atlas pre-migration backup
  const atlasOut = path.join(backupsBase, `atlas_pre_migration_backup_${ts}`);
  const atlasManifest = await backupDatabase(atlasUrl, 'wanderlust', atlasOut, 'ATLAS_PRE_MIGRATION');

  console.log('\n========================================');
  console.log('ALL BACKUPS COMPLETED SUCCESSFULLY:');
  console.log('Local Backup Path:', localOut);
  console.log('Local Counts:', JSON.stringify(localManifest.collections, null, 2));
  console.log('Atlas Backup Path:', atlasOut);
  console.log('Atlas Counts:', JSON.stringify(atlasManifest.collections, null, 2));
}

runBackups().catch(err => {
  console.error('BACKUP FAILED:', err.message);
  process.exit(1);
});
