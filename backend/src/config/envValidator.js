// Environment Configuration Validator
// Ensures required production secrets are configured before startup
// Fails safely without printing sensitive values

function validateEnv() {
  if (process.env.NODE_ENV === "production") {
    const required = ["SECRET", "CLOUD_NAME", "CLOUD_API_KEY", "CLOUD_API_SECRET", "MAP_TOKEN"];
    const missing = [];

    for (const key of required) {
      if (!process.env[key] || process.env[key].trim() === "") {
        missing.push(key);
      }
    }

    // Check DB URL (either ATLASDB_URL or MONGO_URL)
    if (!process.env.ATLASDB_URL && !process.env.MONGO_URL) {
      missing.push("ATLASDB_URL or MONGO_URL");
    }

    if (missing.length > 0) {
      throw new Error(`[Production Startup Blocked] Missing mandatory security configuration: ${missing.join(", ")}`);
    }
  }
}

module.exports = { validateEnv };
