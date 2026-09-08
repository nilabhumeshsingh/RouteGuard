import { z } from "zod";

export const AlarmStateSchema = z.enum([
  "NORMAL",
  "ALARM_ACTIVE",
  "AUTHORIZED_CLEAR_PENDING"
]);
export type AlarmState = z.infer<typeof AlarmStateSchema>;

export const AlarmSeveritySchema = z.enum([
  "info",
  "warning",
  "critical"
]);
export type AlarmSeverity = z.infer<typeof AlarmSeveritySchema>;

export const AlarmEventSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  zoneId: z.string(),
  floorId: z.string().default("floor-2"),
  kind: z.enum(["fire", "smoke", "hazard", "drill", "clear"]),
  state: AlarmStateSchema,
  severity: AlarmSeveritySchema,
  message: z.string(),
  timestamp: z.number().int().nonnegative()
});
export type AlarmEvent = z.infer<typeof AlarmEventSchema>;
