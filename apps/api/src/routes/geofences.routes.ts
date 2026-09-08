import { Router, Request, Response } from "express";
import { guardianService } from "../guardian/guardian.service.js";

const router = Router();

// POST /api/geofences/check
// Evaluates child's current coordinates against approved safe zones
router.post("/check", (req: Request, res: Response) => {
  try {
    const {
      childId = "child-student-01",
      pairId,
      position,
      coordinates,
      x,
      y,
      floorId = "floor-2"
    } = req.body;

    const finalX = typeof position?.x === "number" ? position.x : typeof coordinates?.x === "number" ? coordinates.x : typeof x === "number" ? x : NaN;
    const finalY = typeof position?.y === "number" ? position.y : typeof coordinates?.y === "number" ? coordinates.y : typeof y === "number" ? y : NaN;
    const finalFloor = position?.floorId || coordinates?.floorId || floorId;

    if (isNaN(finalX) || isNaN(finalY)) {
      res.status(400).json({
        error: "Invalid position coordinates. 'x' and 'y' numbers are required."
      });
      return;
    }

    const evaluation = guardianService.evaluateGeofence(
      { x: finalX, y: finalY, floorId: finalFloor },
      childId,
      pairId
    );

    res.json(evaluation);
  } catch (err: any) {
    console.error("[GEOFENCE] Evaluation error:", err);
    res.status(500).json({
      error: "Geofence evaluation failed",
      message: err.message
    });
  }
});

// GET /api/geofences
router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    safeZones: guardianService.getAllSafeZones()
  });
});

export default router;
