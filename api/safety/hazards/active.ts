import { MongoClient } from "mongodb";
import { SmokeSimulationEngine } from "../../../apps/api/src/safety/smoke-simulation.js";

interface ActiveHazardState {
  active: boolean;
  alarmId?: string;
  roomId?: string;
  label?: string;
  blockedNodeIds: string[];
  blockedEdgeIds: string[];
  hazardOverlays: unknown[];
  recommendedExit?: string;
  generatedAt: number;
}

interface VercelAlarm {
  id?: string;
  roomId?: string;
  zoneId?: string;
  message?: string;
  label?: string;
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
  } catch (error) {
    console.warn("[Vercel hazard] MongoDB connection warning:", error);
    return null;
  }
}

function inactiveHazard(): ActiveHazardState {
  return {
    active: false,
    blockedNodeIds: [],
    blockedEdgeIds: [],
    hazardOverlays: [],
    generatedAt: Date.now()
  };
}

function resolveRoomId(alarm: { roomId?: string; zoneId?: string; message?: string }): string {
  const source = `${alarm.roomId || ""} ${alarm.zoneId || ""} ${alarm.message || ""}`;
  return source.match(/\b(20[1-9]|21[0-9]|220)\b/)?.[1] || "208";
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = await getDb();
  let alarm: VercelAlarm | null = null;

  if (db) {
    try {
      alarm = await db.collection("alarms").findOne(
        { active: true },
        { sort: { triggeredAt: -1, receivedAt: -1 } }
      ) as VercelAlarm | null;
    } catch (error) {
      console.warn("[Vercel hazard] Failed to read active alarm:", error);
    }
  }

  if (!alarm) {
    return res.status(200).json(inactiveHazard());
  }

  const roomId = resolveRoomId(alarm);
  const forecast = new SmokeSimulationEngine("floor-2").getForecast(10, `node-${roomId}`);
  const recommendedExit = ["exit-west", "exit-east"].find(
    (exit) => !forecast.blockedNodeIds.includes(exit)
  );

  const hazard: ActiveHazardState = {
    active: true,
    alarmId: alarm.id,
    roomId,
    label: alarm.label || alarm.message || `Room ${roomId}`,
    blockedNodeIds: forecast.blockedNodeIds,
    blockedEdgeIds: forecast.blockedEdgeIds,
    hazardOverlays: forecast.hazardOverlays,
    recommendedExit,
    generatedAt: Date.now()
  };

  return res.status(200).json(hazard);
}