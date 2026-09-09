import { MongoClient } from "mongodb";

let cachedClient: MongoClient | null = null;
const memoryAlerts: any[] = ((globalThis as any).__routeguardSosAlerts ||= []);

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (cachedClient) return cachedClient.db("campussafe");
  try {
    cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await cachedClient.connect();
    return cachedClient.db("campussafe");
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = await getDb();
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const coordinates = body.coordinates || { x: body.x ?? 300, y: body.y ?? 280, floorId: body.floorId || "floor-2" };
    const bssidReadings = Array.isArray(body.bssidReadings) ? body.bssidReadings : [];
    const alert = {
      id: `sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: body.userId || "web-user",
      userName: body.userName || "Web App User",
      coordinates,
      bssidReadings,
      strongestRssi: bssidReadings.length ? Math.max(...bssidReadings.map((reading: any) => reading.rssi ?? -70)) : undefined,
      message: body.message || "Emergency SOS signal triggered from web app",
      simulation: Boolean(body.simulation),
      status: "DISPATCHED",
      timestamp: Date.now()
    };
    if (db) await db.collection("sos_alerts").insertOne(alert);
    else memoryAlerts.unshift(alert);
    return res.status(201).json({ success: true, alert });
  }

  if (req.method === "GET") {
    const alerts = db
      ? await db.collection("sos_alerts").find({ status: "DISPATCHED" }).sort({ timestamp: -1 }).limit(20).toArray()
      : memoryAlerts.filter((alert) => alert.status === "DISPATCHED").slice(0, 20);
    return res.status(200).json({ alerts });
  }

  return res.status(405).json({ error: "Method not allowed" });
}