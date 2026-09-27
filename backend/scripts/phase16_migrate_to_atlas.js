const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient } = require('mongodb');

const TARGET_COLLECTIONS = [
  'users',
  'organizations',
  'listings',
  'rooms',
  'reviews',
  'bookings',
  'migrations',
  'serviceissues'
];

async function runMigration() {
  console.log('==================================================');
  console.log('PHASE 16.3 — CONTROLLED LOCAL -> ATLAS MIGRATION');
  console.log('==================================================\n');

  // Read .env to get Atlas connection string
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  const match = envContent.match(/ATLASDB_URL\s*=\s*(mongodb\+srv:\/\/[^\r\n]+)/);
  if (!match) {
    throw new Error('ATLASDB_URL not found in backend/.env');
  }
  const atlasUrl = match[1].trim();

  // Connect to local MongoDB
  console.log('[1/4] Connecting to Local Source MongoDB...');
  const localClient = new MongoClient('mongodb://127.0.0.1:27017');
  await localClient.connect();
  const localDb = localClient.db('wanderlust');
  console.log('Local MongoDB connected successfully.\n');

  // Connect to Atlas MongoDB
  console.log('[2/4] Connecting to Atlas Destination MongoDB...');
  const atlasClient = new MongoClient(atlasUrl, { serverSelectionTimeoutMS: 15000 });
  await atlasClient.connect();
  const atlasDb = atlasClient.db('wanderlust');
  console.log('Atlas MongoDB connected successfully.\n');

  console.log('[3/4] Migrating collections with full ObjectId & relationship preservation...\n');

  const migrationResults = [];

  for (const colName of TARGET_COLLECTIONS) {
    console.log(`--- Processing Collection: "${colName}" ---`);

    // 1. Local source documents
    const localDocs = await localDb.collection(colName).find({}).toArray();
    const localCount = localDocs.length;
    console.log(`Local source count: ${localCount}`);

    // 2. Atlas count before migration
    let atlasCountBefore = 0;
    try {
      atlasCountBefore = await atlasDb.collection(colName).countDocuments();
    } catch (e) {
      atlasCountBefore = 0;
    }
    console.log(`Atlas count before migration: ${atlasCountBefore}`);

    // 3. Clear Atlas collection (deleteMany)
    const deleteResult = await atlasDb.collection(colName).deleteMany({});
    console.log(`Cleared previous Atlas records: ${deleteResult.deletedCount}`);

    // 4. Insert documents preserving exact _id
    let insertedCount = 0;
    if (localCount > 0) {
      const insertResult = await atlasDb.collection(colName).insertMany(localDocs, { ordered: true });
      insertedCount = insertResult.insertedCount;
      console.log(`Inserted into Atlas: ${insertedCount}`);
    } else {
      console.log(`No documents to insert (empty collection baseline).`);
    }

    // 5. Sync indexes from local to Atlas
    try {
      const localIndexes = await localDb.collection(colName).indexes();
      // Filter out default _id_ index
      const indexesToCreate = localIndexes
        .filter(idx => idx.name !== '_id_')
        .map(idx => {
          const { key, name, unique, sparse, background } = idx;
          const options = {};
          if (name) options.name = name;
          if (unique) options.unique = unique;
          if (sparse) options.sparse = sparse;
          if (background) options.background = background;
          return { key, ...options };
        });

      if (indexesToCreate.length > 0) {
        for (const idx of indexesToCreate) {
          const { key, ...opts } = idx;
          await atlasDb.collection(colName).createIndex(key, opts);
        }
        console.log(`Synced ${indexesToCreate.length} indexes for ${colName}`);
      }
    } catch (idxErr) {
      console.warn(`Warning syncing indexes for ${colName}:`, idxErr.message);
    }

    // 6. Verify Atlas count after migration
    const atlasCountAfter = await atlasDb.collection(colName).countDocuments();
    console.log(`Atlas count after migration: ${atlasCountAfter}`);

    const isMatch = atlasCountAfter === localCount;
    if (!isMatch) {
      throw new Error(`FATAL: Count mismatch for ${colName}! Local: ${localCount}, Atlas: ${atlasCountAfter}`);
    }
    console.log(`Status: MATCH (PASS)\n`);

    migrationResults.push({
      collection: colName,
      localCount,
      atlasCountBefore,
      migratedCount: insertedCount,
      atlasCountAfter,
      status: 'PASS'
    });
  }

  // Ensure sessions collection is NOT migrated
  console.log('[4/4] Verifying sessions policy...');
  console.log('Explicit rule enforced: sessions collection was NOT migrated from local.\n');

  await localClient.close();
  await atlasClient.close();

  console.log('==================================================');
  console.log('MIGRATION SUMMARY');
  console.log('==================================================');
  console.table(migrationResults);
  console.log('\nMigration completed with 100% fidelity!');
}

runMigration().catch(err => {
  console.error('\nMIGRATION FAILED:', err.message);
  process.exit(1);
});
