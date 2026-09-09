import { MobilityProfile } from "@routeguard/shared";
import { GraphEdge } from "./graph.js";

export interface CostContext {
  profile: MobilityProfile;
  timeOfDay?: "day" | "night";
  blockedEdges?: Set<string>;
  blockedNodes?: Set<string>;
  smokeZones?: Set<string>;
}

export function computeEdgeCost(edge: GraphEdge, context: CostContext): number {
  const edgeKey = `${edge.from}->${edge.to}`;
  const reverseKey = `${edge.to}->${edge.from}`;

  // 1. Hard exclusions
  if (edge.isBlocked) return Infinity;
  if (context.blockedEdges?.has(edgeKey) || context.blockedEdges?.has(reverseKey)) {
    return Infinity;
  }
  if (context.blockedNodes?.has(edge.to) || context.blockedNodes?.has(edge.from)) {
    return Infinity;
  }

  // 2. Step-free mode exclusions
  if (context.profile === "step-free" && (!edge.isStepFree || edge.type === "stairs")) {
    return Infinity;
  }

  // 3. Emergency fire mode exclusions (ordinary lifts strictly banned)
  if (context.profile === "emergency" && edge.type === "lift") {
    return Infinity;
  }

  const baseDistance = edge.distance;

  // For shortest mode, only geometric distance
  if (context.profile === "shortest") {
    return baseDistance;
  }

  let penalty = 0;

  // Lighting penalty (especially at night)
  const isNight = context.timeOfDay === "night";
  if (edge.lighting === "dark") {
    penalty += isNight ? 45 : 25;
  } else if (edge.lighting === "dim") {
    penalty += isNight ? 20 : 10;
  } else if (edge.lighting === "moderate") {
    penalty += 2;
  }

  // Crowd/Congestion penalty
  if (edge.crowd === "high") {
    penalty += 8;
  } else if (edge.crowd === "moderate") {
    penalty += 2;
  }

  // Smoke adjacent penalty (avoid passing near hazardous zones)
  if (context.smokeZones?.has(edge.to) || context.smokeZones?.has(edge.from)) {
    penalty += 100;
  }

  // Door transit penalty: discourage cutting through private rooms as corridor shortcuts
  if (edge.type === "door") {
    penalty += 12;
  }

  return baseDistance + penalty;
}
