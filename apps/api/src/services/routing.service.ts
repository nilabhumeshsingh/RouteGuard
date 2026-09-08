import {
  RouteRequest,
  RouteResult,
  MobilityProfile
} from "@routeguard/shared";
import {
  CampusGraph,
  findPath,
  findStepFreeRoute,
  findEmergencyEvacuationRoute,
  CostContext
} from "@routeguard/graph";
import { getCampusGraph, loadFloor2Graph, loadPois } from "../data/loader.js";

// Hook to allow safety engine to provide active blocked nodes
export type BlockedNodesProvider = () => Set<string>;
let blockedNodesProvider: BlockedNodesProvider | null = null;

export function registerBlockedNodesProvider(provider: BlockedNodesProvider): void {
  blockedNodesProvider = provider;
}

export function findClosestNode(x: number, y: number, floorId = "floor-2"): string | null {
  const data = loadFloor2Graph();
  let bestNodeId: string | null = null;
  let minDistance = Infinity;

  for (const node of data.nodes) {
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist < minDistance) {
      minDistance = dist;
      bestNodeId = node.id;
    }
  }

  return bestNodeId;
}

export function resolveNodeId(point: {
  nodeId?: string;
  poiId?: string;
  x?: number;
  y?: number;
  floorId?: string;
}): string | null {
  if (point.nodeId) {
    return point.nodeId;
  }

  if (point.poiId) {
    const pois = loadPois();
    const poi = pois.find((p) => p.id === point.poiId);
    if (poi) {
      return poi.nodeId;
    }
  }

  if (point.x !== undefined && point.y !== undefined) {
    return findClosestNode(point.x, point.y, point.floorId);
  }

  return null;
}

export function calculateCampusRoute(req: RouteRequest): RouteResult {
  const graph: CampusGraph = getCampusGraph();
  const profile: MobilityProfile = req.profile || "recommended";
  const avoidAlarms = req.avoidAlarms ?? true;

  // Resolve start node
  const startNodeId = resolveNodeId(req.origin);
  if (!startNodeId || !graph.nodes.has(startNodeId)) {
    return {
      status: "unavailable",
      routeId: `rt-err-${Date.now()}`,
      profile,
      segments: [],
      pathPoints: [],
      totalDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      tradeOffExplanation: `Origin node not found or unresolved: ${JSON.stringify(req.origin)}`,
      isEmergencyExit: false
    };
  }

  // Setup blocked nodes from safety engine if avoidAlarms is active
  let blockedNodes: Set<string> | undefined;
  if (avoidAlarms && blockedNodesProvider) {
    blockedNodes = blockedNodesProvider();
  }

  const context: CostContext = {
    profile,
    timeOfDay: req.timeOfDay || "day",
    blockedNodes
  };

  // Emergency evacuation without specific destination
  if (profile === "emergency" && !req.destination.nodeId && !req.destination.poiId && req.destination.x === undefined) {
    return findEmergencyEvacuationRoute(graph, startNodeId, context);
  }

  // Resolve destination node
  const endNodeId = resolveNodeId(req.destination);
  if (!endNodeId || !graph.nodes.has(endNodeId)) {
    // If destination unavailable but profile is emergency, fallback to nearest exit
    if (profile === "emergency") {
      return findEmergencyEvacuationRoute(graph, startNodeId, context);
    }

    return {
      status: "unavailable",
      routeId: `rt-err-${Date.now()}`,
      profile,
      segments: [],
      pathPoints: [],
      totalDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      tradeOffExplanation: `Destination node not found: ${JSON.stringify(req.destination)}`,
      isEmergencyExit: false
    };
  }

  if (profile === "step-free") {
    return findStepFreeRoute(graph, startNodeId, endNodeId, context);
  }

  return findPath(graph, startNodeId, endNodeId, context);
}
