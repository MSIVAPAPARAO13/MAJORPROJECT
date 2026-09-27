const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../src/app');

async function testAppWithAtlas() {
  console.log('==================================================');
  console.log('PHASE 16.3 — APPLICATION VERIFICATION WITH ATLAS');
  console.log('==================================================\n');

  // Verify connection to Atlas
  const atlasUrl = process.env.ATLASDB_URL;
  console.log('[1/3] Connecting Mongoose to Atlas...');
  await mongoose.connect(atlasUrl, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected to: ${mongoose.connection.name} on host ${mongoose.connection.host}\n`);

  const app = createApp();

  const Listing = mongoose.models.Listing || mongoose.model('Listing');
  const Room = mongoose.models.Room || mongoose.model('Room');
  const Organization = mongoose.models.Organization || mongoose.model('Organization');
  const User = mongoose.models.User || mongoose.model('User');

  console.log('[2/3] Executing HTTP Endpoints Verification...');

  // 1. GET /api/health
  const healthRes = await request(app).get('/api/health');
  console.log(`GET /api/health -> Status: ${healthRes.status}, Body:`, healthRes.body);
  if (healthRes.status !== 200 || healthRes.body.status !== 'ok' || healthRes.body.database !== 'connected') {
    throw new Error('Health check failed!');
  }

  // 2. GET / (redirects or renders home)
  const homeRes = await request(app).get('/');
  console.log(`GET / -> Status: ${homeRes.status}`);
  if (homeRes.status !== 200 && homeRes.status !== 302) {
    throw new Error(`GET / failed with status ${homeRes.status}`);
  }

  // 3. GET /listings (renders listing cards from Atlas)
  const listingsRes = await request(app).get('/listings');
  console.log(`GET /listings -> Status: ${listingsRes.status}, Content Length: ${listingsRes.text.length}`);
  if (listingsRes.status !== 200) {
    throw new Error(`GET /listings failed with status ${listingsRes.status}`);
  }

  // 4. GET /login
  const loginRes = await request(app).get('/login');
  console.log(`GET /login -> Status: ${loginRes.status}`);
  if (loginRes.status !== 200) {
    throw new Error(`GET /login failed with status ${loginRes.status}`);
  }

  // 5. GET /signup
  const signupRes = await request(app).get('/signup');
  console.log(`GET /signup -> Status: ${signupRes.status}`);
  if (signupRes.status !== 200) {
    throw new Error(`GET /signup failed with status ${signupRes.status}`);
  }

  console.log('\n[3/3] Verifying Sample Data Retrieval via Models...');

  // Sample listing
  const sampleListing = await Listing.findOne({}).populate('rooms').populate('owner');
  if (!sampleListing) throw new Error('No listings found in Atlas via Mongoose!');
  console.log(`Sample Listing Loaded: "${sampleListing.title}" (ID: ${sampleListing._id})`);
  console.log(`- Price: ₹${sampleListing.price}`);
  console.log(`- Location: ${sampleListing.location}, ${sampleListing.country}`);
  console.log(`- Rooms attached: ${sampleListing.rooms ? sampleListing.rooms.length : 0}`);

  // Test GET /listings/:id
  const detailRes = await request(app).get(`/listings/${sampleListing._id}`);
  console.log(`GET /listings/${sampleListing._id} -> Status: ${detailRes.status}`);
  if (detailRes.status !== 200) {
    throw new Error(`GET /listings/${sampleListing._id} failed with status ${detailRes.status}`);
  }

  // Sample room
  const sampleRoom = await Room.findOne({ property: sampleListing._id });
  if (sampleRoom) {
    console.log(`Sample Room Loaded: Room ${sampleRoom.roomNumber} (${sampleRoom.roomType}) - Price: ₹${sampleRoom.price}`);
  }

  // Sample organization
  const sampleOrg = await Organization.findOne({});
  if (!sampleOrg) throw new Error('No organization found in Atlas via Mongoose!');
  console.log(`Organization Loaded: "${sampleOrg.name}"`);

  // Sample User authentication readiness
  const sampleUser = await User.findOne({ role: 'OWNER' });
  if (!sampleUser) throw new Error('No OWNER user found in Atlas via Mongoose!');
  console.log(`Auth System Ready: User "${sampleUser.username}" with role "${sampleUser.role}" loaded.`);

  await mongoose.disconnect();
  console.log('\nAPPLICATION VERIFICATION WITH ATLAS: ALL CHECKS PASSED (100% SUCCESS)!');
}

testAppWithAtlas().catch(err => {
  console.error('\nAPPLICATION VERIFICATION FAILED:', err.message);
  process.exit(1);
});
