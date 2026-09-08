import { Router, Request, Response } from "express";
import { guardianService } from "../guardian/guardian.service.js";

const router = Router();

// POST /api/guardian/pair/code
// Child generates single-use 6-digit pairing code
router.post("/pair/code", (req: Request, res: Response) => {
  const { childId = `child-${Date.now().toString(36)}`, childName, emergencyContact } = req.body;

  const result = guardianService.generatePairingCode(childId, childName, emergencyContact);
  res.status(201).json({
    success: true,
    pairingCode: result.pairingCode,
    pairId: result.pairId,
    expiresAt: result.expiresAt,
    ttlSeconds: Math.round((result.expiresAt - Date.now()) / 1000)
  });
});

// POST /api/guardian/pair/claim
// Guardian claims 6-digit pairing code, establishing encrypted channel
router.post("/pair/claim", (req: Request, res: Response) => {
  const { guardianId, pairingCode } = req.body;

  if (!guardianId || !pairingCode) {
    res.status(400).json({
      error: "Both guardianId and pairingCode are required."
    });
    return;
  }

  const result = guardianService.claimPairingCode(guardianId, pairingCode);

  if (!result.success) {
    res.status(400).json({
      error: result.error
    });
    return;
  }

  res.json(result);
});

// GET /api/guardian/pairs/:pairId
router.get("/pairs/:pairId", (req: Request, res: Response) => {
  const pair = guardianService.getPair(req.params.pairId);
  if (!pair) {
    res.status(404).json({ error: "Guardian pair not found" });
    return;
  }
  res.json({ success: true, pair });
});

// GET /api/guardian/safe-zones
router.get("/safe-zones", (_req: Request, res: Response) => {
  res.json({
    success: true,
    safeZones: guardianService.getAllSafeZones()
  });
});

export default router;
