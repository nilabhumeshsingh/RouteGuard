import { Db } from "mongodb";
import { SurveyFingerprint } from "@routeguard/positioning";
import { connectMongo as connectAtlas, getDb, closeMongo } from "./db/mongo.js";
import { loadSampleFingerprints } from "./data/loader.js";

let isConnected = false;

export async function connectMongo(): Promise<Db | null> {
  try {
    const db = await connectAtlas();
    isConnected = true;
    return db;
  } catch (err: any) {
    console.warn(`[DB] Atlas connection failed (${err.message}). Using local survey cache.`);
    isConnected = false;
    return null;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export async function getFingerprints(): Promise<SurveyFingerprint[]> {
  try {
    if (isConnected) {
      const db = getDb();
      const docs = await db.collection("fingerprints").find({}).toArray();
      if (docs.length > 0) {
        return docs.map((doc: any) => {
          // If stored as { aps: [{bssid, rssi}] }
          if (Array.isArray(doc.aps)) {
            const bssids: Record<string, number> = {};
            doc.aps.forEach((ap: any) => {
              if (ap.bssid) bssids[ap.bssid] = ap.rssi;
            });
            return {
              location: doc.label || "Room",
              x: Number(doc.x) || 0,
              y: Number(doc.y) || 0,
              floorId: doc.floorId || "floor-2",
              type: doc.type,
              visible: doc.visible,
              bssids
            };
          }
          // If stored as { bssids: {...} }
          return {
            location: doc.location || doc.label || "Room",
            x: Number(doc.x) || 0,
            y: Number(doc.y) || 0,
            floorId: doc.floorId || "floor-2",
            type: doc.type,
            visible: doc.visible,
            bssids: (doc.bssids as Record<string, number>) || {}
          };
        });
      }
    }
  } catch (err) {
    console.warn("[DB] Error reading locations from MongoDB, falling back to local sample:", err);
  }

  // Graceful fallback to static surveyed fingerprints
  const sample = loadSampleFingerprints();
  return sample.map((s: any) => ({
    location: s.location || s.label || "Room",
    x: s.x,
    y: s.y,
    floorId: s.floorId || "floor-2",
    type: s.type,
    visible: s.visible,
    bssids: s.bssids || {}
  }));
}

export async function disconnectMongo(): Promise<void> {
  await closeMongo();
  isConnected = false;
}
