import { Router, Request, Response } from "express";
import { WifiScanItem } from "@routeguard/shared";
import { estimateLocation } from "../services/positioning.service.js";

const router = Router();

// POST /api/position/estimate
router.post("/estimate", async (req: Request, res: Response) => {
  try {
    let items: WifiScanItem[] = [];

    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (Array.isArray(req.body?.items)) {
      items = req.body.items;
    } else if (Array.isArray(req.body?.scan)) {
      items = req.body.scan;
    } else if (Array.isArray(req.body?.fingerprints)) {
      items = req.body.fingerprints;
    } else {
      res.status(400).json({
        error: "Invalid request payload. Expected { items: [{ bssid, signal }] } or array of scan items."
      });
      return;
    }

    items = items.map((it: any) => ({
      ...it,
      signal: it.signal !== undefined ? it.signal : it.rssi
    }));

    if (items.length === 0) {
      res.status(400).json({
        error: "Empty scan payload. At least 1 BSSID reading required."
      });
      return;
    }

    const k = typeof req.body?.k === "number" ? req.body.k : 3;
    const snapToCorridor = req.body?.snapToCorridor !== false;
    const maxSnapDistance = typeof req.body?.maxSnapDistance === "number" ? req.body.maxSnapDistance : 40;

    const estimate = await estimateLocation(items, {
      k,
      snapToCorridor,
      maxSnapDistance
    });

    res.json(estimate);
  } catch (err: any) {
    console.error("[POSITION] Estimation error:", err);
    res.status(500).json({
      error: "Internal positioning error",
      details: err.message
    });
  }
});

// POST /api/position/manual — admin manual checkpoint
router.post("/manual", async (req: Request, res: Response) => {
  const { deviceId, x, y, label } = req.body;
  if (!deviceId || x === undefined || y === undefined) {
    return res.status(400).json({ error: "missing deviceId, x, or y" });
  }

  const manualDoc = {
    deviceId,
    timestamp: Date.now(),
    aps: [],
    position: {
      x,
      y,
      confidence: 1.0,
      source: "manual",
      label: label || "Manual checkpoint",
      anchorsUsed: 0
    },
    receivedAt: Date.now(),
    source: "manual"
  };

  try {
    const { getDb } = await import("../db/mongo.js");
    const db = getDb();
    // Store as a scan too, so /api/scan/:deviceId picks it up
    await db.collection("scans").insertOne({ ...manualDoc });
    await db.collection("manual_checkpoints").insertOne({ ...manualDoc });
  } catch (err: any) {
    console.warn("[position/manual] MongoDB write notice:", err?.message || err);
  }

  // Update in-memory fallback
  const { scanStore } = await import("./scan.routes.js");
  scanStore.set(deviceId, manualDoc as any);

  const io = req.app.get("io");
  if (io) {
    io.to("scanner-updates").emit("scanner.update", {
      deviceId,
      position: manualDoc.position,
      manual: true
    });
    io.to("admin").emit("scanner.update", {
      deviceId,
      position: manualDoc.position,
      manual: true
    });
  }

  return res.json({ ok: true, position: manualDoc.position });
});

export default router;
