import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import campusRouter, { mapsRouter } from "./routes/campus.routes.js";
import placesRouter from "./routes/places.routes.js";
import positionRouter from "./routes/position.routes.js";
import routesRouter from "./routes/routes.routes.js";
import safetyRouter, { sharedAlarmStateMachine, sharedSmokeSimulation } from "./routes/safety.routes.js";
import devicesRouter from "./routes/devices.routes.js";
import adminRouter from "./routes/admin.routes.js";
import sosRouter from "./routes/sos.routes.js";
import guardianRouter from "./routes/guardian.routes.js";
import geofencesRouter from "./routes/geofences.routes.js";
import { registerBlockedNodesProvider } from "./services/routing.service.js";

// Wire safety smoke forecast into dynamic route obstruction provider
registerBlockedNodesProvider(() => {
  if (sharedAlarmStateMachine.getState() !== "NORMAL") {
    const forecast = sharedSmokeSimulation.getForecast(10);
    return new Set(forecast.blockedNodeIds);
  }
  return new Set<string>();
});

export function createApp(): Express {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());

  // Health check routes
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy", service: "routeguard-api", uptime: process.uptime() });
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy", service: "routeguard-api", uptime: process.uptime() });
  });

  // Core REST routes
  app.use("/api/campus", campusRouter);
  app.use("/api/maps", mapsRouter);
  app.use("/api/places", placesRouter);
  app.use("/api/position", positionRouter);
  app.use("/api/routes", routesRouter);

  // Safety & Emergency routes
  app.use("/api/safety", safetyRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/sos", sosRouter);

  // Guardian & Geofencing routes
  app.use("/api/guardian", guardianRouter);
  app.use("/api/geofences", geofencesRouter);

  // Fallback 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "Endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[SERVER] Unhandled server error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err?.message || "Unknown error"
    });
  });

  return app;
}
