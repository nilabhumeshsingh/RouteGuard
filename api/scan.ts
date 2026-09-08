import { MongoClient } from "mongodb";
import { fingerprints as staticFingerprints } from "./position/fingerprints.js";

interface StoredScan {
  deviceId: string;
  timestamp: number;
  aps: Array<{
    bssid: string;
    rssi: number;
    ssid?: string;
    freq?: number;
    channel?: number;
  }>;
  position?: any;
  receivedAt: number;
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
    console.warn("[Vercel scan] MongoDB connection warning:", err);
    return null;
  }
}

function runKnnEstimate(scanAps: any[], fingerprints: any[]) {
  if (!scanAps || scanAps.length === 0 || !fingerprints || fingerprints.length === 0) return null;

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
      const fpRssi = fpMap.get(bssid);
      if (fpRssi !== undefined) {
        const diff = ap.rssi - fpRssi;
        totalSq += diff * diff;
        overlap++;
      }
    }

    if (overlap < 1) return Infinity;
    const penalty = Math.max(0, 5 - overlap) * 40;
    return Math.sqrt(totalSq / overlap) + penalty;
  }

  const matches = fingerprints
    .map(fp => ({ fp, dist: rssiDist(scanAps, fp) }))
    .filter(m => m.dist < Infinity)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  if (matches.length === 0) return null;

  const epsilon = 0.1;
  let totalWeight = 0;
  let xSum = 0;
  let ySum = 0;

  for (const m of matches) {
    const w = 1 / (m.dist + epsilon);
    const fx = m.fp.x3d !== undefined ? m.fp.x3d : m.fp.x;
    const fy = m.fp.z3d !== undefined ? m.fp.z3d : m.fp.y;
    xSum += fx * w;
    ySum += fy * w;
    totalWeight += w;
  }

  const best = matches[0].fp;
  const bestBssids = new Set<string>();
  if (Array.isArray(best.aps)) {
    best.aps.forEach((a: any) => bestBssids.add((a.bssid || "").toUpperCase()));
  } else if (best.bssids) {
    Object.keys(best.bssids).forEach(b => bestBssids.add(b.toUpperCase()));
  }

  const bestOverlap = scanAps.filter(ap => bestBssids.has((ap.bssid || "").toUpperCase())).length;

  return {
    x: Number((xSum / totalWeight).toFixed(2)),
    y: Number((ySum / totalWeight).toFixed(2)),
    confidence: Number(Math.min(1, Math.max(0.2, bestOverlap / 5)).toFixed(2)),
    source: "wifi",
    label: best.label || best.location || "Indoor Location",
    anchorsUsed: bestOverlap,
    uncertaintyMeters: 4.5
  };
}

const scanStore: Map<string, StoredScan> = (globalThis as any).__scanStore || new Map<string, StoredScan>();
(globalThis as any).__scanStore = scanStore;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const db = await getDb();

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }
    const { deviceId, timestamp = Date.now(), aps = [] } = body || {};
    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ error: "deviceId string is required" });
    }

    const normalizedAps = (Array.isArray(aps) ? aps : []).map((ap: any) => {
      let rssi = ap.rssi;
      if (rssi === undefined && ap.signal !== undefined) {
        const s = typeof ap.signal === "string" ? parseFloat(ap.signal) : ap.signal;
        rssi = s > 0 ? Math.round(s / 2 - 100) : s;
      }
      if (typeof rssi === "number" && rssi > 0) {
        rssi = Math.round(rssi / 2 - 100);
      }
      return {
        ...ap,
        bssid: (ap.bssid || "").toUpperCase(),
        rssi: typeof rssi === "number" ? rssi : -70
      };
    });

    let fps: any[] = [];
    if (db) {
      try {
        fps = await db.collection("fingerprints").find({}).toArray();
      } catch (e: any) {
        console.warn("[Vercel scan] Atlas read notice:", e?.message || e);
      }
    }
    if (fps.length === 0) {
      fps = staticFingerprints as any[];
    }

    const position = runKnnEstimate(normalizedAps, fps);

    const record: StoredScan = {
      deviceId,
      timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
      aps: normalizedAps,
      position,
      receivedAt: Date.now(),
      source: position?.source || "wifi"
    };

    scanStore.set(deviceId, record);

    if (db) {
      try {
        await db.collection("scans").insertOne({ ...record });
      } catch (err: any) {
        console.warn("[Vercel scan] insert notice:", err?.message || err);
      }
    }

    return res.status(200).json({ ok: true, count: record.aps.length, position });
  }

  if (req.method === "GET") {
    const { deviceId } = req.query || {};
    if (deviceId && deviceId !== "status") {
      let scan: any = null;
      if (db) {
        try {
          scan = await db.collection("scans").findOne({ deviceId: String(deviceId) }, { sort: { receivedAt: -1 } });
        } catch {}
      }
      if (!scan) {
        scan = scanStore.get(String(deviceId));
      }

      if (!scan) {
        return res.status(404).json({ error: "no scan" });
      }

      const ageMs = Date.now() - (scan.receivedAt || Date.now());
      return res.status(200).json({
        deviceId: scan.deviceId,
        timestamp: scan.timestamp,
        receivedAt: scan.receivedAt,
        ageMs,
        stale: ageMs > 15000,
        apCount: scan.aps?.length || 0,
        aps: scan.aps || [],
        position: scan.position,
        source: scan.source || "wifi"
      });
    }

    const statusList = Array.from(scanStore.values()).map((s: StoredScan) => ({
      deviceId: s.deviceId,
      lastSeen: s.receivedAt,
      apCount: s.aps.length,
      position: s.position
    }));
    return res.status(200).json(statusList);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
