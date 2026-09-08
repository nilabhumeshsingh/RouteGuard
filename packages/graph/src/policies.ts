import { RouteResult } from "@routeguard/shared";
import { CampusGraph, GraphNode } from "./graph.js";
import { findPath } from "./astar.js";
import { CostContext } from "./cost.js";

export function findStepFreeRoute(
  graph: CampusGraph,
  startNodeId: string,
  endNodeId: string,
  context: Omit<CostContext, "profile"> = {}
): RouteResult {
  return findPath(graph, startNodeId, endNodeId, {
    ...context,
    profile: "step-free"
  });
}

export function findEmergencyEvacuationRoute(
  graph: CampusGraph,
  currentNodeId: string,
  context: Omit<CostContext, "profile"> = {}
): RouteResult {
  // Find all available exit nodes
  const exitNodes: GraphNode[] = [];
  for (const [, node] of graph.nodes) {
    if (node.isExit && !context.blockedNodes?.has(node.id)) {
      exitNodes.push(node);
    }
  }

  if (exitNodes.length === 0) {
    return {
      status: "unavailable",
      routeId: `rt-emergency-${Date.now()}`,
      profile: "emergency",
      segments: [],
      pathPoints: [],
      totalDistanceMeters: 0,
      estimatedTimeSeconds: 0,
      isEmergencyExit: true
    };
  }

  let bestRoute: RouteResult | null = null;
  let shortestDistance = Infinity;

  for (const exit of exitNodes) {
    const route = findPath(graph, currentNodeId, exit.id, {
      ...context,
      profile: "emergency"
    });

    if (route.status === "found" && route.totalDistanceMeters < shortestDistance) {
      shortestDistance = route.totalDistanceMeters;
      bestRoute = route;
    }
  }

  if (bestRoute) {
    return {
      ...bestRoute,
      isEmergencyExit: true,
      tradeOffExplanation: "Emergency evacuation path to nearest clear fire exit."
    };
  }

  return {
    status: "unavailable",
    routeId: `rt-emergency-${Date.now()}`,
    profile: "emergency",
    segments: [],
    pathPoints: [],
    totalDistanceMeters: 0,
    estimatedTimeSeconds: 0,
    isEmergencyExit: true
  };
}
