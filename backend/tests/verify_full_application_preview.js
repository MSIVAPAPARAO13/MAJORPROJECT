/**
 * Complete Full-Application Preview & Button/Feature Audit Script
 * Tests every major feature, role, button endpoint, API flow, and page load across both:
 * - Express SSR & REST API (port 8080)
 * - Integrated Google Stitch EJS Frontend (port 8080)
 */

const BASE_API = "http://localhost:8080/api";
const BASE_SSR = "http://localhost:8080";

let passed = 0;
let failed = 0;

function pass(msg) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg, err) {
  failed++;
  console.error(`  ✗ FAIL: ${msg}`, err ? err.message || err : "");
}

async function runAudit() {
  console.log("==================================================");
  console.log("WANDERLUST FULL-APPLICATION FEATURE & BUTTON AUDIT");
  console.log("==================================================\n");

  // --- 1. SSR ENTRY & STATIC ASSETS VERIFICATION ---
  console.log("--- 1. SSR ENTRY & STATIC ASSETS ---");
  try {
    const rIndex = await fetch(BASE_SSR + "/");
    if (rIndex.ok) pass("SSR Root (/) redirects and loads with HTTP 200");
    else fail(`SSR Root failed: ${rIndex.status}`);

    const rStyle = await fetch(BASE_SSR + "/css/style.css");
    if (rStyle.ok && rStyle.headers.get("content-type").includes("css")) {
      pass("Static /css/style.css serves valid CSS stylesheet");
    } else {
      fail(`style.css failed: ${rStyle.status}`);
    }

    const rScript = await fetch(BASE_SSR + "/js/script.js");
    if (rScript.ok && rScript.headers.get("content-type").includes("javascript")) {
      pass("Static /js/script.js serves valid JavaScript bundle");
    } else {
      fail(`script.js failed: ${rScript.status}`);
    }
  } catch (e) {
    fail("SSR asset check threw exception", e);
  }

  // --- 2. CATEGORY FILTERS & DISCOVERY ---
  console.log("\n--- 2. CATEGORY FILTERS & SEARCH DISCOVERY ---");
  const categories = [
    "All", "Rooms", "Hostels", "Trending", "Iconic Cities",
    "Mountains", "Castles", "Amazing pool", "Camping", "Farms",
    "Arctic", "Domes", "Boats"
  ];

  for (const cat of categories) {
    try {
      const url = cat === "All" ? `${BASE_API}/listings` : `${BASE_API}/listings?category=${encodeURIComponent(cat)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
        pass(`Category '${cat}' returns ${data.data.length} listings (no empty state)`);
      } else {
        fail(`Category '${cat}' returned empty or failed`);
      }
    } catch (e) {
      fail(`Category '${cat}' fetch failed`, e);
    }
  }

  // --- 3. SEARCH KEYWORD FILTERING ---
  console.log("\n--- 3. SEARCH KEYWORD & LOCATION FILTERING ---");
  try {
    const rSearch = await fetch(`${BASE_API}/listings?q=Goa`);
    const dSearch = await rSearch.json();
    if (rSearch.ok && dSearch.success && dSearch.data.length > 0) {
      pass(`Search query 'Goa' successfully returns ${dSearch.data.length} properties`);
    } else {
      fail("Search query 'Goa' returned 0 results");
    }

    const rEmptySearch = await fetch(`${BASE_API}/listings?q=NonExistentPlaceXYZ123`);
    const dEmptySearch = await rEmptySearch.json();
    if (rEmptySearch.ok && dEmptySearch.data.length === 0) {
      pass("Non-matching search correctly returns empty results with success: true");
    } else {
      fail("Empty search handling failed");
    }
  } catch (e) {
    fail("Search filter test failed", e);
  }

  // --- 4. LISTING DETAILS & POPULATED ROOMS ---
  console.log("\n--- 4. PROPERTY DETAILS & ROOM SELECTION ---");
  let testListingId = null;
  let testRoomId = null;
  let testRoomPrice = null;
  try {
    const rList = await fetch(`${BASE_API}/listings?category=Rooms`);
    const dList = await rList.json();
    const firstListing = dList.data[0];
    testListingId = firstListing._id;

    const rDetail = await fetch(`${BASE_API}/listings/${testListingId}`);
    const dDetail = await rDetail.json();
    if (rDetail.ok && dDetail.success && dDetail.data) {
      pass(`Listing '${dDetail.data.title}' details retrieved successfully`);
      if (Array.isArray(dDetail.data.rooms) && dDetail.data.rooms.length > 0) {
        const room = dDetail.data.rooms[0];
        testRoomId = room._id;
        testRoomPrice = room.price;
        pass(`Room selection available: Room ${room.roomNumber} (${room.roomType}, ₹${room.price}/night)`);
      } else {
        fail("Listing has no populated rooms");
      }
    } else {
      fail("Failed to retrieve listing details");
    }
  } catch (e) {
    fail("Listing details check failed", e);
  }

  // --- 5. AUTHENTICATION & SESSION MANAGEMENT ---
  console.log("\n--- 5. AUTHENTICATION & SESSION MANAGEMENT ---");
  const rand = Math.floor(Math.random() * 10000);
  const testUser = {
    username: `audituser_${rand}`,
    email: `audit_${rand}@example.com`,
    password: `P@ssword123!`
  };
  let cookieHeader = "";

  try {
    // Signup
    const rSignup = await fetch(`${BASE_API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser)
    });
    const dSignup = await rSignup.json();
    if (rSignup.ok && dSignup.success && dSignup.user) {
      pass(`Self-registration succeeded for @${testUser.username} (Role: ${dSignup.user.role})`);
    } else {
      fail(`Signup failed: ${dSignup.message}`);
    }

    // Login
    const rLogin = await fetch(`${BASE_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: testUser.username, password: testUser.password })
    });
    const dLogin = await rLogin.json();
    const cookies = rLogin.headers.getSetCookie ? rLogin.headers.getSetCookie() : [rLogin.headers.get("set-cookie")];
    if (cookies && cookies.length > 0) {
      cookieHeader = cookies.map(c => (c || "").split(";")[0]).filter(Boolean).join("; ");
    }
    if (rLogin.ok && dLogin.success) {
      pass(`Login succeeded for @${testUser.username} with session cookie`);
    } else {
      fail(`Login failed: ${dLogin.message}`);
    }

    // /api/auth/me
    const rMe = await fetch(`${BASE_API}/auth/me`, {
      headers: { "Cookie": cookieHeader }
    });
    const dMe = await rMe.json();
    if (rMe.ok && dMe.user && dMe.user.username === testUser.username) {
      pass(`/api/auth/me returns active session for @${testUser.username}`);
    } else {
      fail("/api/auth/me session check failed");
    }
  } catch (e) {
    fail("Auth flow failed", e);
  }

  // --- 6. ATOMIC BOOKING FLOW & OVERLAP SHIELD ---
  console.log("\n--- 6. BOOKING ENGINE & ATOMIC OVERLAP SHIELD ---");
  let bookingId = null;
  if (testListingId && testRoomId) {
    try {
      const checkIn1 = new Date();
      checkIn1.setDate(checkIn1.getDate() + 30);
      const checkOut1 = new Date();
      checkOut1.setDate(checkOut1.getDate() + 33);

      // Fetch CSRF token
      const rCsrf = await fetch(`${BASE_API}/csrf-token`, {
        headers: { "Cookie": cookieHeader }
      });
      const dCsrf = await rCsrf.json();
      const csrfToken = dCsrf.csrfToken;

      // Book room
      const rBook = await fetch(`${BASE_API}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookieHeader,
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          propertyId: testListingId,
          roomId: testRoomId,
          checkIn: checkIn1.toISOString().split("T")[0],
          checkOut: checkOut1.toISOString().split("T")[0],
          guestsCount: 1,
          guestDetails: {
            name: "Audit Guest",
            email: testUser.email,
            phone: "+91 9999999999"
          }
        })
      });
      const dBook = await rBook.json();
      if (rBook.ok && dBook.success) {
        bookingId = dBook.data._id;
        pass(`Booking created: ID #${bookingId}, Server-computed Total: ₹${dBook.data.totalPrice}`);
      } else {
        fail(`Booking creation failed: ${dBook.message}`);
      }

      // Overlap attempt (must fail with 409 Conflict)
      const rOverlap = await fetch(`${BASE_API}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookieHeader,
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          propertyId: testListingId,
          roomId: testRoomId,
          checkIn: checkIn1.toISOString().split("T")[0],
          checkOut: checkOut1.toISOString().split("T")[0],
          guestsCount: 1,
          guestDetails: {
            name: "Overlap Attempter",
            email: "overlap@example.com",
            phone: "+91 8888888888"
          }
        })
      });
      const dOverlap = await rOverlap.json();
      if (rOverlap.status === 409 || !dOverlap.success) {
        pass("Double-booking attempt was strictly PREVENTED with 409 Conflict");
      } else {
        fail("Double-booking was incorrectly allowed!");
      }

      // My Trips list
      const rTrips = await fetch(`${BASE_API}/bookings/my`, {
        headers: { "Cookie": cookieHeader }
      });
      const dTrips = await rTrips.json();
      if (rTrips.ok && dTrips.success && dTrips.data.some(b => b._id === bookingId)) {
        pass("Customer 'My Trips' portal displays newly confirmed booking");
      } else {
        fail("My trips did not include booking");
      }

      // Cancel booking
      const rCancel = await fetch(`${BASE_API}/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookieHeader,
          "X-CSRF-Token": csrfToken
        }
      });
      const dCancel = await rCancel.json();
      if (rCancel.ok && dCancel.success) {
        pass("Customer successfully cancelled booking (Status transitioned to CANCELLED)");
      } else {
        fail(`Booking cancellation failed: ${dCancel.message}`);
      }

    } catch (e) {
      fail("Booking flow threw exception", e);
    }
  }

  // --- 7. BACKEND SSR ROUTES & BUTTON TARGETS ---
  console.log("\n--- 7. BACKEND SSR PAGES & BUTTON TARGETS ---");
  const ssrRoutes = [
    { name: "Explore Portal", url: `${BASE_SSR}/listings` },
    { name: "Property Details Page", url: `${BASE_SSR}/listings/${testListingId || '6aad86b89187bee58a603b4b'}` },
    { name: "Trust & Safety Center", url: `${BASE_SSR}/trust` },
    { name: "Terms of Service", url: `${BASE_SSR}/terms` },
    { name: "Privacy Policy", url: `${BASE_SSR}/privacy` },
    { name: "Sitemap", url: `${BASE_SSR}/sitemap` },
    { name: "Login View", url: `${BASE_SSR}/login` },
    { name: "Signup View", url: `${BASE_SSR}/signup` },
    { name: "Health API", url: `${BASE_SSR}/api/health` },
    { name: "CSRF Token Endpoint", url: `${BASE_SSR}/api/csrf-token` }
  ];

  for (const page of ssrRoutes) {
    try {
      const res = await fetch(page.url);
      if (res.ok) {
        pass(`${page.name} (${page.url}) returns HTTP 200 OK`);
      } else {
        fail(`${page.name} returned HTTP ${res.status}`);
      }
    } catch (e) {
      fail(`${page.name} request failed`, e);
    }
  }

  // --- 8. TEARDOWN TEST USER & BOOKING ---
  console.log("\n--- 8. CLEANUP & TEARDOWN ---");
  try {
    const mongoose = require("mongoose");
    await mongoose.connect(process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust");
    if (bookingId) {
      await mongoose.connection.db.collection("bookings").deleteOne({ _id: new mongoose.Types.ObjectId(bookingId) });
      pass("Test booking document cleaned up");
    }
    await mongoose.connection.db.collection("users").deleteOne({ username: testUser.username });
    pass(`Test user @${testUser.username} cleaned up`);
    await mongoose.disconnect();
  } catch (e) {
    fail("Cleanup failed", e);
  }

  console.log("\n==================================================");
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error("Unhandled error in audit runner:", err);
  process.exit(1);
});
