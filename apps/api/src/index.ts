import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectMongo, disconnectMongo } from "./db.js";
import { initSocketGateway } from "./realtime/socket.js";

export * from "./safety/index.js";
export * from "./realtime/socket.js";
export * from "./guardian/guardian.service.js";
export { createApp } from "./app.js";

async function bootstrap() {
  // Connect to database
  await connectMongo();

  const app = createApp();
  const server = http.createServer(app);

  // Initialize real-time Socket.IO gateway
  initSocketGateway(server);

  server.listen(config.port, config.host, () => {
    console.log(`====================================================`);
    console.log(`🚀 RouteGuard API server running on http://${config.host}:${config.port}`);
    console.log(`   Campus:   ${config.campus.campusName} (${config.campus.building})`);
    console.log(`   Database: ${config.mongodbDbName}`);
    console.log(`   Realtime: Socket.IO Gateway active`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log("\n[SERVER] Gracefully shutting down...");
    server.close(async () => {
      await disconnectMongo();
      console.log("[SERVER] Closed all connections. Exiting process.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((err) => {
    console.error("[FATAL] Server bootstrap error:", err);
    process.exit(1);
  });
}
