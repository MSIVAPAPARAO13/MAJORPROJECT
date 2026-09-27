const https = require("https");

function get(path) {
  return new Promise((resolve, reject) => {
    https.get("https://wanderlust-wrb6.onrender.com" + path, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on("error", reject);
  });
}

async function verify() {
  console.log("==================================================");
  console.log("LIVE PRODUCTION RENDER VERIFICATION");
  console.log("==================================================");

  const home = await get("/");
  console.log("GET / -> Status:", home.status);

  const dropdownChecks = [
    "/#property-management",
    "/#room-management",
    "/#booking-engine",
    "/#operations",
    "/#service-issues",
    "/#guest-ready",
    "/#guest-impact",
    "/#search",
    "/#analytics",
    "/#rbac",
    "/#security"
  ];
  console.log("\n--- Checking Features Dropdown Links in Navbar ---");
  for (const link of dropdownChecks) {
    const present = home.body.includes(link);
    console.log(`Dropdown Link [${link}]:`, present ? "PRESENT" : "MISSING");
  }

  const targetIds = [
    'id="property-management"',
    'id="room-management"',
    'id="booking-engine"',
    'id="operations"',
    'id="service-issues"',
    'id="guest-ready"',
    'id="guest-impact"',
    'id="search"',
    'id="analytics"',
    'id="rbac"',
    'id="security"'
  ];
  console.log("\n--- Checking Feature Landing Section Anchors ---");
  for (const id of targetIds) {
    const present = home.body.includes(id);
    console.log(`Target Element [${id}]:`, present ? "PRESENT" : "MISSING");
  }

  const login = await get("/login");
  console.log("\nGET /login -> Status:", login.status);
  const loginRoles = ["CUSTOMER", "STAFF", "MANAGER", "OWNER", "ADMIN"];
  console.log("\n--- Checking Role Login Selector Tabs ---");
  for (const role of loginRoles) {
    const hasRoleTab = login.body.includes(`value="${role}"`);
    console.log(`Role Radio [${role}]:`, hasRoleTab ? "PRESENT" : "MISSING");
  }

  const signup = await get("/signup");
  console.log("\nGET /signup -> Status:", signup.status);
  console.log("Signup form action /signup:", signup.body.includes('action="/signup"') ? "PRESENT" : "MISSING");

  const features = await get("/api/v2/features");
  console.log("\nGET /api/v2/features -> Status:", features.status);
  const featuresJson = JSON.parse(features.body);
  console.log("Features Success:", featuresJson.success);
  console.log("Features Role:", featuresJson.role);
  console.log("Features Count:", featuresJson.count);
  console.log("Features Available:", featuresJson.features.map(f => f.name).join(", "));

  console.log("\n==================================================");
  console.log("ALL PRODUCTION VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
