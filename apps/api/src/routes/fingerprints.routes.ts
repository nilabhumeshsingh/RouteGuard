import { Router, Request, Response } from "express";
import { getDb } from "../db/mongo.js";

export const fingerprintsRouter = Router();

// GET /api/fingerprints — admin/debug: list all known fingerprints
fingerprintsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const fps = await db.collection("fingerprints").find({}).toArray();
    return res.json({ count: fps.length, fingerprints: fps });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to read fingerprints", message: err.message });
  }
});

// POST /api/fingerprints — bulk upload fingerprints (survey data)
fingerprintsRouter.post("/", async (req: Request, res: Response) => {
  const { fingerprints } = req.body;
  if (!Array.isArray(fingerprints)) {
    return res.status(400).json({ error: "expected { fingerprints: [...] }" });
  }

  try {
    const db = getDb();
    await db.collection("fingerprints").deleteMany({}); // clear old
    const result = await db.collection("fingerprints").insertMany(fingerprints);
    return res.json({ ok: true, inserted: result.insertedCount });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save fingerprints", message: err.message });
  }
});

export default fingerprintsRouter;
