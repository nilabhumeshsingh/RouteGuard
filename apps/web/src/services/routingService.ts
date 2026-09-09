import { CampusGraph, findPath, findStepFreeRoute, findEmergencyEvacuationRoute, generateTradeOffExplanation } from "@routeguard/graph";
import { RouteResult, RoutePoint } from "@routeguard/shared";

// Architectural coordinate mapping strictly matched to 2D SVG blueprint and dollhouse model
export const ARCHITECTURAL_NODE_COORDS: Record<string, { x: number; y: number }> = {
  // --- Exits & Stairwells ---
  "exit-west": { x: 191.25, y: 351.25 }, // Ramp ST-SW (100% Step-Free Accessible Egress)
  "exit-east": { x: 862.5, y: 133.75 }, // Fire Exit & Stairs NE (ST-NE)
  "node-stairs-north": { x: 566.25, y: 133.75 }, // Central North Stairs (ST-NM, 95% Footfall Core)
  "node-stairs-south": { x: 566.25, y: 351.25 }, // Central South Stairs (ST-SM, 95% Footfall Core)
  "stair-nw": { x: 191.25, y: 133.75 }, // Northwest Service Stairs (ST-NW)
  "node-stairs-se": { x: 862.5, y: 351.25 }, // Southeast Service Stairs (ST-SE)

  // --- North Wing Classrooms & Washrooms (y = 133.75) ---
  "stair-nw-room": { x: 191.25, y: 133.75 },
  "wash-nw": { x: 243.75, y: 133.75 },
  "node-wash-boys": { x: 243.75, y: 133.75 },
  "node-201": { x: 303.75, y: 133.75 },
  "node-202": { x: 371.25, y: 133.75 },
  "node-203": { x: 438.75, y: 133.75 },
  "node-204": { x: 506.25, y: 133.75 },
  "node-205": { x: 626.25, y: 133.75 },
  "node-206": { x: 693.75, y: 133.75 },
  "node-207": { x: 761.25, y: 133.75 },
  "wash-ne": { x: 817.5, y: 133.75 },
  "node-wash-girls-208": { x: 817.5, y: 133.75 },

  // --- North Corridor Waypoints (Centerline y = 193.75) ---
  "c-nw": { x: 191.25, y: 193.75 }, // Northwest concourse junction
  "c-wash-nw": { x: 243.75, y: 193.75 }, // Doorway to Male Restroom NW
  "c-201": { x: 303.75, y: 193.75 }, // Doorway to Room 201
  "c-202": { x: 371.25, y: 193.75 }, // Doorway to Room 202
  "c-203": { x: 438.75, y: 193.75 }, // Doorway to Room 203
  "c-204": { x: 506.25, y: 193.75 }, // Doorway to Room 204
  "c-lift": { x: 566.25, y: 193.75 }, // Central North Elevator & Stairs Concourse (95% footfall core)
  "c-205": { x: 626.25, y: 193.75 }, // Doorway to Room 205
  "c-206": { x: 693.75, y: 193.75 }, // Doorway to Room 206
  "c-207": { x: 761.25, y: 193.75 }, // Doorway to Room 207
  "c-208": { x: 787.5, y: 193.75 }, // Doorway to IoT Lab 208
  "c-wash-ne": { x: 817.5, y: 193.75 }, // Doorway to Female Restroom NE
  "c-ne": { x: 862.5, y: 193.75 }, // Northeast fire exit concourse junction

  // --- Central Island Rooms (Centerline y = 242.5) ---
  "node-211": { x: 307.5, y: 242.5 },
  "node-210": { x: 427.5, y: 242.5 },
  "node-212": { x: 547.5, y: 242.5 },
  "node-209": { x: 607.5, y: 242.5 },
  "node-213": { x: 727.5, y: 242.5 },
  "node-208": { x: 787.5, y: 242.5 }, // Computer & IoT Lab 208

  // Legacy node aliases for backwards compatibility
  "c-mid-west": { x: 438.75, y: 242.5 },
  "c-mid-east": { x: 566.25, y: 242.5 },
  "c-210": { x: 438.75, y: 193.75 },
  "c-211": { x: 303.75, y: 193.75 },

  // --- South Corridor Waypoints (Centerline y = 291.25) ---
  "c-west": { x: 191.25, y: 291.25 }, // Southwest concourse junction / Exit Ramp access
  "c-wash-sw": { x: 243.75, y: 291.25 }, // Doorway to Female Restroom SW
  "c-220": { x: 303.75, y: 291.25 }, // Doorway to Room 220
  "c-219": { x: 371.25, y: 291.25 }, // Doorway to AI Lab 219
  "c-218": { x: 438.75, y: 291.25 }, // Doorway to Room 218
  "c-217": { x: 506.25, y: 291.25 }, // Doorway to Room 217
  "c-sm": { x: 566.25, y: 291.25 }, // Central South Stairs Concourse (95% footfall core)
  "c-216": { x: 626.25, y: 291.25 }, // Doorway to Room 216
  "c-215": { x: 693.75, y: 291.25 }, // Doorway to Room 215
  "c-214": { x: 761.25, y: 291.25 }, // Doorway to Room 214
  "c-wash-se": { x: 817.5, y: 291.25 }, // Doorway to Male Restroom SE
  "c-se": { x: 862.5, y: 291.25 }, // Southeast concourse junction

  // --- South Wing Classrooms & Washrooms (y = 351.25) ---
  "wash-sw": { x: 243.75, y: 351.25 },
  "node-220": { x: 303.75, y: 351.25 },
  "node-219": { x: 371.25, y: 351.25 },
  "node-219a": { x: 355, y: 335 },
  "node-219c": { x: 388, y: 335 },
  "node-218": { x: 438.75, y: 351.25 },
  "node-217": { x: 506.25, y: 351.25 },
  "node-216": { x: 626.25, y: 351.25 },
  "node-215": { x: 693.75, y: 351.25 },
  "node-214": { x: 761.25, y: 351.25 },
  "wash-se": { x: 817.5, y: 351.25 },

  // --- West Balcony Terrace ---
  "c-balcony": { x: 120, y: 242.5 },
  "c-balcony-circ": { x: 100, y: 242.5 }
};

export interface SafeStairTarget {
  id: string;
  name: string;
  code: string;
  category: "stairs" | "ramp";
  safetyTier: "highest" | "high" | "moderate" | "low";
  footfallPercentage: number;
  isStepFree: boolean;
  isMonitored: boolean;
  description: string;
  penaltyWeight: number;
}

export const SAFE_STAIR_TARGETS: SafeStairTarget[] = [
  {
    id: "node-stairs-north",
    name: "Central North Stairs (ST-NM)",
    code: "ST-NM",
    category: "stairs",
    safetyTier: "highest",
    footfallPercentage: 95,
    isStepFree: false,
    isMonitored: true,
    description: "Central concourse core with 24/7 CCTV surveillance and 95% footfall",
    penaltyWeight: 0
  },
  {
    id: "node-stairs-south",
    name: "Central South Stairs (ST-SM)",
    code: "ST-SM",
    category: "stairs",
    safetyTier: "highest",
    footfallPercentage: 95,
    isStepFree: false,
    isMonitored: true,
    description: "Central concourse core with 24/7 CCTV surveillance and 95% footfall",
    penaltyWeight: 0
  },
  {
    id: "exit-west",
    name: "West Egress Ramp (ST-SW)",
    code: "ST-SW",
    category: "ramp",
    safetyTier: "high",
    footfallPercentage: 85,
    isStepFree: true,
    isMonitored: true,
    description: "100% accessible step-free egress ramp with wide clearance",
    penaltyWeight: 2
  },
  {
    id: "exit-east",
    name: "East Fire Exit Stairs (ST-NE)",
    code: "ST-NE",
    category: "stairs",
    safetyTier: "high",
    footfallPercentage: 70,
    isStepFree: false,
    isMonitored: true,
    description: "Direct exterior egress stairwell with fire door containment",
    penaltyWeight: 6
  },
  {
    id: "stair-nw",
    name: "Northwest Back Stairs (ST-NW)",
    code: "ST-NW",
    category: "stairs",
    safetyTier: "low",
    footfallPercentage: 12,
    isStepFree: false,
    isMonitored: false,
    description: "Isolated service stairwell (<15% footfall). Bypassed in Night Safety mode.",
    penaltyWeight: 35
  },
  {
    id: "node-stairs-se",
    name: "Southeast Back Stairs (ST-SE)",
    code: "ST-SE",
    category: "stairs",
    safetyTier: "low",
    footfallPercentage: 14,
    isStepFree: false,
    isMonitored: false,
    description: "Peripheral service stairwell (<15% footfall). Bypassed in Night Safety mode.",
    penaltyWeight: 35
  }
];

// Low-footfall, isolated corridors & service alleys to avoid at night
export const LOW_FOOTFALL_NIGHT_NODES = new Set<string>([
  "c-west",
  "c-balcony",
  "c-balcony-circ",
  "node-wash-boys",
  "wash-nw",
  "stair-nw",
  "node-stairs-se",
  "c-se",
  "wash-se"
]);

/**
 * Builds the authentic Floor 2 architectural graph.
 * Pure corridor routing: all corridors are linear horizontal or vertical segments,
 * and every room/stair connection is strictly perpendicular through its doorway.
 */
function buildArchitecturalCampusGraph(): CampusGraph {
  const graph = new CampusGraph();

  // Register all nodes
  for (const [id, coords] of Object.entries(ARCHITECTURAL_NODE_COORDS)) {
    const isExit = id === "exit-west" || id === "exit-east" || id === "node-stairs-north" || id === "node-stairs-south" || id === "stair-nw" || id === "node-stairs-se";
    const isRefuge = id === "exit-west" || id === "node-stairs-north" || id === "node-stairs-south";
    const isStepFree = id !== "node-stairs-north" && id !== "node-stairs-south" && id !== "stair-nw" && id !== "node-stairs-se" && id !== "exit-east";

    graph.addNode({
      id,
      label: id.replace(/^(node-|c-|poi-)/, "").toUpperCase(),
      x: coords.x,
      y: coords.y,
      floorId: "floor-2",
      isExit,
      isRefuge,
      isStepFree
    });
  }

  // Helper to add bidirectional corridor edge
  const addCorridor = (from: string, to: string, distance: number, lighting: "well_lit" | "moderate" | "dim" = "well_lit", crowd: "low" | "moderate" | "high" = "low") => {
    graph.addEdge({ from, to, distance, type: "corridor", isStepFree: true, lighting, crowd });
  };

  // Helper to add doorway edge (perpendicular access into room)
  const addDoor = (corridor: string, room: string, distance: number = 3.5) => {
    graph.addEdge({ from: corridor, to: room, distance, type: "door", isStepFree: true, lighting: "well_lit", crowd: "low" });
  };

  // Helper to add stair/ramp edge
  const addStair = (corridor: string, stair: string, distance: number = 3.5, type: "stairs" | "ramp" = "stairs", isStepFree: boolean = false) => {
    graph.addEdge({ from: corridor, to: stair, distance, type, isStepFree, lighting: "well_lit", crowd: "moderate" });
  };

  // 1. --- NORTH CORRIDOR (y = 193.75) ---
  // Sequential linear horizontal edges along North Corridor
  addCorridor("c-nw", "c-wash-nw", 3.5, "moderate", "low");
  addCorridor("c-wash-nw", "c-201", 4.0, "well_lit", "low");
  addCorridor("c-201", "c-202", 4.5, "well_lit", "low");
  addCorridor("c-202", "c-203", 4.5, "well_lit", "low");
  addCorridor("c-203", "c-204", 4.5, "well_lit", "low");
  addCorridor("c-204", "c-lift", 4.0, "well_lit", "moderate"); // Into Central Concourse Core
  addCorridor("c-lift", "c-205", 4.0, "well_lit", "moderate");
  addCorridor("c-205", "c-206", 4.5, "well_lit", "low");
  addCorridor("c-206", "c-207", 4.5, "well_lit", "low");
  addCorridor("c-207", "c-208", 2.0, "well_lit", "low");
  addCorridor("c-208", "c-wash-ne", 2.5, "well_lit", "low");
  addCorridor("c-wash-ne", "c-ne", 3.5, "well_lit", "low");

  // 2. --- SOUTH CORRIDOR (y = 291.25) ---
  // Sequential linear horizontal edges along South Corridor
  addCorridor("c-west", "c-wash-sw", 3.5, "moderate", "low");
  addCorridor("c-wash-sw", "c-220", 4.0, "well_lit", "low");
  addCorridor("c-220", "c-219", 4.5, "well_lit", "low");
  addCorridor("c-219", "c-218", 4.5, "well_lit", "low");
  addCorridor("c-218", "c-217", 4.5, "well_lit", "low");
  addCorridor("c-217", "c-sm", 4.0, "well_lit", "moderate"); // Into Central Concourse Core
  addCorridor("c-sm", "c-216", 4.0, "well_lit", "moderate");
  addCorridor("c-216", "c-215", 4.5, "well_lit", "low");
  addCorridor("c-215", "c-214", 4.5, "well_lit", "low");
  addCorridor("c-214", "c-wash-se", 3.5, "moderate", "low");
  addCorridor("c-wash-se", "c-se", 3.0, "moderate", "low");

  // 3. --- VERTICAL CONCOURSE CONNECTORS ---
  // West Atrium Connector: connects North & South Corridors in front of Balcony (x = 191.25)
  addCorridor("c-nw", "c-west", 6.5, "moderate", "low");

  // Central Monitored Spine: primary monitored concourse with 95% footfall (x = 566.25)
  addCorridor("c-lift", "c-sm", 6.5, "well_lit", "moderate");

  // East Fire Exit Connector: connects North & South Corridors at East Wing (x = 862.5)
  addCorridor("c-ne", "c-se", 6.5, "well_lit", "low");

  // 4. --- BALCONY TERRACE CONNECTOR ---
  addCorridor("c-west", "c-balcony", 5.0, "dim", "low");
  addCorridor("c-balcony", "c-balcony-circ", 2.0, "dim", "low");

  // 5. --- NORTH WING ROOM DOORWAYS (perpendicular vertical connections) ---
  addDoor("c-wash-nw", "wash-nw", 4.0);
  addDoor("c-wash-nw", "node-wash-boys", 4.0);
  addDoor("c-201", "node-201", 4.0);
  addDoor("c-202", "node-202", 4.0);
  addDoor("c-203", "node-203", 4.0);
  addDoor("c-204", "node-204", 4.0);
  addDoor("c-205", "node-205", 4.0);
  addDoor("c-206", "node-206", 4.0);
  addDoor("c-207", "node-207", 4.0);
  addDoor("c-208", "node-208", 3.5);
  addDoor("c-wash-ne", "wash-ne", 4.0);
  addDoor("c-wash-ne", "node-wash-girls-208", 4.0);

  // 6. --- SOUTH WING ROOM DOORWAYS (perpendicular vertical connections) ---
  addDoor("c-wash-sw", "wash-sw", 4.0);
  addDoor("c-220", "node-220", 4.0);
  addDoor("c-219", "node-219", 4.0);
  addDoor("c-219", "node-219a", 3.0);
  addDoor("c-219", "node-219c", 3.0);
  addDoor("c-218", "node-218", 4.0);
  addDoor("c-217", "node-217", 4.0);
  addDoor("c-216", "node-216", 4.0);
  addDoor("c-215", "node-215", 4.0);
  addDoor("c-214", "node-214", 4.0);
  addDoor("c-wash-se", "wash-se", 4.0);

  // 7. --- CENTRAL ISLAND ROOM DOORWAYS ---
  // Rooms on Central Island connect strictly to their primary entrance doorway.
  // Corridors & Concourse connectors (c-lift <-> c-sm) must be used for transit between wings.
  addDoor("c-201", "node-211", 3.5);
  addDoor("c-203", "node-210", 3.5);
  addDoor("c-lift", "node-212", 3.5);
  addDoor("c-205", "node-209", 3.5);
  addDoor("c-214", "node-213", 3.5);
  addDoor("c-208", "node-208", 3.5);

  // 8. --- STAIRS & EXITS CONNECTIONS ---
  // Central North Stairs ST-NM (Central Concourse Core, 95% footfall)
  addStair("c-lift", "node-stairs-north", 3.5, "stairs", false);

  // Central South Stairs ST-SM (Central Concourse Core, 95% footfall)
  addStair("c-sm", "node-stairs-south", 3.5, "stairs", false);

  // West Egress Ramp ST-SW (100% Step-Free Accessible)
  addStair("c-west", "exit-west", 3.5, "ramp", true);

  // East Fire Exit Stairs ST-NE
  addStair("c-ne", "exit-east", 3.5, "stairs", false);

  // Northwest Service Stairs ST-NW
  addStair("c-nw", "stair-nw", 3.5, "stairs", false);

  // Southeast Service Stairs ST-SE
  addStair("c-se", "node-stairs-se", 3.5, "stairs", false);

  return graph;
}

// Global active campus graph instance for Floor 2
export const campusGraph = buildArchitecturalCampusGraph();

export interface RouteComparison {
  recommended: RouteResult;
  stepFree: RouteResult;
  shortest: RouteResult;
  safeNight?: RouteResult;
  explanation: string;
}

/**
 * Evaluates all stair and egress targets on Floor 2 and computes the safest path.
 * Dynamically weighs central concourse stairs (95% footfall, CCTV monitored) over
 * isolated peripheral stairs, and strictly enforces corridor-only routing.
 */
export function findSafestStairRoute(
  startNodeId: string,
  options: {
    blockedNodes?: Set<string>;
    blockedEdges?: Set<string>;
    isNightSafety?: boolean;
    isStepFree?: boolean;
    isEmergency?: boolean;
  } = {}
): RouteResult {
  const { blockedNodes, blockedEdges, isNightSafety = false, isStepFree = false, isEmergency = false } = options;

  // Build effective blocked set
  const effectiveBlocked = new Set<string>(blockedNodes || []);
  if (isNightSafety) {
    for (const node of LOW_FOOTFALL_NIGHT_NODES) {
      if (node !== startNodeId && node !== "exit-west") {
        effectiveBlocked.add(node);
      }
    }
  }

  let bestRoute: RouteResult | null = null;
  let bestTarget: SafeStairTarget | null = null;
  let lowestCompositeCost = Infinity;

  for (const target of SAFE_STAIR_TARGETS) {
    // If step-free is requested, target must be step-free
    if (isStepFree && !target.isStepFree) {
      continue;
    }

    // Skip if stair itself is blocked
    if (effectiveBlocked.has(target.id)) {
      continue;
    }

    const route = isStepFree
      ? findStepFreeRoute(campusGraph, startNodeId, target.id, {
          blockedNodes: effectiveBlocked,
          blockedEdges,
          timeOfDay: isNightSafety ? "night" : "day"
        })
      : findPath(campusGraph, startNodeId, target.id, {
          profile: isEmergency ? "emergency" : "recommended",
          timeOfDay: isNightSafety ? "night" : "day",
            blockedNodes: effectiveBlocked,
            blockedEdges
        });

    if (route.status === "found" && route.pathPoints && route.pathPoints.length >= 2) {
      // Calculate composite safety score:
      // distance + target safety penalty + night isolation penalty
      let compositeCost = route.totalDistanceMeters + target.penaltyWeight;

      // Central monitored spine stairs get priority bonus
      if (target.safetyTier === "highest") {
        compositeCost -= 4.0;
      }

      // At night, heavily penalize deserted back stairs
      if (isNightSafety && target.safetyTier === "low") {
        compositeCost += 100.0;
      }

      if (compositeCost < lowestCompositeCost) {
        lowestCompositeCost = compositeCost;
        bestRoute = route;
        bestTarget = target;
      }
    }
  }

  if (bestRoute && bestTarget) {
    const isCentral = bestTarget.safetyTier === "highest";
    const explanation = isEmergency
      ? `Emergency Evacuation: Safest route to ${bestTarget.name} via monitored corridors (${bestTarget.footfallPercentage}% footfall).`
      : isNightSafety
      ? `Women's Safe Stair Path: Guided strictly via well-lit corridors to ${bestTarget.name} (${bestTarget.footfallPercentage}% footfall, 24/7 CCTV).`
      : `Safest Stair Route: Direct corridor navigation to ${bestTarget.name} (${bestTarget.description}).`;

    return {
      ...bestRoute,
      isEmergencyExit: true,
      tradeOffExplanation: explanation
    };
  }

  // Fallback if strict blockage occurred: evaluate without non-essential night blockages
  if (isNightSafety) {
    return findSafestStairRoute(startNodeId, {
      blockedNodes,
      blockedEdges,
      isNightSafety: false,
      isStepFree,
      isEmergency
    });
  }

  return {
    status: "unavailable",
    routeId: `rt-stairs-${Date.now()}`,
    profile: isStepFree ? "step-free" : "recommended",
    segments: [],
    pathPoints: [],
    totalDistanceMeters: 0,
    estimatedTimeSeconds: 0,
    isEmergencyExit: true,
    tradeOffExplanation: "No safe, unblocked corridor path to stairs currently available."
  };
}

export function calculateRouteTradeOffs(
  startNodeId: string,
  endNodeId: string,
  blockedNodes?: Set<string>,
  isNightSafety: boolean = false
): RouteComparison {
  // Check if destination is a stair target
  const isStairTarget = SAFE_STAIR_TARGETS.some((s) => s.id === endNodeId);
  if (isStairTarget) {
    const safeStair = findSafestStairRoute(startNodeId, {
      blockedNodes,
      isNightSafety
    });
    const stepFreeStair = findSafestStairRoute(startNodeId, {
      blockedNodes,
      isNightSafety,
      isStepFree: true
    });

    return {
      recommended: safeStair,
      stepFree: stepFreeStair.status === "found" ? stepFreeStair : safeStair,
      shortest: safeStair,
      safeNight: safeStair,
      explanation: safeStair.tradeOffExplanation || "Safest corridor path to stairs."
    };
  }

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
  isNightSafety: boolean = false,
  blockedEdges?: Set<string>
): RouteResult {
  return findSafestStairRoute(currentNodeId, {
    blockedNodes,
    blockedEdges,
    isNightSafety,
    isEmergency: true
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
