import { MongoClient } from "mongodb";
import { fingerprints as rawFingerprints } from "./fingerprints.js";

interface WifiReading {
  bssid: string;
  signal?: number | string;
  rssi?: number | string;
}

interface SurveyFingerprint {
  location: string;
  label?: string;
  x: number;
  y: number;
  floorId: string;
  type?: string;
  visible?: boolean;
  bssids: Record<string, number>;
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
    console.warn("[Vercel estimate] MongoDB connection warning:", err);
    return null;
  }
}

function normalizeBssid(bssid: string): string {
  return (bssid || "").trim().toUpperCase().replace(/\\/g, "");
}

function parseSignalStrength(val: number | string | undefined): number {
  if (val === undefined || val === null) return 0.5;
  if (typeof val === "number") {
    if (val < 0) {
      return Math.min(1, Math.max(0, (val + 100) / 70));
    }
    if (val > 1) return Math.min(1, Math.max(0, val / 100));
    return Math.min(1, Math.max(0, val));
  }
  const clean = String(val).replace("%", "").trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0.5;
  if (num < 0) return Math.min(1, Math.max(0, (num + 100) / 70));
  return Math.min(1, Math.max(0, num / 100));
}

function cosineSimilarity(query: Map<string, number>, reference: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [, val] of query) {
    normA += val * val;
  }
  for (const [, val] of reference) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;

  for (const [bssid, qVal] of query) {
    const rVal = reference.get(bssid);
    if (rVal !== undefined) {
      dotProduct += qVal * rVal;
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeDistance(query: Map<string, number>, reference: Map<string, number>) {
  let sharedAps = 0;
  for (const [bssid] of query) {
    if (reference.has(bssid)) sharedAps++;
  }

  const similarity = cosineSimilarity(query, reference);
  const totalUnique = new Set([...query.keys(), ...reference.keys()]).size;
  const overlapRatio = totalUnique > 0 ? sharedAps / totalUnique : 0;
  const distance = (1 - similarity) + (1 - overlapRatio) * 0.5;

  return { similarity, distance, sharedAps };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    let items: WifiReading[] = [];
    const body = req.body || {};

    if (Array.isArray(body)) {
      items = body;
    } else if (Array.isArray(body.items)) {
      items = body.items;
    } else if (Array.isArray(body.scan)) {
      items = body.scan;
    } else if (Array.isArray(body.fingerprints)) {
      items = body.fingerprints;
    } else {
      res.status(400).json({
        error: "Invalid request payload. Expected { items: [{ bssid, signal }] } or { fingerprints: [...] }."
      });
      return;
    }

    if (items.length === 0) {
      res.status(400).json({ error: "Empty scan payload. At least 1 BSSID reading required." });
      return;
    }

    // Dynamic MongoDB loading
    let activeFingerprints: SurveyFingerprint[] = rawFingerprints as any[];
    const db = await getDb();
    if (db) {
      try {
        const dbFps = await db.collection("fingerprints").find({}).toArray();
        if (dbFps && dbFps.length > 0) {
          activeFingerprints = dbFps.map((d: any) => {
            const bssids: Record<string, number> = {};
            if (Array.isArray(d.aps)) {
              d.aps.forEach((a: any) => {
                if (a.bssid) bssids[a.bssid] = a.signalPercent ?? a.rssi ?? 50;
              });
            } else if (d.bssids) {
              Object.assign(bssids, d.bssids);
            }
            return {
              location: d.location || d.label,
              label: d.label,
              x: Number(d.x) || 0,
              y: Number(d.y) || 0,
              type: d.type,
              visible: d.visible,
              floorId: d.floorId || "floor-2",
              bssids
            };
          });
        }
      } catch (err) {
        console.warn("[estimate] MongoDB load notice:", err);
      }
    }

    const queryMap = new Map<string, number>();
    for (const item of items) {
      if (item && item.bssid) {
        const rawSig = item.signal !== undefined ? item.signal : item.rssi;
        queryMap.set(normalizeBssid(item.bssid), parseSignalStrength(rawSig));
      }
    }

    if (queryMap.size === 0) {
      res.status(200).json({
        x: 1.75,
        y: 7.25,
        floorId: "floor-2",
        confidence: 0,
        uncertaintyRadius: 50,
        nearestPlaceName: "Academic Block 1",
        source: "wifi-fallback",
        timestamp: Date.now()
      });
      return;
    }

    // Score against survey fingerprints
    const candidates: Array<{ fp: SurveyFingerprint; similarity: number; distance: number; sharedAps: number }> = [];

    for (const fp of activeFingerprints) {
      const refMap = new Map<string, number>();
      for (const [bssid, val] of Object.entries(fp.bssids)) {
        refMap.set(normalizeBssid(bssid), parseSignalStrength(val));
      }
      const score = computeDistance(queryMap, refMap);
      if (score.sharedAps > 0) {
        candidates.push({ fp, ...score });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const k = Math.min(3, Math.max(1, candidates.length));
    const topK = candidates.slice(0, k);

    let estX = 1.75;
    let estY = 7.25;
    let nearestName = "Academic Block 1 Corridor";
    let confidence = 0.5;
    let estType = "office";
    let estVisible = true;

    if (topK.length > 0) {
      nearestName = topK[0].fp.location;
      estType = topK[0].fp.type || "office";
      estVisible = topK[0].fp.visible ?? true;
      confidence = Math.max(0.2, Math.min(0.98, topK[0].similarity));

      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;

      for (const cand of topK) {
        const w = 1 / Math.max(cand.distance, 0.001);
        weightedX += cand.fp.x * w;
        weightedY += cand.fp.y * w;
        totalWeight += w;
      }

      if (totalWeight > 0) {
        estX = Math.round((weightedX / totalWeight) * 10) / 10;
        estY = Math.round((weightedY / totalWeight) * 10) / 10;
      }
    }

    const uncertaintyRadius = Math.max(1.8, Math.round((1 - confidence) * 10 * 10) / 10);

    res.status(200).json({
      x: estX,
      y: estY,
      floorId: "floor-2",
      confidence: Math.round(confidence * 100) / 100,
      uncertaintyRadius,
      nearestPlaceName: nearestName,
      type: estType,
      visible: estVisible,
      source: "wifi-knn",
      timestamp: Date.now()
    });
  } catch (err: any) {
    console.error("[POSITION] Estimation error:", err);
    res.status(500).json({
      error: "Position estimation failed",
      details: err.message
    });
  }
}
