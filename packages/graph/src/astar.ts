import { RouteResult, RouteSegment, RoutePoint } from "@routeguard/shared";
import { CampusGraph, GraphNode, GraphEdge } from "./graph.js";
import { computeEdgeCost, CostContext } from "./cost.js";

function euclideanDistance(a: GraphNode, b: GraphNode): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) * 0.1; // Scale factor roughly 10px per meter
}

export function findPath(
  graph: CampusGraph,
  startNodeId: string,
  endNodeId: string,
  context: CostContext
): RouteResult {
  const start = graph.getNode(startNodeId);
  const target = graph.getNode(endNodeId);

  if (!start || !target) {
    return {
      status: "unavailable",
      routeId: `rt-${Date.now()}`,
      profile: context.profile,
      segments: [],
      pathPoints: [],
      totalDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      isEmergencyExit: false
    };
  }

  // Priority queue tracking { nodeId, cost, priority }
  const openSet = new Map<string, number>();
  openSet.set(startNodeId, 0);

  const cameFrom = new Map<string, { prevNodeId: string; edge: GraphEdge }>();
  const gScore = new Map<string, number>();
  gScore.set(startNodeId, 0);

  const fScore = new Map<string, number>();
  fScore.set(startNodeId, euclideanDistance(start, target));

  while (openSet.size > 0) {
    // Extract node with lowest fScore
    let currentId = "";
    let lowestF = Infinity;
    for (const [nodeId] of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentId = nodeId;
      }
    }

    if (currentId === endNodeId) {
      // Reconstruct path
      const pathEdges: GraphEdge[] = [];
      let curr = endNodeId;
      while (cameFrom.has(curr)) {
        const step = cameFrom.get(curr)!;
        pathEdges.unshift(step.edge);
        curr = step.prevNodeId;
      }

      const segments: RouteSegment[] = [];
      const pathPoints: RoutePoint[] = [];

      pathPoints.push({ x: start.x, y: start.y, floorId: start.floorId });
      let totalDistance = 0;

      for (const e of pathEdges) {
        const toNode = graph.getNode(e.to);
        if (toNode) {
          pathPoints.push({ x: toNode.x, y: toNode.y, floorId: toNode.floorId });
        }
        totalDistance += e.distance;

        let instruction = `Continue along ${e.type}`;
        if (e.type === "door") {
          instruction = `Enter ${toNode?.label || e.to}`;
        } else if (e.type === "stairs") {
          instruction = "Take stairs to landing";
        } else if (e.type === "lift") {
          instruction = "Take accessible elevator";
        } else if (e.type === "ramp") {
          instruction = "Follow step-free access ramp";
        }

        segments.push({
          fromNodeId: e.from,
          toNodeId: e.to,
          distanceMeters: e.distance,
          travelTimeSeconds: Math.round(e.distance / 1.2), // ~1.2 m/s walking speed
          instruction,
          isStepFree: e.isStepFree,
          edgeType: e.type,
          hazardLevel: "none"
        });
      }

      const estTimeSec = Math.round(totalDistance / 1.2);

      return {
        status: "found",
        routeId: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        profile: context.profile,
        segments,
        pathPoints,
        totalDistanceMeters: Math.round(totalDistance * 10) / 10,
        estimatedTimeSeconds: estTimeSec,
        isEmergencyExit: target.isExit || false
      };
    }

    openSet.delete(currentId);
    const currentG = gScore.get(currentId) ?? Infinity;

    const outgoing = graph.getOutgoingEdges(currentId);
    for (const edge of outgoing) {
      const edgeCost = computeEdgeCost(edge, context);
      if (!isFinite(edgeCost)) continue;

      const neighbor = edge.to;
      const tentativeG = currentG + edgeCost;
      const neighborG = gScore.get(neighbor) ?? Infinity;

      if (tentativeG < neighborG) {
        cameFrom.set(neighbor, { prevNodeId: currentId, edge });
        gScore.set(neighbor, tentativeG);
        const neighborNode = graph.getNode(neighbor);
        const h = neighborNode ? euclideanDistance(neighborNode, target) : 0;
        fScore.set(neighbor, tentativeG + h);
        openSet.set(neighbor, tentativeG + h);
      }
    }
  }

  return {
    status: "unavailable",
    routeId: `rt-${Date.now()}`,
    profile: context.profile,
    segments: [],
    pathPoints: [],
    totalDistanceMeters: 0,
    estimatedTimeSeconds: 0,
    isEmergencyExit: false
  };
}
