const mongoose = require("mongoose");

const connectDB = async () => {
  const dbUrl = process.env.ATLASDB_URL || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/wanderlust";

  try {
    const conn = await mongoose.connect(dbUrl);
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} on host ${conn.connection.host}`);
  } catch (error) {
    // Sanitize any credential string that might be echoed in error message
    const sanitizedMsg = (error.message || "").replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://***:***@");
    console.error(`[MongoDB Error] Failed to connect: ${sanitizedMsg}`);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error(`[MongoDB Connection Error]: ${err}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected from database");
  });
};

module.exports = connectDB;
