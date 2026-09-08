import { Router, Request, Response } from "express";
import { getDb } from "../db/mongo.js";
import { runKNN, APReading } from "../services/positioning/knn.js";
import { broadcastScannerUpdate } from "../realtime/socket.js";

export interface StoredScan {
  deviceId: string;
  timestamp: number;
  aps: APReading[];
  position?: any;
  receivedAt: number;
  source?: string;
}

// In-memory fallback / cache
export const scanStore = new Map<string, StoredScan>();

export const scanRouter = Router();

// POST /api/scan — Python scanner / device posts BSSID/RSSI every 2s
scanRouter.post("/", async (req: Request, res: Response) => {
  const { deviceId, timestamp, aps } = req.body;
  if (!deviceId || !Array.isArray(aps)) {
    return res.status(400).json({ error: "missing deviceId or aps[]" });
  }

  let position = null;
  let db = null;
  try {
    db = getDb();
  } catch (err) {
    // DB not connected yet; fallback
  }

  if (db) {
    try {
      const fingerprints = await db.collection("fingerprints").find({}).toArray();
      position = runKNN(aps, fingerprints as any);
    } catch (err: any) {
      console.warn("[scan] k-NN calculation fallback notice:", err?.message || err);
    }
  }

  const scanDoc: StoredScan = {
    deviceId,
    timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
    aps,
    position,
    receivedAt: Date.now(),
    source: position?.source || "wifi"
  };

  // 1. Insert into MongoDB Atlas (TTL index auto-deletes after 1 hour)
  if (db) {
    try {
      await db.collection("scans").insertOne({ ...scanDoc });
    } catch (err: any) {
      console.warn("[scan] MongoDB insert error:", err?.message || err);
    }
  }

  // 2. Keep in-memory cache synchronized
  scanStore.set(deviceId, scanDoc);

  // 3. Emit to WebSocket listeners ('scanner-updates' and 'admin' rooms)
  const io = req.app.get("io");
  if (io) {
    io.to("scanner-updates").emit("scanner.update", {
      deviceId,
      position: scanDoc.position,
      apCount: aps.length,
      receivedAt: scanDoc.receivedAt
    });
    io.to("admin").emit("scanner.update", {
      deviceId,
      position: scanDoc.position,
      apCount: aps.length,
      receivedAt: scanDoc.receivedAt
    });
  }

  // Also broadcast via typed socket helper
  broadcastScannerUpdate({
    deviceId,
    timestamp: scanDoc.timestamp,
    receivedAt: scanDoc.receivedAt,
    apCount: aps.length,
    aps: scanDoc.aps
  });

  return res.json({ ok: true, count: aps.length, position });
});

// GET /api/scan/:deviceId — PWA polls this every 2s
// Returns the most recent scan for this device
scanRouter.get("/:deviceId", async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  let scan: any = null;

  try {
    const db = getDb();
    scan = await db
      .collection("scans")
      .findOne({ deviceId }, { sort: { receivedAt: -1 } });
  } catch {
    // DB not ready; fallback to memory
  }

  if (!scan) {
    scan = scanStore.get(deviceId);
  }

  if (!scan) {
    return res.status(404).json({
      error: "no scan yet",
      hint: `Start scanner: python3 scanner.py --url http://localhost:3000/api/scan --device ${deviceId}`
    });
  }

  const ageMs = Date.now() - scan.receivedAt;
  const isStale = ageMs > 10000;

  return res.json({
    deviceId: scan.deviceId,
    timestamp: scan.timestamp,
    receivedAt: scan.receivedAt,
    ageMs,
    stale: isStale,
    apCount: scan.aps?.length || 0,
    aps: scan.aps || [],
    position: scan.position,
    source: scan.source || "wifi"
  });
});

// DELETE /api/scan/:deviceId — clear a scanner
scanRouter.delete("/:deviceId", async (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  scanStore.delete(deviceId);

  let deletedCount = 0;
  try {
    const db = getDb();
    const result = await db.collection("scans").deleteMany({ deviceId });
    deletedCount = result.deletedCount;
  } catch (err: any) {
    console.warn("[scan] Delete scanner notice:", err?.message || err);
  }

  return res.json({ ok: true, deleted: deletedCount });
});

// GET /api/scanner/status — admin dashboard
export const scannerRouter = Router();

scannerRouter.get("/status", async (req: Request, res: Response) => {
  let scanners: any[] = [];
  try {
    const db = getDb();
    scanners = await db
      .collection("scans")
      .aggregate([
        { $sort: { receivedAt: -1 } },
        { $group: { _id: "$deviceId", latest: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$latest" } }
      ])
      .toArray();
  } catch {
    // DB offline fallback to memory
    scanners = Array.from(scanStore.values());
  }

  if (scanners.length === 0 && scanStore.size > 0) {
    scanners = Array.from(scanStore.values());
  }

  const formatted = scanners.map((s) => ({
    deviceId: s.deviceId,
    lastSeen: s.receivedAt,
    ageMs: Date.now() - s.receivedAt,
    apCount: s.aps?.length || 0,
    position: s.position,
    source: s.source || "wifi"
  }));

  // If client expects direct array, support ?format=array or default to standard admin payload
  if (req.query.format === "array") {
    return res.json(formatted);
  }

  return res.json({
    scanners: formatted,
    total: scanners.length,
    active: scanners.filter((s) => Date.now() - s.receivedAt < 10000).length
  });
});

export default scanRouter;
