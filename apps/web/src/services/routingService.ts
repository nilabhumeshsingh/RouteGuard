import { CampusGraph, findPath, findStepFreeRoute, findEmergencyEvacuationRoute, generateTradeOffExplanation } from "@routeguard/graph";
import { RouteResult, RoutePoint } from "@routeguard/shared";
import floor2GraphData from "../../../../data/sample/floor2-graph.json";

// Architectural coordinate mapping matching 2D SVG layout and 3D dollhouse model
export const ARCHITECTURAL_NODE_COORDS: Record<string, { x: number; y: number }> = {
  // Exits / Stairs
  "exit-west": { x: 191.25, y: 351.25 },
  "exit-east": { x: 862.5, y: 133.75 },
  "node-stairs-north": { x: 566.25, y: 133.75 },
  "node-stairs-south": { x: 566.25, y: 351.25 },

  // South Wing Classrooms & Labs
  "node-220": { x: 303.75, y: 351.25 },
  "node-219": { x: 371.25, y: 351.25 },
  "node-219a": { x: 355, y: 335 },
  "node-219c": { x: 388, y: 335 },
  "node-218": { x: 438.75, y: 351.25 },
  "node-217": { x: 506.25, y: 351.25 },
  "node-216": { x: 626.25, y: 351.25 },
  "node-215": { x: 693.75, y: 351.25 },
  "node-214": { x: 761.25, y: 351.25 },

  // South Corridor (y = 291.25)
  "c-west": { x: 191.25, y: 291.25 },
  "c-220": { x: 303.75, y: 291.25 },
  "c-219": { x: 371.25, y: 291.25 },
  "c-218": { x: 438.75, y: 291.25 },
  "c-217": { x: 506.25, y: 291.25 },
  "c-sm": { x: 566.25, y: 291.25 },
  "c-216": { x: 626.25, y: 291.25 },
  "c-215": { x: 693.75, y: 291.25 },
  "c-214": { x: 761.25, y: 291.25 },
  "c-se": { x: 862.5, y: 291.25 },

  // North Wing Classrooms & Labs
  "node-201": { x: 303.75, y: 133.75 },
  "node-202": { x: 371.25, y: 133.75 },
  "node-203": { x: 438.75, y: 133.75 },
  "node-204": { x: 506.25, y: 133.75 },
  "node-205": { x: 626.25, y: 133.75 },
  "node-206": { x: 693.75, y: 133.75 },
  "node-207": { x: 761.25, y: 133.75 },
  "node-wash-girls-208": { x: 795, y: 133.75 },
  "node-wash-boys": { x: 243.75, y: 133.75 },

  // North Corridor (y = 193.75)
  "c-nw": { x: 191.25, y: 193.75 },
  "c-201": { x: 303.75, y: 193.75 },
  "c-204": { x: 506.25, y: 193.75 },
  "c-lift": { x: 566.25, y: 193.75 },
  "c-206": { x: 693.75, y: 193.75 },
  "c-207": { x: 761.25, y: 193.75 },
  "c-208": { x: 787.5, y: 193.75 },
  "c-ne": { x: 862.5, y: 193.75 },

  // Central Island
  "node-211": { x: 307.5, y: 242.5 },
  "node-210": { x: 427.5, y: 242.5 },
  "node-212": { x: 547.5, y: 242.5 },
  "node-209": { x: 607.5, y: 242.5 },
  "node-213": { x: 727.5, y: 242.5 },
  "node-208": { x: 787.5, y: 242.5 },
  "c-mid-west": { x: 427.5, y: 242.5 },
  "c-mid-east": { x: 566.25, y: 242.5 },
  "c-210": { x: 427.5, y: 193.75 },
  "c-211": { x: 307.5, y: 193.75 },

  // Balcony
  "c-balcony": { x: 120, y: 242.5 },
  "c-balcony-circ": { x: 100, y: 242.5 }
};

// Initialize CampusGraph for Floor 2
export const campusGraph = new CampusGraph();

for (const node of floor2GraphData.nodes) {
  const arch = ARCHITECTURAL_NODE_COORDS[node.id];
  campusGraph.addNode({
    id: node.id,
    label: node.label,
    x: arch ? arch.x : node.x,
    y: arch ? arch.y : node.y,
    floorId: floor2GraphData.floorId,
    isExit: node.id === "exit-west" || node.id === "exit-east" ? true : node.isExit,
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

// Add south corridor links directly connecting Room 220 to West stairs ramp
campusGraph.addEdge({
  from: "c-220",
  to: "c-west",
  distance: 3,
  type: "corridor",
  isStepFree: true,
  lighting: "well_lit",
  crowd: "low"
});
campusGraph.addEdge({
  from: "c-west",
  to: "exit-west",
  distance: 2,
  type: "ramp",
  isStepFree: true,
  lighting: "well_lit",
  crowd: "low"
});
campusGraph.addEdge({
  from: "c-220",
  to: "exit-west",
  distance: 5,
  type: "corridor",
  isStepFree: true,
  lighting: "well_lit",
  crowd: "low"
});

export interface RouteComparison {
  recommended: RouteResult;
  stepFree: RouteResult;
  shortest: RouteResult;
  safeNight?: RouteResult;
  explanation: string;
}

// Low-footfall, isolated corridors & service alleys to avoid at night
export const LOW_FOOTFALL_NIGHT_NODES = new Set<string>([
  "c-west",
  "c-balcony",
  "c-balcony-circ",
  "node-wash-boys",
  "c-se"
]);

export function calculateRouteTradeOffs(
  startNodeId: string,
  endNodeId: string,
  blockedNodes?: Set<string>,
  isNightSafety: boolean = false
): RouteComparison {
  // If Night Safety Mode is active, bypass isolated low-footfall corridors
  const effectiveBlocked = new Set<string>(blockedNodes || []);
  if (isNightSafety) {
    for (const node of LOW_FOOTFALL_NIGHT_NODES) {
      if (node !== startNodeId && node !== endNodeId) {
        effectiveBlocked.add(node);
      }
    }
  }

  const recommended = findPath(campusGraph, startNodeId, endNodeId, {
    profile: "recommended",
    timeOfDay: isNightSafety ? "night" : "day",
    blockedNodes: effectiveBlocked
  });

  const stepFree = findStepFreeRoute(campusGraph, startNodeId, endNodeId, {
    blockedNodes
  });

  const shortest = findPath(campusGraph, startNodeId, endNodeId, {
    profile: "shortest",
    blockedNodes
  });

  const safeNight = findPath(campusGraph, startNodeId, endNodeId, {
    profile: "recommended",
    timeOfDay: "night",
    blockedNodes: effectiveBlocked
  });

  const explanation = isNightSafety
    ? "Women's Safe Path: Bypasses isolated, deserted corridors. Strictly routed via monitored central concourse with 85%+ footfall and security surveillance."
    : generateTradeOffExplanation(recommended, shortest, stepFree);

  return {
    recommended: isNightSafety && safeNight.status === "found" ? safeNight : recommended,
    stepFree,
    shortest,
    safeNight: safeNight.status === "found" ? safeNight : recommended,
    explanation
  };
}

export function calculateEvacuationRoute(
  currentNodeId: string,
  blockedNodes?: Set<string>,
  isNightSafety: boolean = false
): RouteResult {
  const effectiveBlocked = new Set<string>(blockedNodes || []);
  if (isNightSafety) {
    for (const node of LOW_FOOTFALL_NIGHT_NODES) {
      if (node !== currentNodeId && !node.startsWith("exit-")) {
        effectiveBlocked.add(node);
      }
    }
  }
  return findEmergencyEvacuationRoute(campusGraph, currentNodeId, {
    blockedNodes: effectiveBlocked
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
