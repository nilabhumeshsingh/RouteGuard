import { MongoClient } from "mongodb";
import { fingerprints as staticFingerprints } from "./position/fingerprints.js";

export interface ActiveFireAlarm {
  active: boolean;
  roomId: string;
  label: string;
  location: string;
  x: number;
  y: number;
  x3d: number;
  z3d: number;
  deviceId?: string;
  triggeredAt: number;
  source?: string;
}

let cachedClient: MongoClient | null = null;
async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (cachedClient) {
    try {
      return cachedClient.db("campussafe");
    } catch {
      cachedClient = null;
    }
  }
  try {
    cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await cachedClient.connect();
    return cachedClient.db("campussafe");
  } catch (err) {
    console.warn("[Vercel fire] MongoDB connection warning:", err);
    return null;
  }
}

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

function resolveRoomCoords(roomIdOrName: string): [number, number] {
  const clean = (roomIdOrName || "").toLowerCase().replace(/^(room\s*|node-)/i, "").trim();
  for (const [code, coords] of Object.entries(ROOM_COORDS_3D)) {
    if (clean.includes(code)) return coords;
  }
  return [0, 0];
}

function resolveRoomFromAps(scanAps: any[], fps: any[]): { roomId: string; label: string; x: number; y: number } {
  if (!scanAps || scanAps.length === 0 || !fps || fps.length === 0) {
    return { roomId: "208", label: "Room 208", x: 20.5, y: 0.0 };
  }

  function rssiDist(sAps: any[], fp: any) {
    let totalSq = 0;
    let overlap = 0;
    const fpMap = new Map<string, number>();

    if (Array.isArray(fp.aps)) {
      fp.aps.forEach((a: any) => {
        if (a.bssid) fpMap.set(a.bssid.toUpperCase(), a.rssi !== undefined ? a.rssi : Math.round((a.signal || 50) / 2 - 100));
      });
    } else if (fp.bssids && typeof fp.bssids === "object") {
      Object.entries(fp.bssids).forEach(([bssid, sig]: [string, any]) => {
        const val = typeof sig === "number" ? sig : parseFloat(sig) || 50;
        const rssi = val > 0 ? Math.round(val / 2 - 100) : val;
        fpMap.set(bssid.toUpperCase(), rssi);
      });
    }

    for (const ap of sAps) {
      const bssid = (ap.bssid || "").toUpperCase();
      if (fpMap.has(bssid)) {
        const diff = ap.rssi - (fpMap.get(bssid) || -70);
        totalSq += diff * diff;
        overlap++;
      }
    }
    if (overlap === 0) return Infinity;
    return Math.sqrt(totalSq / overlap) + (10 - Math.min(10, overlap)) * 3;
  }

  const matches = fps
    .map(fp => ({ fp, dist: rssiDist(scanAps, fp) }))
    .filter(m => m.dist < Infinity)
    .sort((a, b) => a.dist - b.dist);

  const topMatches = matches.slice(0, 5);
  const roomWeights = new Map<string, { weight: number; roomId: string; label: string }>();

  for (const m of topMatches) {
    const w = 1 / ((m.dist + 0.1) * (m.dist + 0.1));
    const rawLabel = m.fp.label || m.fp.location || "Room 208";
    const numMatch = rawLabel.match(/\b(20[1-9]|21[0-9]|220)\b/);
    const rId = numMatch ? numMatch[1] : (m.fp.roomId || "208");
    const existing = roomWeights.get(rId);
    if (existing) {
      existing.weight += w;
    } else {
      roomWeights.set(rId, { weight: w, roomId: rId, label: `Room ${rId}` });
    }
  }

  const winning = Array.from(roomWeights.values()).sort((a, b) => b.weight - a.weight)[0];
  const roomId = winning ? winning.roomId : "208";
  const label = winning ? winning.label : `Room ${roomId}`;
  const [x, y] = resolveRoomCoords(roomId);

  return { roomId, label, x, y };
}

// In-memory global store across serverless warm invocations
let currentAlarm: ActiveFireAlarm | null = (globalThis as any).__activeFireAlarm || null;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const db = await getDb();

  // POST /api/fire — trigger or clear alarm
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }

    const {
      clear = false,
      deviceId = "esp32-fire-node-01",
      roomId: customRoomId,
      location: customLocation,
      aps = []
    } = body || {};

    if (clear) {
      currentAlarm = null;
      (globalThis as any).__activeFireAlarm = null;
      if (db) {
        try {
          await db.collection("alarms").updateMany({ active: true }, { $set: { active: false, clearedAt: Date.now() } });
        } catch {}
      }
      return res.status(200).json({ success: true, active: false, message: "Fire alarm cleared" });
    }

    // Triggering alarm: resolve room
    let resolvedRoomId = customRoomId;
    let resolvedLabel = customLocation || (customRoomId ? `Room ${customRoomId}` : undefined);
    let rx = 0, ry = 0;

    if (!resolvedRoomId && Array.isArray(aps) && aps.length > 0) {
      let fps: any[] = [];
      if (db) {
        try {
          fps = await db.collection("fingerprints").find({}).toArray();
          if (fps.length === 0) fps = await db.collection("locations").find({}).toArray();
        } catch {}
      }
      if (fps.length === 0) fps = staticFingerprints as any[];

      const resolved = resolveRoomFromAps(aps, fps);
      resolvedRoomId = resolved.roomId;
      resolvedLabel = resolved.label;
      rx = resolved.x;
      ry = resolved.y;
    } else {
      resolvedRoomId = resolvedRoomId || "208";
      resolvedLabel = resolvedLabel || `Room ${resolvedRoomId}`;
      const [coordsX, coordsY] = resolveRoomCoords(resolvedRoomId);
      rx = coordsX;
      ry = coordsY;
    }

    const alarmRecord: ActiveFireAlarm = {
      active: true,
      roomId: resolvedRoomId,
      label: resolvedLabel,
      location: resolvedLabel,
      x: rx,
      y: ry,
      x3d: rx,
      z3d: ry,
      deviceId,
      triggeredAt: Date.now(),
      source: "esp32-boot-button"
    };

    currentAlarm = alarmRecord;
    (globalThis as any).__activeFireAlarm = currentAlarm;

    if (db) {
      try {
        await db.collection("alarms").insertOne({ ...alarmRecord });
      } catch (err) {
        console.warn("[Vercel fire] alarm insert notice:", err);
      }
    }

    return res.status(200).json({
      success: true,
      active: true,
      alarm: alarmRecord
    });
  }

  // GET /api/fire — query active alarm state
  if (req.method === "GET") {
    let activeAlarm = currentAlarm;
    if (!activeAlarm && db) {
      try {
        const latest = await db.collection("alarms").findOne(
          { active: true },
          { sort: { triggeredAt: -1 } }
        );
        if (latest) {
          activeAlarm = {
            active: true,
            roomId: latest.roomId,
            label: latest.label,
            location: latest.location || latest.label,
            x: latest.x,
            y: latest.y,
            x3d: latest.x3d || latest.x,
            z3d: latest.z3d || latest.y,
            deviceId: latest.deviceId,
            triggeredAt: latest.triggeredAt,
            source: latest.source
          };
        }
      } catch {}
    }

    if (activeAlarm && activeAlarm.active) {
      return res.status(200).json({ active: true, alarm: activeAlarm });
    }
    return res.status(200).json({ active: false, alarm: null });
  }

  // DELETE /api/fire — clear alarm
  if (req.method === "DELETE") {
    currentAlarm = null;
    (globalThis as any).__activeFireAlarm = null;
    if (db) {
      try {
        await db.collection("alarms").updateMany({ active: true }, { $set: { active: false, clearedAt: Date.now() } });
      } catch {}
    }
    return res.status(200).json({ success: true, active: false });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
