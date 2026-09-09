import { describe, it, expect } from "vitest";
import {
  campusGraph,
  calculateRouteTradeOffs,
  findSafestStairRoute,
  calculateEvacuationRoute,
  resolveNearestGraphNode,
  SAFE_STAIR_TARGETS,
  ARCHITECTURAL_NODE_COORDS
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
    // North corridor y = 193.75, South corridor y = 291.25, or Vertical/Transverse connectors x in {191.25, 371.25, 506.25, 566.25, 693.75, 862.5}
    const CORRIDOR_Y_NORTH = 193.75;
    const CORRIDOR_Y_SOUTH = 291.25;
    const VALID_X_CONNECTORS = [191.25, 371.25, 506.25, 566.25, 693.75, 862.5];

    for (let i = 1; i < points.length - 1; i++) {
      const pt = points[i];
      const isOnNorthCorridor = Math.abs(pt.y - CORRIDOR_Y_NORTH) < 0.01;
      const isOnSouthCorridor = Math.abs(pt.y - CORRIDOR_Y_SOUTH) < 0.01;
      const isOnVerticalConnector = VALID_X_CONNECTORS.some((x) => Math.abs(pt.x - x) < 0.01);

      expect(isOnNorthCorridor || isOnSouthCorridor || isOnVerticalConnector).toBe(true);
    }
  });

  it("takes the direct transverse crossway from Room 219 to Room 203 instead of looping through central concourse", () => {
    const route = calculateRouteTradeOffs("node-219", "node-203");
    expect(route.recommended.status).toBe("found");
    // Direct path via c-219 -> c-202 crossway is ~19m, avoiding 36m roundabout loop
    expect(route.recommended.totalDistanceMeters).toBeLessThan(25);
    const traversed = route.recommended.segments.map((s) => `${s.fromNodeId}->${s.toNodeId}`);
    expect(traversed).toContain("c-219->c-202");
    expect(traversed).not.toContain("c-sm->c-lift");
  });

  it("allows direct entry into Room 212 from South corridor without North concourse loop", () => {
    const route = calculateRouteTradeOffs("node-219", "node-212");
    expect(route.recommended.status).toBe("found");
    // Direct access via South corridor is 16.5m, not 27m concourse detour
    expect(route.recommended.totalDistanceMeters).toBeLessThan(20);
    const traversed = route.recommended.segments.map((s) => `${s.fromNodeId}->${s.toNodeId}`);
    expect(traversed).not.toContain("c-sm->c-lift");
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

  describe("Dynamic Node Resolution & Emergency Ground Floor Descent", () => {
    it("resolves node correctly from place name or coordinates", () => {
      // Direct room code
      expect(resolveNearestGraphNode({ x: 0, y: 0, nearestPlaceName: "Room 208" })).toBe("node-208");
      expect(resolveNearestGraphNode({ x: 0, y: 0, nearestPlaceName: "Faculty Office 219" })).toBe("node-219");

      // Washroom recognition
      expect(resolveNearestGraphNode({ x: 0, y: 0, nearestPlaceName: "Girls Washroom near 208" })).toBe("node-wash-girls-208");
      expect(resolveNearestGraphNode({ x: 0, y: 0, nearestPlaceName: "Boys Washroom East" })).toBe("node-wash-boys");

      // 2D coordinate Euclidean distance fallback
      expect(resolveNearestGraphNode({ x: 506.25, y: 133.75 })).toBe("node-204");
      expect(resolveNearestGraphNode({ x: 371.25, y: 351.25 })).toBe("node-219");

      // 3D coordinate conversion to 2D
      // For node-204: x_3d = (506.25 - 480)/15 = 1.75, y_3d = (242.5 - 133.75)/15 = 7.25
      expect(resolveNearestGraphNode({ x: 1.75, y: 7.25 })).toBe("node-204");
    });

    it("calculates emergency evacuation route leading to Ground Floor (Level 0) exit", () => {
      // When evacuating from Room 204
      const evacRoute = calculateEvacuationRoute("node-204");
      expect(evacRoute.status).toBe("found");
      expect(evacRoute.isEmergencyExit).toBe(true);

      // Verify ground floor exit points and segments
      const points = evacRoute.pathPoints;
      expect(points[points.length - 1].floorId).toBe("floor-g");

      // Check the final segment instructs egress through Ground Floor Fire Exit Door
      const lastSegment = evacRoute.segments[evacRoute.segments.length - 1];
      expect(lastSegment.instruction).toContain("Ground Floor Fire Exit Door");
      expect(lastSegment.toNodeId).toContain("ground-exit");

      // Check second-to-last segment instructs stairwell descent
      const descentSegment = evacRoute.segments[evacRoute.segments.length - 2];
      expect(descentSegment.instruction).toContain("descend stairwell to Ground Floor (Level 0)");
      expect(descentSegment.instruction).toContain("DO NOT USE LIFTS");
    });

    it("dynamically reroutes around active fire incident in Room 208 and its smoke zone", () => {
      // Fire in Room 208 blocks node-208, c-208, washrooms, and exit-east
      const fireBlocked = new Set([
        "node-208",
        "c-208",
        "node-wash-girls-208",
        "c-wash-ne",
        "c-ne",
        "exit-east"
      ]);

      // User is at Room 207 (next to 208)
      const evacRoute = calculateEvacuationRoute("node-207", fireBlocked);
      expect(evacRoute.status).toBe("found");

      // Must safely route westward to central stairs (ST-NM / node-stairs-north), avoiding blocked 208 corridor
      const traversedNodes = evacRoute.segments.map((s) => s.toNodeId);
      expect(traversedNodes).not.toContain("node-208");
      expect(traversedNodes).not.toContain("c-208");
      expect(traversedNodes).not.toContain("exit-east");

      // Ensures user exits to ground floor via safe stair
      expect(evacRoute.pathPoints[evacRoute.pathPoints.length - 1].floorId).toBe("floor-g");
    });
  });
});

