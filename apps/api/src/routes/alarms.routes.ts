import { Router, Request, Response } from "express";
import { getDb } from "../db/mongo.js";
import { runKNN } from "../services/positioning/knn.js";

export const alarmsRouter = Router();

// In-memory active alarm cache
let activeAlarmState: any = null;

const ROOM_COORDS_3D: Record<string, [number, number]> = {
  "201": [-11.75, 7.25],
  "202": [-7.25, 7.25],
  "203": [-2.75, 7.25],
  "204": [1.75, 7.25],
  "205": [9.75, 7.25],
  "206": [14.25, 7.25],
  "207": [18.75, 7.25],
  "208": [20.5, 0.0],
  "209": [8.5, 0.0],
  "210": [-3.5, 0.0],
  "211": [-11.5, 0.0],
  "212": [4.5, 0.0],
  "213": [16.5, 0.0],
  "214": [18.75, -7.25],
  "215": [14.25, -7.25],
  "216": [9.75, -7.25],
  "217": [1.75, -7.25],
  "218": [-2.75, -7.25],
  "219": [-7.25, -7.25],
  "220": [-11.75, -7.25],
  "balcony": [-24.0, 0.0]
};

// GET /api/alarms/active — poll current active fire alarm
alarmsRouter.get("/active", async (_req: Request, res: Response) => {
  if (activeAlarmState && activeAlarmState.active) {
    return res.json({ active: true, alarm: activeAlarmState });
  }

  try {
    const db = getDb();
    const latest = await db.collection("alarms").findOne(
      { active: true },
      { sort: { triggeredAt: -1, receivedAt: -1 } }
    );
    if (latest) {
      activeAlarmState = latest;
      return res.json({ active: true, alarm: latest });
    }
  } catch {}

  return res.json({ active: false, alarm: null });
});

// GET /api/alarms or /api/fire — list latest alarms OR return active alarm
alarmsRouter.get("/", async (req: Request, res: Response) => {
  if (req.baseUrl === "/api/fire" || req.query.active === "true") {
    if (activeAlarmState && activeAlarmState.active) {
      return res.json({ active: true, alarm: activeAlarmState });
    }
    try {
      const db = getDb();
      const latest = await db.collection("alarms").findOne(
        { active: true },
        { sort: { triggeredAt: -1, receivedAt: -1 } }
      );
      if (latest) {
        activeAlarmState = latest;
        return res.json({ active: true, alarm: latest });
      }
    } catch {}
    return res.json({ active: false, alarm: null });
  }

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

// POST /api/alarms/clear — clear active fire alarm
alarmsRouter.post("/clear", async (_req: Request, res: Response) => {
  activeAlarmState = null;
  try {
    const db = getDb();
    await db.collection("alarms").updateMany({ active: true }, { $set: { active: false, clearedAt: Date.now() } });
  } catch {}
  return res.json({ success: true, active: false });
});

// POST /api/alarms or /api/fire — record fire alarm event (from ESP32 or button)
alarmsRouter.post("/", async (req: Request, res: Response) => {
  const {
    deviceId = "esp32-fire-node-01",
    zoneId = "ZONE_FLOOR2_B",
    kind = "fire",
    severity = "critical",
    roomId: rawRoomId,
    location: rawLocation,
    clear = false,
    aps = []
  } = req.body;

  if (clear) {
    activeAlarmState = null;
    try {
      const db = getDb();
      await db.collection("alarms").updateMany({ active: true }, { $set: { active: false, clearedAt: Date.now() } });
    } catch {}
    return res.json({ success: true, active: false });
  }

  let resolvedRoomId = rawRoomId;
  let resolvedLabel = rawLocation || (rawRoomId ? `Room ${rawRoomId}` : undefined);
  let rx = 0, ry = 0;

  // If WiFi scan APs provided from ESP32, run k-NN to resolve room location
  if (!resolvedRoomId && Array.isArray(aps) && aps.length > 0) {
    try {
      const db = getDb();
      const fingerprints = await db.collection("fingerprints").find({}).toArray();
      const est = runKNN(aps, fingerprints as any);
      if (est && est.label) {
        resolvedLabel = est.label;
        const m = est.label.match(/\b(20[1-9]|21[0-9]|220)\b/);
        resolvedRoomId = m ? m[1] : "208";
        rx = est.x;
        ry = est.y;
      }
    } catch (e) {
      console.warn("[alarms] k-NN resolution fallback:", e);
    }
  }

  if (!resolvedRoomId) {
    resolvedRoomId = "208";
    resolvedLabel = "Room 208";
  }

  if (!rx && !ry) {
    const clean = resolvedRoomId.replace(/^(room\s*|node-)/i, "").trim();
    const coords = ROOM_COORDS_3D[clean] || [20.5, 0.0];
    rx = coords[0];
    ry = coords[1];
  }

  const alarmDoc = {
    active: true,
    deviceId,
    zoneId,
    roomId: resolvedRoomId,
    label: resolvedLabel,
    location: resolvedLabel,
    x: rx,
    y: ry,
    x3d: rx,
    z3d: ry,
    kind,
    severity,
    source: "esp32-boot-button",
    triggeredAt: Date.now(),
    receivedAt: Date.now()
  };

  activeAlarmState = alarmDoc;

  try {
    const db = getDb();
    await db.collection("alarms").insertOne({ ...alarmDoc });
  } catch (err: any) {
    console.warn("[alarms] Failed to insert alarm into Atlas:", err?.message || err);
  }

  const io = req.app.get("io");
  if (io) {
    io.to("alarms").emit("alarm.triggered", alarmDoc);
    io.to("admin").emit("alarm.triggered", alarmDoc);
  }

  return res.json({ ok: true, success: true, active: true, alarm: alarmDoc });
});

export default alarmsRouter;
