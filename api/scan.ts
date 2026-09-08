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
  receivedAt: number;
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

    const record: StoredScan = {
      deviceId,
      timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
      aps: Array.isArray(aps) ? aps : [],
      receivedAt: Date.now()
    };
    scanStore.set(deviceId, record);

    return res.status(200).json({ ok: true, count: record.aps.length });
  }

  if (req.method === "GET") {
    const { deviceId } = req.query || {};
    if (deviceId && deviceId !== "status") {
      const scan = scanStore.get(String(deviceId));
      if (!scan) {
        return res.status(404).json({ error: "no scan" });
      }
      return res.status(200).json(scan);
    }

    const statusList = Array.from(scanStore.values()).map((s: StoredScan) => ({
      deviceId: s.deviceId,
      lastSeen: s.receivedAt,
      apCount: s.aps.length
    }));
    return res.status(200).json(statusList);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
