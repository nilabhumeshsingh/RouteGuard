import { z } from "zod";

export const MobilityProfileSchema = z.enum([
  "recommended",
  "shortest",
  "step-free",
  "emergency"
]);
export type MobilityProfile = z.infer<typeof MobilityProfileSchema>;

export const EdgeTypeSchema = z.enum([
  "corridor",
  "stairs",
  "lift",
  "ramp",
  "door"
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const RouteRequestSchema = z.object({
  origin: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    nodeId: z.string().optional(),
    floorId: z.string().default("floor-2")
  }),
  destination: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    nodeId: z.string().optional(),
    poiId: z.string().optional(),
    floorId: z.string().default("floor-2")
  }),
  profile: MobilityProfileSchema.default("recommended"),
  avoidAlarms: z.boolean().default(true),
  timeOfDay: z.enum(["day", "night"]).default("day")
});
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const RouteSegmentSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  distanceMeters: z.number().nonnegative(),
  travelTimeSeconds: z.number().nonnegative(),
  instruction: z.string(),
  isStepFree: z.boolean(),
  edgeType: EdgeTypeSchema,
  hazardLevel: z.enum(["none", "smoke_adjacent", "blocked"]).default("none")
});
export type RouteSegment = z.infer<typeof RouteSegmentSchema>;

export const RoutePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  floorId: z.string().default("floor-2")
});
export type RoutePoint = z.infer<typeof RoutePointSchema>;

export const RouteResultSchema = z.object({
  status: z.enum(["found", "unavailable"]),
  routeId: z.string(),
  profile: MobilityProfileSchema,
  segments: z.array(RouteSegmentSchema),
  pathPoints: z.array(RoutePointSchema),
  totalDistanceMeters: z.number().nonnegative(),
  estimatedTimeSeconds: z.number().nonnegative(),
  tradeOffExplanation: z.string().optional(),
  isEmergencyExit: z.boolean().default(false)
});
export type RouteResult = z.infer<typeof RouteResultSchema>;
