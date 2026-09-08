export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const scanStore = (globalThis as any).__scanStore || new Map();
  const statusList = Array.from(scanStore.values()).map((s: any) => ({
    deviceId: s.deviceId,
    lastSeen: s.receivedAt,
    apCount: s.aps?.length || 0
  }));

  return res.status(200).json(statusList);
}
