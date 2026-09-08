import { z } from "zod";

export const LightingStatusSchema = z.enum([
  "well_lit",
  "moderate",
  "dim",
  "dark"
]);
export type LightingStatus = z.infer<typeof LightingStatusSchema>;

export const FootfallDensitySchema = z.enum([
  "high",
  "moderate",
  "low",
  "empty"
]);
export type FootfallDensity = z.infer<typeof FootfallDensitySchema>;

export const ContextSignalSchema = z.object({
  zoneId: z.string(),
  floorId: z.string().default("floor-2"),
  lighting: LightingStatusSchema,
  footfall: FootfallDensitySchema,
  closedSegments: z.array(z.string()).default([]),
  expiresAt: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative()
});
export type ContextSignal = z.infer<typeof ContextSignalSchema>;
