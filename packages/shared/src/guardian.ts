import { z } from "zod";
import { PositionEstimateSchema } from "./position.js";
import { HazardOverlaySchema } from "./map.js";

export const ChildProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  emergencyContact: z.string()
});
export type ChildProfile = z.infer<typeof ChildProfileSchema>;

export const GuardianLinkSchema = z.object({
  id: z.string(),
  guardianId: z.string(),
  childId: z.string(),
  pairingCode: z.string().optional(),
  status: z.enum(["pending", "paired", "revoked"]),
  expiresAt: z.number().int().nonnegative()
});
export type GuardianLink = z.infer<typeof GuardianLinkSchema>;

export const LocationEventSchema = z.object({
  childId: z.string(),
  position: PositionEstimateSchema,
  batteryLevel: z.number().min(0).max(100).optional(),
  isInsideSafeZone: z.boolean(),
  activeGeofenceId: z.string().optional(),
  timestamp: z.number().int().nonnegative()
});
export type LocationEvent = z.infer<typeof LocationEventSchema>;

export const GeofenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  floorId: z.string().default("floor-2"),
  polygon: z.array(z.object({ x: z.number(), y: z.number() })),
  minDwellSeconds: z.number().nonnegative().default(0)
});
export type Geofence = z.infer<typeof GeofenceSchema>;

export const ActiveHazardStateSchema = z.object({
  active: z.boolean(),
  alarmId: z.string().optional(),
  roomId: z.string().optional(),
  label: z.string().optional(),
  blockedNodeIds: z.array(z.string()).default([]),
  blockedEdgeIds: z.array(z.string()).default([]),
  hazardOverlays: z.array(HazardOverlaySchema).default([]),
  recommendedExit: z.string().optional(),
  generatedAt: z.number().int().nonnegative()
});
export type ActiveHazardState = z.infer<typeof ActiveHazardStateSchema>;
