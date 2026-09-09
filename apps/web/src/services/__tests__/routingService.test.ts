import { describe, it, expect } from "vitest";
import {
  campusGraph,
  calculateRouteTradeOffs,
  findSafestStairRoute,
  calculateEvacuationRoute,
  SAFE_STAIR_TARGETS,
  ARCHITECTURAL_NODE_COORDS,
  projectRouteToReferenceGuide
} from "../routingService.js";

describe("Corridor-Strict Pathfinding & Safest Stair Egress", () => {
  it("enforces pure corridor navigation without diagonal room cutting (Room 204 to Room 219)", () => {
    const comparison = calculateRouteTradeOffs("node-204", "node-219");
    expect(comparison.recommended.status).toBe("found");

    const points = comparison.recommended.pathPoints;
    expect(points.length).toBeGreaterThanOrEqual(4);

    // Start point: Room 204 (506.25, 133.75)
    expect(points[0].x).toBeCloseTo(506.25);
    expect(points[0].y).toBeCloseTo(133.75);

    // End point: Room 219 (371.25, 351.25)
    const endPoint = points[points.length - 1];
    expect(endPoint.x).toBeCloseTo(371.25);
    expect(endPoint.y).toBeCloseTo(351.25);

    // Verify all intermediate corridor waypoints lie strictly on the corridor grid:
    // North corridor y = 193.75, South corridor y = 291.25, or Vertical connectors x in {191.25, 566.25, 862.5}
    const CORRIDOR_Y_NORTH = 193.75;
    const CORRIDOR_Y_SOUTH = 291.25;
    const VALID_X_CONNECTORS = [191.25, 566.25, 862.5];

    for (let i = 1; i < points.length - 1; i++) {
      const pt = points[i];
      const isOnNorthCorridor = Math.abs(pt.y - CORRIDOR_Y_NORTH) < 0.01;
      const isOnSouthCorridor = Math.abs(pt.y - CORRIDOR_Y_SOUTH) < 0.01;
      const isOnVerticalConnector = VALID_X_CONNECTORS.some((x) => Math.abs(pt.x - x) < 0.01);

      expect(isOnNorthCorridor || isOnSouthCorridor || isOnVerticalConnector).toBe(true);
    }
  });

  it("selects Central Monitored Stairs (ST-NM) as the safest stairs from Room 204", () => {
    const stairRoute = findSafestStairRoute("node-204");
    expect(stairRoute.status).toBe("found");
    expect(stairRoute.isEmergencyExit).toBe(true);

    const destinationNode = stairRoute.segments[stairRoute.segments.length - 1].toNodeId;
    // Central North Stairs ST-NM (node-stairs-north) is closest safe monitored stair
    expect(destinationNode).toBe("node-stairs-north");
    expect(stairRoute.tradeOffExplanation).toContain("ST-NM");
  });

  it("selects Central South Stairs (ST-SM) or Exit West Ramp as safest egress from Room 219", () => {
    const stairRoute = findSafestStairRoute("node-219");
    expect(stairRoute.status).toBe("found");

    const destinationNode = stairRoute.segments[stairRoute.segments.length - 1].toNodeId;
    expect(["node-stairs-south", "exit-west"]).toContain(destinationNode);
  });

  it("strictly avoids low-footfall back stairs (ST-NW, ST-SE) when Night Safety is active", () => {
    // Evacuate from Room 201 at night - ST-NW is geographically closest, but deserted (<15% footfall).
    // Night safety MUST bypass ST-NW and route to Central Monitored ST-NM or Exit West Ramp!
    const nightRoute = findSafestStairRoute("node-201", { isNightSafety: true });
    expect(nightRoute.status).toBe("found");

    const destinationNode = nightRoute.segments[nightRoute.segments.length - 1].toNodeId;
    expect(destinationNode).not.toBe("stair-nw");
    expect(destinationNode).not.toBe("node-stairs-se");
  });

  it("guarantees step-free egress via West Ramp (ST-SW)", () => {
    const stepFreeRoute = findSafestStairRoute("node-204", { isStepFree: true });
    expect(stepFreeRoute.status).toBe("found");

    const destinationNode = stepFreeRoute.segments[stepFreeRoute.segments.length - 1].toNodeId;
    expect(destinationNode).toBe("exit-west");
    expect(stepFreeRoute.segments.every((s) => s.isStepFree)).toBe(true);
  });

  it("keeps visible navigation on the reference corridors with room connectors", () => {
    const route = calculateRouteTradeOffs("node-204", "node-219").recommended;
    const visiblePoints = projectRouteToReferenceGuide(route.pathPoints);

    expect(visiblePoints[0]).toEqual(route.pathPoints[0]);
    expect(visiblePoints[visiblePoints.length - 1]).toEqual(route.pathPoints[route.pathPoints.length - 1]);

    for (const point of visiblePoints.slice(1, -1)) {
      const onNorth = Math.abs(point.y - 193.75) < 0.5;
      const onSouth = Math.abs(point.y - 291.25) < 0.5;
      const onVertical = [191.25, 487.5, 667.5, 862.5].some((x) => Math.abs(point.x - x) < 0.5);
      expect(onNorth || onSouth || onVertical).toBe(true);
    }

    expect(visiblePoints.some((point) => Math.abs(point.x - 487.5) < 0.5)).toBe(true);
    expect(visiblePoints.some((point) => Math.abs(point.x - 566.25) < 0.5)).toBe(false);
    expect(visiblePoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 487.5, y: 193.75 }),
      expect.objectContaining({ x: 487.5, y: 291.25 })
    ]));
  });
});
