import { Router, Request, Response } from "express";
import { sharedSOSDispatcher } from "./safety.routes.js";
import { calculateCampusRoute } from "../services/routing.service.js";
import { SOSValidationError } from "../safety/sos-service.js";
import { broadcastSOSTriggered } from "../realtime/socket.js";

const router = Router();

// POST /api/sos
// High-priority emergency trigger capturing current user location
router.post("/", (req: Request, res: Response) => {
  try {
    const {
      userId = `user-${Date.now().toString(36)}`,
      userName,
      coordinates,
      x,
      y,
      floorId = "floor-2",
      accuracyMeters,
      message = "Emergency SOS signal triggered",
      emergencyType = "general",
      batteryLevel,
      triggerCampusAlarm = false,
      bssidReadings = [],
      simulation = false
    } = req.body;

    const finalCoords = coordinates || {
      x: typeof x === "number" ? x : 300,
      y: typeof y === "number" ? y : 280,
      floorId,
      accuracyMeters
    };

    const alert = sharedSOSDispatcher.dispatchSOS({
      userId,
      userName,
      coordinates: finalCoords,
      emergencyType,
      message,
      batteryLevel,
      triggerCampusAlarm
    });

    const normalizedBssids = Array.isArray(bssidReadings)
      ? bssidReadings
          .filter((reading: any) => reading && typeof reading.bssid === "string")
          .map((reading: any) => ({
            bssid: reading.bssid.toUpperCase(),
            rssi: typeof reading.rssi === "number" ? reading.rssi : -70,
            ssid: reading.ssid
          }))
      : [];

    broadcastSOSTriggered({
      id: alert.id,
      userId: alert.userId,
      userName: alert.userName,
      coordinates: alert.coordinates,
      bssidReadings: normalizedBssids,
      strongestRssi: normalizedBssids.length
        ? Math.max(...normalizedBssids.map((reading: any) => reading.rssi))
        : undefined,
      timestamp: alert.dispatchedAt,
      message: simulation ? "Simulated SOS signal" : alert.message
    });

    // Compute immediate emergency evacuation route to the safest exit
    const evacuationRoute = calculateCampusRoute({
      origin: {
        x: finalCoords.x,
        y: finalCoords.y,
        floorId: finalCoords.floorId
      },
      destination: { floorId: finalCoords.floorId || "floor-2" }, // Emergency profile automatically routes to nearest exit
      profile: "emergency",
      avoidAlarms: true,
      timeOfDay: "day"
    });

    res.status(201).json({
      success: true,
      alert,
      evacuationRoute
    });
  } catch (err: any) {
    if (err instanceof SOSValidationError) {
      res.status(400).json({
        error: "Invalid SOS payload",
        message: err.message
      });
      return;
    }

    console.error("[SOS] Emergency dispatch error:", err);
    res.status(500).json({
      error: "SOS dispatch failed",
      message: err.message
    });
  }
});

export default router;
