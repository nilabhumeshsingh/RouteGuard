import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import campusRouter, { mapsRouter } from "./routes/campus.routes.js";
import placesRouter from "./routes/places.routes.js";
import positionRouter from "./routes/position.routes.js";
import routesRouter from "./routes/routes.routes.js";
import safetyRouter from "./routes/safety.routes.js";

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

  // Core API routes
  app.use("/api/campus", campusRouter);
  app.use("/api/maps", mapsRouter);
  app.use("/api/places", placesRouter);
  app.use("/api/position", positionRouter);
  app.use("/api/routes", routesRouter);
  app.use("/api/safety", safetyRouter);

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
