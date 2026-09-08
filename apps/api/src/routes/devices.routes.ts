import { Router, Request, Response } from "express";
import { config } from "../config.js";
import {
  sharedAlarmStateMachine,
  sharedSmokeSimulation
} from "./safety.routes.js";
import {
  broadcastAlarmTriggered,
  broadcastRouteInvalidated
} from "../realtime/socket.js";

const router = Router();

// POST /api/devices/events
// Authenticated alarm event ingestion from ESP32 or demo button
router.post("/events", (req: Request, res: Response) => {
  const apiKeyHeader = (req.headers["x-api-key"] as string) || (req.headers["x-device-token"] as string);
  const authHeader = req.headers.authorization;
  const isDemo = req.body.isDemo === true || req.headers["x-demo-mode"] === "true";

  // Validate authentication
  const hasValidKey = apiKeyHeader === config.apiKey || (authHeader && authHeader.replace("Bearer ", "") === config.apiKey);

  if (!hasValidKey && !isDemo && process.env.NODE_ENV === "production") {
    res.status(401).json({
      error: "Unauthorized device event ingestion",
      message: "Valid device API key or authorization header is required."
    });
    return;
  }

  const {
    deviceId = "esp32-fire-node-01",
    zoneId = "ZONE_FLOOR2_B",
    kind = "alarm",
    floorId = "floor-2",
    sensorValue,
    isManualTrigger = false,
    message
  } = req.body;

  try {
    const alarmMsg =
      message ||
      `Hardware trigger from ${deviceId} in ${zoneId} (${isManualTrigger ? "Manual push button" : `MQ-2 sensor level: ${sensorValue ?? 1023}`})`;

    const alarmEvent = sharedAlarmStateMachine.triggerAlarm({
      deviceId,
      zoneId,
      floorId,
      kind: kind === "smoke" ? "smoke" : "fire",
      severity: "critical",
      message: alarmMsg
    });

    // Run smoke spread simulation from origin
    const simulation = sharedSmokeSimulation.runSimulation("node-208");

    // Broadcast WebSocket events across real-time gateway
    broadcastAlarmTriggered({
      eventId: alarmEvent.id,
      deviceId,
      zoneId,
      kind: alarmEvent.kind,
      severity: alarmEvent.severity,
      message: alarmMsg,
      timestamp: alarmEvent.timestamp,
      state: sharedAlarmStateMachine.getState(),
      forecast: simulation.horizons
    });

    broadcastRouteInvalidated(undefined, {
      reason: "alarm_triggered",
      blockedNodeIds: simulation.getForecast(10).blockedNodeIds,
      zoneId,
      timestamp: Date.now(),
      recommendedAction: "recalculate"
    });

    res.status(201).json({
      success: true,
      eventId: alarmEvent.id,
      state: sharedAlarmStateMachine.getState(),
      isLatched: sharedAlarmStateMachine.isLatched(),
      zoneId,
      alarm: alarmEvent,
      forecast: simulation.horizons
    });
  } catch (err: any) {
    console.error("[DEVICE] Error ingesting event:", err);
    res.status(500).json({
      error: "Device event processing failed",
      message: err.message
    });
  }
});

export default router;
