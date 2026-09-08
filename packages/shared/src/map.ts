import { z } from "zod";

export const MapSceneSchema = z.object({
  floorId: z.string(),
  floorNumber: z.number(),
  label: z.string(),
  blueprintWidth: z.number().positive(),
  blueprintHeight: z.number().positive(),
  scaleMetersPerPixel: z.number().positive(),
  svgPath: z.string().optional()
});
export type MapScene = z.infer<typeof MapSceneSchema>;

export const HazardOverlaySchema = z.object({
  zoneId: z.string(),
  floorId: z.string().default("floor-2"),
  severity: z.enum(["fire", "smoke", "blocked"]),
  polygon: z.array(z.object({ x: z.number(), y: z.number() })),
  pulsed: z.boolean().default(true),
  smokeIntensity: z.number().min(0).max(1).default(0.8)
});
export type HazardOverlay = z.infer<typeof HazardOverlaySchema>;

export const CameraStateSchema = z.object({
  zoom: z.number().positive(),
  targetX: z.number(),
  targetY: z.number(),
  rotation: z.number().default(0)
});
export type CameraState = z.infer<typeof CameraStateSchema>;

export interface CampusMapAdapter {
  id: string;
  name: string;
  render(container: HTMLElement, scene: MapScene): void;
  setCamera(camera: CameraState): void;
  highlightRoute(points: Array<{ x: number; y: number }>, color?: string): void;
  clearRoute(): void;
  setUserPosition(pos: { x: number; y: number; uncertaintyRadius: number }): void;
  setHazards(hazards: HazardOverlay[]): void;
  destroy(): void;
}
