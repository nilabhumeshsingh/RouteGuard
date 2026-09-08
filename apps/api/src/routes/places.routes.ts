import { Router, Request, Response } from "express";
import { searchPlaces } from "../services/places.service.js";

const router = Router();

// GET /api/places?q=
router.get("/", (req: Request, res: Response) => {
  const query = typeof req.query.q === "string" ? req.query.q : undefined;
  const places = searchPlaces(query);
  res.json({
    query: query || "",
    count: places.length,
    places
  });
});

export default router;
