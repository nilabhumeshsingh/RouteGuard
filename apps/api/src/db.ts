import { MongoClient, Db } from "mongodb";
import { SurveyFingerprint } from "@routeguard/positioning";
import { config } from "./config.js";
import { loadSampleFingerprints } from "./data/loader.js";

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;

export async function connectMongo(): Promise<Db | null> {
  if (db && isConnected) {
    return db;
  }
  try {
    client = new MongoClient(config.mongodbUri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2500
    });
    await client.connect();
    db = client.db(config.mongodbDbName);
    await db.command({ ping: 1 });
    isConnected = true;
    console.log(`[DB] Connected to MongoDB database: ${config.mongodbDbName}`);
    return db;
  } catch (err: any) {
    console.warn(`[DB] MongoDB connection failed (${err.message}). Using local survey cache.`);
    isConnected = false;
    return null;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export async function getFingerprints(): Promise<SurveyFingerprint[]> {
  try {
    if (isConnected && db) {
      const docs = await db.collection("locations").find({}).toArray();
      if (docs.length > 0) {
        return docs.map((doc) => ({
          location: doc.location || "Unknown",
          x: Number(doc.x) || 0,
          y: Number(doc.y) || 0,
          floorId: doc.floorId || "floor-2",
          bssids: (doc.bssids as Record<string, number>) || {}
        }));
      }
    }
  } catch (err) {
    console.warn("[DB] Error reading locations from MongoDB, falling back to local sample:", err);
  }

  // Graceful fallback to static surveyed fingerprints
  const sample = loadSampleFingerprints();
  return sample.map((s) => ({
    location: s.location,
    x: s.x,
    y: s.y,
    floorId: s.floorId || "floor-2",
    bssids: s.bssids
  }));
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    isConnected = false;
  }
}
