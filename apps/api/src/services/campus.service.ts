import { CorridorSegment } from "@routeguard/positioning";
import { config } from "../config.js";
import { loadFloor2Graph, loadPois } from "../data/loader.js";

export function getCampusConfig() {
  return config.campus;
}

export function getFloorMap(floorId: string) {
  const normalizedId = floorId.toLowerCase().trim();
  if (normalizedId !== "floor-2" && normalizedId !== "2") {
    return null;
  }

  const graphData = loadFloor2Graph();
  const pois = loadPois();

  // Extract corridor segments
  const corridors = graphData.edges.filter((e) => e.type === "corridor");

  return {
    floorId: graphData.floorId,
    name: graphData.name,
    dimensions: graphData.dimensions,
    scaleMetersPerPixel: 0.1,
    nodes: graphData.nodes,
    corridors,
    edges: graphData.edges,
    pois
  };
}

export function getCorridorSegments(): CorridorSegment[] {
  const graphData = loadFloor2Graph();
  const nodeMap = new Map<string, { x: number; y: number }>();
  for (const n of graphData.nodes) {
    nodeMap.set(n.id, { x: n.x, y: n.y });
  }

  const segments: CorridorSegment[] = [];
  for (const edge of graphData.edges) {
    if (edge.type === "corridor") {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (from && to) {
        segments.push({
          from: { x: from.x, y: from.y },
          to: { x: to.x, y: to.y }
        });
      }
    }
  }

  return segments;
}
