import { Router, Request, Response } from "express";
import { getCampusConfig, getFloorMap } from "../services/campus.service.js";

const router = Router();

// GET /api/campus/config
router.get("/config", (_req: Request, res: Response) => {
  const config = getCampusConfig();
  res.json(config);
});

// GET /api/maps/:floorId
export const mapsRouter = Router();

mapsRouter.get("/:floorId", (req: Request, res: Response) => {
  const floorId = req.params.floorId;
  const floorMap = getFloorMap(floorId);

  if (!floorMap) {
    res.status(404).json({
      error: "Floor not found",
      requestedFloor: floorId,
      availableFloors: ["floor-2"]
    });
    return;
  }

  res.json(floorMap);
});

export default router;
