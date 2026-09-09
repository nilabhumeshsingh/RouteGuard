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

  function getFingerprint3D(fp: any): [number, number] {
    if (typeof fp.x3d === 'number' && typeof fp.z3d === 'number') {
      return [fp.x3d, fp.z3d];
    }
    const name = (fp.label || fp.location || '').toLowerCase();
    for (const [code, [rx, rz]] of Object.entries(ROOM_COORDS_3D)) {
      if (name.includes(code)) return [rx, rz];
    }
    if (typeof fp.x === 'number' && typeof fp.y === 'number') {
      if (Math.abs(fp.x) < 50 && Math.abs(fp.y) < 50) return [fp.x, fp.y];
      return [(fp.x - 480) / 15, (242.5 - fp.y) / 15];
    }
    return [0, 0];
  }

  const epsilon = 0.1;
  let totalWeight = 0;
  let xSum = 0;
  let ySum = 0;

  for (const m of matches) {
    const w = 1 / (m.dist + epsilon);
    const [fx, fy] = getFingerprint3D(m.fp);
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

  const rawLabel = best.label || best.location || "Indoor Location";
  let cleanLabel = rawLabel;
  if (/^room\s*219/i.test(rawLabel) || /^219/i.test(rawLabel)) {
    cleanLabel = "Room 219";
  } else if (/^room\s*(\d+)/i.test(rawLabel)) {
    cleanLabel = rawLabel.replace(/^room\s*/i, "Room ");
  } else if (/^\d{3}/.test(rawLabel)) {
    cleanLabel = "Room " + rawLabel;
  }

  return {
    x: Number((xSum / totalWeight).toFixed(2)),
    y: Number((ySum / totalWeight).toFixed(2)),
    x3d: Number((xSum / totalWeight).toFixed(2)),
    z3d: Number((ySum / totalWeight).toFixed(2)),
    confidence: Number(Math.min(1, Math.max(0.2, bestOverlap / 5)).toFixed(2)),
    source: "wifi",
    label: cleanLabel,
    type: best.type || "office",
    visible: best.visible ?? true,
    roomId: cleanLabel.replace(/^(ab1\s*|room\s*)/i, "").trim().toLowerCase(),
    anchorsUsed: bestOverlap,
    uncertaintyMeters: 3.0
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
        if (fps.length === 0) {
          fps = await db.collection("locations").find({}).toArray();
        }
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
