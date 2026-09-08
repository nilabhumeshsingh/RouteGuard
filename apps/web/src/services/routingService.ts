import { CampusGraph, findPath, findStepFreeRoute, findEmergencyEvacuationRoute, generateTradeOffExplanation } from "@routeguard/graph";
import { RouteResult, RoutePoint } from "@routeguard/shared";
import floor2GraphData from "../../../../data/sample/floor2-graph.json";

// Initialize CampusGraph for Floor 2
export const campusGraph = new CampusGraph();

for (const node of floor2GraphData.nodes) {
  campusGraph.addNode({
    id: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    floorId: floor2GraphData.floorId,
    isExit: node.isExit,
    isRefuge: (node as any).isRefuge,
    isStepFree: node.isStepFree
  });
}

for (const edge of floor2GraphData.edges) {
  campusGraph.addEdge({
    from: edge.from,
    to: edge.to,
    distance: edge.distance,
    type: edge.type as any,
    isStepFree: edge.isStepFree,
    lighting: edge.lighting as any,
    crowd: edge.crowd as any
  });
}

export interface RouteComparison {
  recommended: RouteResult;
  stepFree: RouteResult;
  shortest: RouteResult;
  explanation: string;
}

export function calculateRouteTradeOffs(
  startNodeId: string,
  endNodeId: string,
  blockedNodes?: Set<string>
): RouteComparison {
  const recommended = findPath(campusGraph, startNodeId, endNodeId, {
    profile: "recommended",
    blockedNodes
  });

  const stepFree = findStepFreeRoute(campusGraph, startNodeId, endNodeId, {
    blockedNodes
  });

  const shortest = findPath(campusGraph, startNodeId, endNodeId, {
    profile: "shortest",
    blockedNodes
  });

  const explanation = generateTradeOffExplanation(recommended, shortest, stepFree);

  return {
    recommended,
    stepFree,
    shortest,
    explanation
  };
}

export function calculateEvacuationRoute(
  currentNodeId: string,
  blockedNodes?: Set<string>
): RouteResult {
  return findEmergencyEvacuationRoute(campusGraph, currentNodeId, {
    blockedNodes
  });
}

// Web Speech API Voice Guidance
export function speakInstruction(text: string): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// Tactile Vibration Feedback
export function triggerHapticFeedback(pattern: number | number[] = [100, 50, 100]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration permissions error
    }
  }
}
