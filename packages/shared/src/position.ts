import { z } from "zod";

export const PositionSourceSchema = z.enum([
  "wifi",
  "gps",
  "qr",
  "manual",
  "replay"
]);
export type PositionSource = z.infer<typeof PositionSourceSchema>;

export const PositionQualitySchema = z.enum([
  "high",
  "medium",
  "low",
  "stale"
]);
export type PositionQuality = z.infer<typeof PositionQualitySchema>;

export const PositionEstimateSchema = z.object({
  x: z.number(),
  y: z.number(),
  floorId: z.string().default("floor-2"),
  confidence: z.number().min(0).max(1),
  uncertaintyRadius: z.number().nonnegative(),
  source: PositionSourceSchema,
  quality: PositionQualitySchema,
  nearestNodeId: z.string().optional(),
  nearestPlaceName: z.string().optional(),
  label: z.string().optional(),
  type: z.string().optional(),
  visible: z.boolean().optional(),
  anchorsUsed: z.number().optional(),
  uncertaintyMeters: z.number().optional(),
  timestamp: z.number().int().nonnegative()
});
export type PositionEstimate = z.infer<typeof PositionEstimateSchema>;

export const WifiScanItemSchema = z.object({
  bssid: z.string(),
  ssid: z.string().optional(),
  signal: z.union([z.number(), z.string()]),
  frequency: z.string().optional(),
  channel: z.union([z.number(), z.string()]).optional(),
  rate: z.string().optional(),
  inUse: z.boolean().optional()
});
export type WifiScanItem = z.infer<typeof WifiScanItemSchema>;

export const WifiScanPayloadSchema = z.object({
  items: z.array(WifiScanItemSchema),
  timestamp: z.number().int().nonnegative().optional(),
  scanDurationMs: z.number().nonnegative().optional(),
  clientType: z.string().optional()
});
export type WifiScanPayload = z.infer<typeof WifiScanPayloadSchema>;
