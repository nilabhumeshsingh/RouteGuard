import { describe, it, expect } from "vitest";
import {
  PositionEstimateSchema,
  AlarmEventSchema,
  RouteRequestSchema,
  RouteResultSchema,
  ContextSignalSchema,
  GeofenceSchema
} from "../index.js";

describe("Shared Contracts & Zod Schemas", () => {
  it("validates valid PositionEstimate", () => {
    const validEstimate = {
      x: 120.5,
      y: 450.2,
      floorId: "floor-2",
      confidence: 0.92,
      uncertaintyRadius: 3.5,
      source: "wifi" as const,
      quality: "high" as const,
      nearestPlaceName: "Room 204",
      timestamp: Date.now()
    };
    const parsed = PositionEstimateSchema.parse(validEstimate);
    expect(parsed.confidence).toBe(0.92);
    expect(parsed.source).toBe("wifi");
  });

  it("rejects confidence out of [0, 1] bounds", () => {
    const invalid = {
      x: 10,
      y: 20,
      floorId: "floor-2",
      confidence: 1.5,
      uncertaintyRadius: 5,
      source: "wifi" as const,
      quality: "medium" as const,
      timestamp: Date.now()
    };
    expect(() => PositionEstimateSchema.parse(invalid)).toThrow();
  });

  it("validates AlarmEvent states and latching contracts", () => {
    const alarm = {
      id: "alm-001",
      deviceId: "esp32-fire-node-01",
      zoneId: "ZONE_FLOOR2_B",
      floorId: "floor-2",
      kind: "fire" as const,
      state: "ALARM_ACTIVE" as const,
      severity: "critical" as const,
      message: "Smoke detected in Academic Block Floor 2 Zone B",
      timestamp: Date.now()
    };
    const parsed = AlarmEventSchema.parse(alarm);
    expect(parsed.state).toBe("ALARM_ACTIVE");
    expect(parsed.severity).toBe("critical");
  });

  it("validates RouteRequest with mobility profiles", () => {
    const req = {
      origin: { nodeId: "node-204" },
      destination: { poiId: "poi-exit-north" },
      profile: "step-free" as const,
      avoidAlarms: true,
      timeOfDay: "night" as const
    };
    const parsed = RouteRequestSchema.parse(req);
    expect(parsed.profile).toBe("step-free");
    expect(parsed.timeOfDay).toBe("night");
  });

  it("validates RouteResult with trade-off explanations", () => {
    const res = {
      status: "found" as const,
      routeId: "rt-12345",
      profile: "recommended" as const,
      segments: [
        {
          fromNodeId: "node-204",
          toNodeId: "node-corridor-b",
          distanceMeters: 18.5,
          travelTimeSeconds: 15,
          instruction: "Turn right onto main corridor",
          isStepFree: true,
          edgeType: "corridor" as const,
          hazardLevel: "none" as const
        }
      ],
      pathPoints: [{ x: 100, y: 200, floorId: "floor-2" }],
      totalDistanceMeters: 18.5,
      estimatedTimeSeconds: 15,
      tradeOffExplanation: "Adds 1.5 min to stay on well-lit corridor near security",
      isEmergencyExit: false
    };
    const parsed = RouteResultSchema.parse(res);
    expect(parsed.totalDistanceMeters).toBe(18.5);
    expect(parsed.tradeOffExplanation).toContain("well-lit");
  });

  it("validates Geofence boundaries", () => {
    const geofence = {
      id: "geo-library",
      name: "Library Safe Zone",
      floorId: "floor-2",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      minDwellSeconds: 30
    };
    const parsed = GeofenceSchema.parse(geofence);
    expect(parsed.polygon).toHaveLength(4);
  });
});
