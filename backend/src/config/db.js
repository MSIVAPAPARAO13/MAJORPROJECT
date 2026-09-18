const mongoose = require("mongoose");

const connectDB = async () => {
  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

  try {
    const conn = await mongoose.connect(dbUrl);
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} on host ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect: ${error.message}`);
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
