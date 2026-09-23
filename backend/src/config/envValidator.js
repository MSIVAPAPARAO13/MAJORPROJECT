// Environment Configuration Validator
// Ensures required production secrets are configured before startup
// Fails safely without printing sensitive values

function validateEnv() {
  if (process.env.NODE_ENV === "production") {
    const missing = [];

    // Database connection URL (Authoritative: ATLASDB_URL, compatible: MONGODB_URI)
    if (!process.env.ATLASDB_URL && !process.env.MONGODB_URI) {
      missing.push("ATLASDB_URL");
    }

    // Session secret (Authoritative: SECRET, compatible: SESSION_SECRET)
    if (!process.env.SECRET && !process.env.SESSION_SECRET) {
      missing.push("SECRET");
    }

    // Cloudinary configuration (Authoritative: CLOUD_NAME, CLOUD_API_KEY, CLOUD_API_SECRET)
    if (!process.env.CLOUD_NAME && !process.env.CLOUDINARY_CLOUD_NAME) {
      missing.push("CLOUD_NAME");
    }
    if (!process.env.CLOUD_API_KEY && !process.env.CLOUDINARY_API_KEY) {
      missing.push("CLOUD_API_KEY");
    }
    if (!process.env.CLOUD_API_SECRET && !process.env.CLOUDINARY_API_SECRET) {
      missing.push("CLOUD_API_SECRET");
    }

    // Mapbox public token (Authoritative: MAP_TOKEN, compatible: MAPBOX_TOKEN)
    if (!process.env.MAP_TOKEN && !process.env.MAPBOX_TOKEN) {
      missing.push("MAP_TOKEN");
    }

    if (missing.length > 0) {
      throw new Error(`[Production Startup Blocked] Missing mandatory security configuration: ${missing.join(", ")}`);
    }
  }
}

module.exports = { validateEnv };
