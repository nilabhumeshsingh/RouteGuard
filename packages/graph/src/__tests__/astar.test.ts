import { describe, it, expect, beforeAll } from "vitest";
import { CampusGraph, findPath, generateTradeOffExplanation } from "../index.js";
import floor2Data from "../../../../data/sample/floor2-graph.json";

describe("Campus Graph & A* Pathfinding Engine", () => {
  let graph: CampusGraph;

  beforeAll(() => {
    graph = CampusGraph.fromJson(floor2Data);
  });

  it("finds path between Room 204 and Room 219", () => {
    const result = findPath(graph, "node-204", "node-219", {
      profile: "recommended"
    });

    expect(result.status).toBe("found");
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.totalDistanceMeters).toBeGreaterThan(30);
    expect(result.pathPoints[0]).toEqual({ x: 120, y: 220, floorId: "floor-2" });
  });

  it("calculates path in under 5 milliseconds", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      findPath(graph, "node-201", "exit-east", { profile: "shortest" });
    }
    const elapsed = (performance.now() - start) / 20;
    expect(elapsed).toBeLessThan(5);
  });

  it("returns unavailable when target is disconnected", () => {
    graph.addNode({
      id: "node-isolated",
      label: "Secret Vault",
      x: 999,
      y: 999,
      floorId: "floor-2"
    });

    const result = findPath(graph, "node-204", "node-isolated", {
      profile: "recommended"
    });

    expect(result.status).toBe("unavailable");
    expect(result.segments).toHaveLength(0);
  });

  it("avoids blocked edges even when both endpoint nodes remain available", () => {
    const result = findPath(graph, "node-204", "node-219", {
      profile: "recommended",
      blockedEdges: new Set(["c-204->c-203", "c-203->c-204"])
    });

    expect(result.status).toBe("found");
    expect(result.segments.some((segment) =>
      segment.fromNodeId === "c-204" && segment.toNodeId === "c-203" ||
      segment.fromNodeId === "c-203" && segment.toNodeId === "c-204"
    )).toBe(false);
  });

  it("generates route trade-off explanations correctly", () => {
    const recommended = findPath(graph, "node-204", "node-218", { profile: "recommended" });
    const shortest = findPath(graph, "node-204", "node-218", { profile: "shortest" });

    const explanation = generateTradeOffExplanation(recommended, shortest);
    expect(explanation).toBeDefined();
    expect(typeof explanation).toBe("string");
  });
});
