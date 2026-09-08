import { Router, Request, Response } from "express";
import { broadcastScannerUpdate } from "../realtime/socket.js";

export interface StoredScan {
  deviceId: string;
  timestamp: number;
  aps: Array<{
    bssid: string;
    rssi: number;
    ssid?: string;
    freq?: number;
    channel?: number;
  }>;
  receivedAt: number;
}

// In-memory scan store (deviceId -> StoredScan)
export const scanStore = new Map<string, StoredScan>();

export const scanRouter = Router();

// POST /api/scan
// Body: { deviceId: string, timestamp: number, aps: [{bssid, rssi, ssid, freq, channel}] }
// Action: store latest scan by deviceId in Map (in-memory, no DB needed for demo)
// Response: { ok: true, count: number }
scanRouter.post("/", (req: Request, res: Response) => {
  const { deviceId, timestamp = Date.now(), aps = [] } = req.body;
  if (!deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ error: "deviceId string is required" });
  }

  const record: StoredScan = {
    deviceId,
    timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
    aps: Array.isArray(aps) ? aps : [],
    receivedAt: Date.now()
  };

  scanStore.set(deviceId, record);

  // Wire into Socket.IO: emit 'scanner.update' event to admin room on every POST /api/scan
  broadcastScannerUpdate({
    deviceId,
    timestamp: record.timestamp,
    receivedAt: record.receivedAt,
    apCount: record.aps.length,
    aps: record.aps
  });

  return res.json({ ok: true, count: record.aps.length });
});

// GET /api/scan/status (convenience endpoint)
scanRouter.get("/status", (_req: Request, res: Response) => {
  const statusList = Array.from(scanStore.values()).map((s) => ({
    deviceId: s.deviceId,
    lastSeen: s.receivedAt,
    apCount: s.aps.length
  }));
  return res.json(statusList);
});

// GET /api/scan/:deviceId
// Action: return latest stored scan for that device
// Response: { deviceId, timestamp, aps, receivedAt } | 404 { error: 'no scan' }
scanRouter.get("/:deviceId", (req: Request, res: Response) => {
  const deviceId = req.params.deviceId;
  const scan = scanStore.get(deviceId);
  if (!scan) {
    return res.status(404).json({ error: "no scan" });
  }
  return res.json(scan);
});

// GET /api/scanner/status
// Action: list all known deviceIds with last seen time and AP count
// Response: [{ deviceId, lastSeen, apCount }]
export const scannerRouter = Router();

scannerRouter.get("/status", (_req: Request, res: Response) => {
  const statusList = Array.from(scanStore.values()).map((s) => ({
    deviceId: s.deviceId,
    lastSeen: s.receivedAt,
    apCount: s.aps.length
  }));
  return res.json(statusList);
});

export default scanRouter;
