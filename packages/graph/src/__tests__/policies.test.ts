import { describe, it, expect, beforeAll } from "vitest";
import { CampusGraph, findStepFreeRoute, findEmergencyEvacuationRoute } from "../index.js";
import floor2Data from "../../../../data/sample/floor2-graph.json";

describe("Accessibility & Emergency Routing Policies", () => {
  let graph: CampusGraph;

  beforeAll(() => {
    graph = CampusGraph.fromJson(floor2Data);
  });

  it("ensures step-free route excludes stairs completely", () => {
    const route = findStepFreeRoute(graph, "c-lift", "exit-west");
    expect(route.status).toBe("found");
    for (const seg of route.segments) {
      expect(seg.isStepFree).toBe(true);
      expect(seg.edgeType).not.toBe("stairs");
    }
  });

  it("finds nearest emergency evacuation exit from Room 204", () => {
    const route = findEmergencyEvacuationRoute(graph, "node-204");
    expect(route.status).toBe("found");
    expect(route.isEmergencyExit).toBe(true);
    // Nearest to 204 should be exit-west
    const lastPoint = route.pathPoints[route.pathPoints.length - 1];
    expect(lastPoint.x).toBe(80); // exit-west x coordinate
  });

  it("dynamically reroutes to alternate exit when primary exit corridor is blocked by fire", () => {
    // Evacuate from 219 when exit-east is blocked by smoke/fire
    const blockedNodes = new Set(["exit-east", "c-220"]);
    const route = findEmergencyEvacuationRoute(graph, "node-219", {
      blockedNodes
    });

    expect(route.status).toBe("found");
    const lastPoint = route.pathPoints[route.pathPoints.length - 1];
    // Must reach exit-west because exit-east was blocked
    expect(lastPoint.x).toBe(80);
  });
});
