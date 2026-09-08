import { Router, Request, Response } from "express";
import { RouteRequestSchema } from "@routeguard/shared";
import { calculateCampusRoute } from "../services/routing.service.js";

const router = Router();

// POST /api/routes
router.post("/", (req: Request, res: Response) => {
  try {
    const parseResult = RouteRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid route request parameters",
        details: parseResult.error.format()
      });
      return;
    }

    const route = calculateCampusRoute(parseResult.data);
    res.json(route);
  } catch (err: any) {
    console.error("[ROUTING] Route calculation error:", err);
    res.status(500).json({
      error: "Route computation failed",
      details: err.message
    });
  }
});

export default router;
