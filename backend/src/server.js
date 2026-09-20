if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const connectDB = require("./config/db");
const createApp = require("./app");
const { validateEnv } = require("./config/envValidator");

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  // 0. Validate required production environment variables
  validateEnv();

  // 1. Establish database connection
  await connectDB();

  // 2. Initialize application
  const app = createApp();

  // 3. Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`[WanderLust Backend] Server actively running at http://localhost:${PORT}`);
    console.log(`[REST API] Ready at http://localhost:${PORT}/api/listings`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[WanderLust Backend] Gracefully terminating server...");
    server.close(() => {
      console.log("[WanderLust Backend] Closed remaining active connections.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer().catch((err) => {
  console.error("[Startup Fatal Error]:", err);
  process.exit(1);
});
