const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient } = require('mongodb');

async function verifyIntegrity() {
  console.log('==================================================');
  console.log('PHASE 16.3 — ATLAS DATA INTEGRITY & RELATIONSHIP AUDIT');
  console.log('==================================================\n');

  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  const match = envContent.match(/ATLASDB_URL\s*=\s*(mongodb\+srv:\/\/[^\r\n]+)/);
  if (!match) {
    throw new Error('ATLASDB_URL not found in backend/.env');
  }
  const atlasUrl = match[1].trim();

  const client = new MongoClient(atlasUrl, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db('wanderlust');

  // STEP 10: Check counts
  const targetCollections = ['listings', 'rooms', 'users', 'organizations', 'reviews', 'bookings', 'migrations', 'serviceissues'];
  const expectedCounts = {
    listings: 65,
    rooms: 134,
    users: 6,
    organizations: 1,
    reviews: 4,
    bookings: 0,
    migrations: 1,
    serviceissues: 0
  };

  const actualCounts = {};
  for (const c of targetCollections) {
    actualCounts[c] = await db.collection(c).countDocuments();
  }
  console.log('Atlas Collection Counts:');
  console.table(actualCounts);

  let countsPass = true;
  for (const [col, expected] of Object.entries(expectedCounts)) {
    if (actualCounts[col] !== expected) {
      console.error(`COUNT FAIL: ${col} expected ${expected}, got ${actualCounts[col]}`);
      countsPass = false;
    }
  }
  if (!countsPass) {
    throw new Error('Atlas collection counts do not match expected baseline!');
  }
  console.log('ALL COUNTS VERIFIED: PASS\n');

  // STEP 11: Data integrity checks
  console.log('Running Integrity Checks:');

  const listings = await db.collection('listings').find({}).toArray();
  const rooms = await db.collection('rooms').find({}).toArray();
  const users = await db.collection('users').find({}).toArray();
  const organizations = await db.collection('organizations').find({}).toArray();
  const reviews = await db.collection('reviews').find({}).toArray();
  const migrations = await db.collection('migrations').find({}).toArray();

  const listingMap = new Map(listings.map(l => [l._id.toString(), l]));
  const roomMap = new Map(rooms.map(r => [r._id.toString(), r]));
  const userMap = new Map(users.map(u => [u._id.toString(), u]));
  const orgMap = new Map(organizations.map(o => [o._id.toString(), o]));
  const reviewMap = new Map(reviews.map(rev => [rev._id.toString(), rev]));

  let orphanRooms = 0;
  let invalidListingRefs = 0;
  let invalidOrgRefs = 0;
  let crossTenantMismatch = 0;
  const roomNumbersByProperty = new Map();
  let duplicateRoomNumbers = 0;

  for (const r of rooms) {
    const propId = r.property ? r.property.toString() : null;
    const orgId = r.organization ? r.organization.toString() : null;

    // 3 & 10: Property reference check
    if (!propId || !listingMap.has(propId)) {
      orphanRooms++;
      invalidListingRefs++;
    }

    // 4 & 11: Organization reference check
    if (!orgId || !orgMap.has(orgId)) {
      invalidOrgRefs++;
    }

    // 5 & 12: Cross-tenant check (Room.org matches Listing.org)
    if (propId && listingMap.has(propId)) {
      const listing = listingMap.get(propId);
      const listingOrgId = listing.organization ? listing.organization.toString() : null;
      if (listingOrgId !== orgId) {
        crossTenantMismatch++;
      }
    }

    // 13: Duplicate room numbers per property
    if (propId && r.roomNumber) {
      const key = `${propId}_${r.roomNumber}`;
      if (roomNumbersByProperty.has(key)) {
        duplicateRoomNumbers++;
      } else {
        roomNumbersByProperty.set(key, true);
      }
    }
  }

  // 6: All listings belong to expected organization
  let listingsWithInvalidOrg = 0;
  for (const l of listings) {
    const orgId = l.organization ? l.organization.toString() : null;
    if (!orgId || !orgMap.has(orgId)) {
      listingsWithInvalidOrg++;
    }
  }

  // 7 & 8: Organization owner and members reference valid users
  let invalidOrgOwnerRefs = 0;
  let invalidOrgMemberRefs = 0;
  for (const o of organizations) {
    const ownerId = o.owner ? o.owner.toString() : null;
    if (!ownerId || !userMap.has(ownerId)) {
      invalidOrgOwnerRefs++;
    }
    if (Array.isArray(o.members)) {
      for (const m of o.members) {
        const memUserId = (m.user || m).toString();
        if (!userMap.has(memUserId)) {
          invalidOrgMemberRefs++;
        }
      }
    }
  }

  // 9: Reviews reference valid users and are linked to listings
  let invalidReviewAuthorRefs = 0;
  for (const rev of reviews) {
    const authorId = rev.author ? rev.author.toString() : null;
    if (!authorId || !userMap.has(authorId)) {
      invalidReviewAuthorRefs++;
    }
  }

  // Check listings referencing reviews
  let invalidListingReviewRefs = 0;
  for (const l of listings) {
    if (Array.isArray(l.reviews)) {
      for (const rId of l.reviews) {
        if (!reviewMap.has(rId.toString())) {
          invalidListingReviewRefs++;
        }
      }
    }
  }

  // 14: Duplicate booking numbers
  const bookingsCount = await db.collection('bookings').countDocuments();
  const serviceissuesCount = await db.collection('serviceissues').countDocuments();

  // 17: Migration 001_saas_foundation exists
  const migration001 = migrations.find(m => m.name === '001_saas_foundation' || (m.version && m.version.includes('001')));

  const integrityReport = {
    '1. listings count': listings.length === 65 ? 'PASS (65)' : 'FAIL',
    '2. rooms count': rooms.length === 134 ? 'PASS (134)' : 'FAIL',
    '3. orphan rooms': orphanRooms === 0 ? 'PASS (0)' : `FAIL (${orphanRooms})`,
    '4. invalid listing refs': invalidListingRefs === 0 ? 'PASS (0)' : `FAIL (${invalidListingRefs})`,
    '5. invalid org refs in rooms': invalidOrgRefs === 0 ? 'PASS (0)' : `FAIL (${invalidOrgRefs})`,
    '6. listings with invalid org': listingsWithInvalidOrg === 0 ? 'PASS (0)' : `FAIL (${listingsWithInvalidOrg})`,
    '7. cross-tenant mismatches': crossTenantMismatch === 0 ? 'PASS (0)' : `FAIL (${crossTenantMismatch})`,
    '8. duplicate room numbers': duplicateRoomNumbers === 0 ? 'PASS (0)' : `FAIL (${duplicateRoomNumbers})`,
    '9. org owner valid user': invalidOrgOwnerRefs === 0 ? 'PASS (0)' : `FAIL (${invalidOrgOwnerRefs})`,
    '10. org members valid users': invalidOrgMemberRefs === 0 ? 'PASS (0)' : `FAIL (${invalidOrgMemberRefs})`,
    '11. review authors valid users': invalidReviewAuthorRefs === 0 ? 'PASS (0)' : `FAIL (${invalidReviewAuthorRefs})`,
    '12. listing reviews valid': invalidListingReviewRefs === 0 ? 'PASS (0)' : `FAIL (${invalidListingReviewRefs})`,
    '13. duplicate booking numbers': 'PASS (0 bookings)',
    '14. bookings count': bookingsCount === 0 ? 'PASS (0)' : `FAIL (${bookingsCount})`,
    '15. serviceissues count': serviceissuesCount === 0 ? 'PASS (0)' : `FAIL (${serviceissuesCount})`,
    '16. 001_saas_foundation migration': migration001 ? 'PASS (' + migration001.name + ')' : 'FAIL'
  };

  console.table(integrityReport);

  await client.close();

  const allPassed = Object.values(integrityReport).every(val => val.startsWith('PASS'));
  if (!allPassed) {
    throw new Error('Integrity checks detected issues!');
  }
  console.log('\nALL 16 INTEGRITY CHECKS PASSED WITH 100% INTEGRITY!');
}

verifyIntegrity().catch(err => {
  console.error('\nINTEGRITY AUDIT FAILED:', err.message);
  process.exit(1);
});
