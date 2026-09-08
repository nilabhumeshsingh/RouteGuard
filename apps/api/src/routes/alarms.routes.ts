import { Router, Request, Response } from "express";
import { getDb } from "../db/mongo.js";

export const alarmsRouter = Router();

// GET /api/alarms — list latest alarms
alarmsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const alarms = await db
      .collection("alarms")
      .find({})
      .sort({ receivedAt: -1 })
      .limit(50)
      .toArray();
    return res.json(alarms);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch alarms", message: err.message });
  }
});

// POST /api/alarms — record an alarm event
alarmsRouter.post("/", async (req: Request, res: Response) => {
  const { deviceId, zoneId, kind = "fire", severity = "high" } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId is required" });
  }

  const alarmDoc = {
    deviceId,
    zoneId: zoneId || "ZONE_FLOOR2_B",
    kind,
    severity,
    receivedAt: Date.now()
  };

  try {
    const db = getDb();
    await db.collection("alarms").insertOne(alarmDoc);
  } catch (err: any) {
    console.warn("[alarms] Failed to insert alarm into Atlas:", err?.message || err);
  }

  const io = req.app.get("io");
  if (io) {
    io.to("alarms").emit("alarm.triggered", alarmDoc);
    io.to("admin").emit("alarm.triggered", alarmDoc);
  }

  return res.json({ ok: true, alarm: alarmDoc });
});

export default alarmsRouter;
