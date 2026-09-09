export interface POI {
  id: string;
  name: string;
  category: string;
  nodeId: string;
  aliases: string[];
}

export interface ArchitecturalRoom {
  id: string;
  name: string;
  code: string;
  category: "classroom" | "lab" | "office" | "restroom" | "service" | "terrace";
  wing: "North Wing" | "Central Island" | "South Wing" | "West Facade";
  nodeId: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface EmergencyEquipment {
  id: string;
  type: "extinguisher" | "aed" | "exit-ramp" | "exit-door";
  label: string;
  x: number;
  y: number;
  nodeId?: string;
}

export const FLOOR2_DIMENSIONS = {
  width: 960,
  height: 520
};

export const ARCHITECTURAL_ROOMS: ArchitecturalRoom[] = [
  // --- North Wing (West to East) ---
  {
    id: "stair-nw",
    name: "Stairs & Lift (NW)",
    code: "ST-NW",
    category: "service",
    wing: "North Wing",
    nodeId: "stair-nw",
    bounds: { x: 165, y: 85, width: 52.5, height: 97.5 }
  },
  {
    id: "wash-nw",
    name: "Male Washroom NW",
    code: "W-NW",
    category: "restroom",
    wing: "North Wing",
    nodeId: "wash-nw",
    bounds: { x: 217.5, y: 85, width: 52.5, height: 97.5 }
  },
  {
    id: "room-201",
    name: "Room 201",
    code: "201",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-201",
    bounds: { x: 270, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "room-202",
    name: "Room 202",
    code: "202",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-202",
    bounds: { x: 337.5, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "room-203",
    name: "Room 203",
    code: "203",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-203",
    bounds: { x: 405, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "room-204",
    name: "Room 204",
    code: "204",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-204",
    bounds: { x: 472.5, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "stair-nm",
    name: "Stairs & Lift (Mid-North)",
    code: "ST-NM",
    category: "service",
    wing: "North Wing",
    nodeId: "c-lift",
    bounds: { x: 540, y: 85, width: 52.5, height: 97.5 }
  },
  {
    id: "room-205",
    name: "Room 205",
    code: "205",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-205",
    bounds: { x: 592.5, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "room-206",
    name: "Room 206",
    code: "206",
    category: "classroom",
    wing: "North Wing",
    nodeId: "node-206",
    bounds: { x: 660, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "room-207",
    name: "Faculty Office 207",
    code: "207",
    category: "office",
    wing: "North Wing",
    nodeId: "node-207",
    bounds: { x: 727.5, y: 85, width: 67.5, height: 97.5 }
  },
  {
    id: "wash-ne",
    name: "Female Washroom NE",
    code: "W-NE",
    category: "restroom",
    wing: "North Wing",
    nodeId: "wash-ne",
    bounds: { x: 795, y: 85, width: 45, height: 97.5 }
  },
  {
    id: "stair-ne",
    name: "Stairs & Lift NE / Fire Exit",
    code: "ST-NE",
    category: "service",
    wing: "North Wing",
    nodeId: "exit-east",
    bounds: { x: 840, y: 85, width: 45, height: 97.5 }
  },

  // --- Central Island (West to East) ---
  {
    id: "room-211",
    name: "Room 211",
    code: "211",
    category: "classroom",
    wing: "Central Island",
    nodeId: "node-211",
    bounds: { x: 277.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "void-1",
    name: "Structural Lightwell [X1]",
    code: "VOID-1",
    category: "service",
    wing: "Central Island",
    nodeId: "void-1",
    bounds: { x: 337.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "room-210",
    name: "Room 210",
    code: "210",
    category: "classroom",
    wing: "Central Island",
    nodeId: "node-210",
    bounds: { x: 397.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "void-2",
    name: "Structural Lightwell [X2]",
    code: "VOID-2",
    category: "service",
    wing: "Central Island",
    nodeId: "void-2",
    bounds: { x: 457.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "room-212",
    name: "Seminar Room 212",
    code: "212",
    category: "classroom",
    wing: "Central Island",
    nodeId: "node-212",
    bounds: { x: 517.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "room-209",
    name: "Room 209",
    code: "209",
    category: "classroom",
    wing: "Central Island",
    nodeId: "node-209",
    bounds: { x: 577.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "void-3",
    name: "Structural Lightwell [X3]",
    code: "VOID-3",
    category: "service",
    wing: "Central Island",
    nodeId: "void-3",
    bounds: { x: 637.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "room-213",
    name: "Room 213",
    code: "213",
    category: "classroom",
    wing: "Central Island",
    nodeId: "node-213",
    bounds: { x: 697.5, y: 205, width: 60, height: 75 }
  },
  {
    id: "room-208",
    name: "Computer & IoT Lab",
    code: "208",
    category: "lab",
    wing: "Central Island",
    nodeId: "node-208",
    bounds: { x: 757.5, y: 205, width: 60, height: 75 }
  },

  // --- South Wing (West to East) ---
  {
    id: "stair-sw",
    name: "Stairs & Lift (SW) / Fire Exit Ramp",
    code: "ST-SW",
    category: "service",
    wing: "South Wing",
    nodeId: "exit-west",
    bounds: { x: 165, y: 302.5, width: 52.5, height: 97.5 }
  },
  {
    id: "wash-sw",
    name: "Female Washroom SW",
    code: "W-SW",
    category: "restroom",
    wing: "South Wing",
    nodeId: "wash-sw",
    bounds: { x: 217.5, y: 302.5, width: 52.5, height: 97.5 }
  },
  {
    id: "room-220",
    name: "Auditorium Annex 220",
    code: "220",
    category: "classroom",
    wing: "South Wing",
    nodeId: "node-220",
    bounds: { x: 270, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "room-219",
    name: "AI & Research Lab",
    code: "219",
    category: "lab",
    wing: "South Wing",
    nodeId: "node-219",
    bounds: { x: 337.5, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "room-218",
    name: "Room 218",
    code: "218",
    category: "classroom",
    wing: "South Wing",
    nodeId: "node-218",
    bounds: { x: 405, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "room-217",
    name: "Faculty Office 217",
    code: "217",
    category: "office",
    wing: "South Wing",
    nodeId: "node-217",
    bounds: { x: 472.5, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "stair-sm",
    name: "Stairs & Lift (Mid-South)",
    code: "ST-SM",
    category: "service",
    wing: "South Wing",
    nodeId: "node-stairs-south",
    bounds: { x: 540, y: 302.5, width: 52.5, height: 97.5 }
  },
  {
    id: "room-216",
    name: "Room 216",
    code: "216",
    category: "classroom",
    wing: "South Wing",
    nodeId: "node-216",
    bounds: { x: 592.5, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "room-215",
    name: "Room 215",
    code: "215",
    category: "classroom",
    wing: "South Wing",
    nodeId: "node-215",
    bounds: { x: 660, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "room-214",
    name: "Room 214",
    code: "214",
    category: "classroom",
    wing: "South Wing",
    nodeId: "node-214",
    bounds: { x: 727.5, y: 302.5, width: 67.5, height: 97.5 }
  },
  {
    id: "wash-se",
    name: "Male Washroom SE",
    code: "W-SE",
    category: "restroom",
    wing: "South Wing",
    nodeId: "wash-se",
    bounds: { x: 795, y: 302.5, width: 45, height: 97.5 }
  },
  {
    id: "stair-se",
    name: "Stairs & Lift (SE)",
    code: "ST-SE",
    category: "service",
    wing: "South Wing",
    nodeId: "node-stairs-se",
    bounds: { x: 840, y: 302.5, width: 45, height: 97.5 }
  },

  // --- West Facade ---
  {
    id: "balcony",
    name: "Circular Balcony Terrace",
    code: "BALCONY",
    category: "terrace",
    wing: "West Facade",
    nodeId: "c-balcony-circ",
    bounds: { x: 75, y: 152.5, width: 90, height: 180 }
  }
];

export const EMERGENCY_EQUIPMENT: EmergencyEquipment[] = [
  { id: "exit-west-ramp", type: "exit-ramp", label: "Fire Exit West (Ramp)", x: 191, y: 350, nodeId: "exit-west" },
  { id: "exit-east-door", type: "exit-door", label: "Fire Exit East", x: 862, y: 133, nodeId: "exit-east" },
  { id: "fe-1", type: "extinguisher", label: "FE-01 West Corridor", x: 230, y: 193 },
  { id: "fe-2", type: "extinguisher", label: "FE-02 IoT Lab 208", x: 780, y: 242 },
  { id: "fe-3", type: "extinguisher", label: "FE-03 Central Elevators", x: 566, y: 193 },
  { id: "fe-4", type: "extinguisher", label: "FE-04 South Corridor", x: 500, y: 291 },
  { id: "aed-lobby", type: "aed", label: "AED Central Lobby", x: 566, y: 133, nodeId: "c-lift" }
];

export const RAW_POIS: POI[] = [
  // North Wing POIs
  { id: "poi-201", name: "Room 201", category: "Classroom", nodeId: "node-201", aliases: ["201", "AB1-201", "room 201"] },
  { id: "poi-202", name: "Room 202", category: "Classroom", nodeId: "node-202", aliases: ["202", "AB1-202", "room 202"] },
  { id: "poi-203", name: "Room 203", category: "Classroom", nodeId: "node-203", aliases: ["203", "AB1-203", "room 203"] },
  { id: "poi-204", name: "Room 204", category: "Classroom", nodeId: "node-204", aliases: ["204", "AB1-204", "room 204"] },
  { id: "poi-205", name: "Room 205", category: "Classroom", nodeId: "node-205", aliases: ["205", "AB1-205", "room 205"] },
  { id: "poi-206", name: "Room 206", category: "Classroom", nodeId: "node-206", aliases: ["206", "AB1-206", "room 206"] },
  { id: "poi-207", name: "Faculty Office 207", category: "Faculty Office", nodeId: "node-207", aliases: ["207", "AB1-207", "prof cabin 207"] },
  { id: "poi-wash-nw", name: "Male Washroom NW", category: "Restroom", nodeId: "wash-nw", aliases: ["washroom", "men", "male restroom nw"] },
  { id: "poi-wash-ne", name: "Female Washroom NE", category: "Restroom", nodeId: "wash-ne", aliases: ["washroom", "women", "ladies restroom ne"] },
  { id: "poi-stair-nw", name: "Stairs & Lift NW", category: "Stairs", nodeId: "stair-nw", aliases: ["stairs nw", "lift nw", "northwest elevator"] },

  // Central Island POIs
  { id: "poi-211", name: "Room 211", category: "Classroom", nodeId: "node-211", aliases: ["211", "AB1-211", "room 211"] },
  { id: "poi-210", name: "Room 210", category: "Classroom", nodeId: "node-210", aliases: ["210", "AB1-210", "room 210"] },
  { id: "poi-212", name: "Seminar Room 212", category: "Seminar Room", nodeId: "node-212", aliases: ["212", "AB1-212", "seminar 212"] },
  { id: "poi-209", name: "Room 209", category: "Classroom", nodeId: "node-209", aliases: ["209", "AB1-209", "room 209"] },
  { id: "poi-213", name: "Room 213", category: "Classroom", nodeId: "node-213", aliases: ["213", "AB1-213", "room 213"] },
  { id: "poi-208", name: "Computer & IoT Lab", category: "Computer Lab", nodeId: "node-208", aliases: ["208", "AB1-208", "iot lab 208", "hardware lab"] },
  { id: "poi-lift", name: "Central Elevator & Stairs", category: "Elevator", nodeId: "c-lift", aliases: ["lift", "elevator", "accessible lift", "central stairs"] },

  // South Wing POIs
  { id: "poi-220", name: "Auditorium Annex 220", category: "Auditorium Annex", nodeId: "node-220", aliases: ["220", "AB1-220", "auditorium annex"] },
  { id: "poi-219", name: "AI & Research Lab", category: "Research Lab", nodeId: "node-219", aliases: ["219", "AB1-219", "ai lab", "research lab"] },
  { id: "poi-218", name: "Room 218", category: "Classroom", nodeId: "node-218", aliases: ["218", "AB1-218", "room 218"] },
  { id: "poi-217", name: "Faculty Office 217", category: "Faculty Office", nodeId: "node-217", aliases: ["217", "AB1-217", "prof cabin 217"] },
  { id: "poi-216", name: "Room 216", category: "Classroom", nodeId: "node-216", aliases: ["216", "AB1-216", "room 216"] },
  { id: "poi-215", name: "Room 215", category: "Classroom", nodeId: "node-215", aliases: ["215", "AB1-215", "room 215"] },
  { id: "poi-214", name: "Room 214", category: "Classroom", nodeId: "node-214", aliases: ["214", "AB1-214", "room 214"] },
  { id: "poi-wash-sw", name: "Female Washroom SW", category: "Restroom", nodeId: "wash-sw", aliases: ["washroom", "women", "ladies restroom sw"] },
  { id: "poi-wash-se", name: "Male Washroom SE", category: "Restroom", nodeId: "wash-se", aliases: ["washroom", "men", "male restroom se"] },

  // Exits & Balcony
  { id: "poi-stairs-safest", name: "Safest Central Stairs (ST-NM)", category: "Stairs", nodeId: "node-stairs-north", aliases: ["stairs", "safest stairs", "safe stairs", "staircase", "central stairs", "st-nm", "nearest stairs"] },
  { id: "poi-stairs-south", name: "Central South Stairs (ST-SM)", category: "Stairs", nodeId: "node-stairs-south", aliases: ["south stairs", "central south stairs", "stairs sm", "st-sm", "safe stairs"] },
  { id: "poi-exit-west", name: "Fire Exit West (Ramp)", category: "Emergency Exit", nodeId: "exit-west", aliases: ["exit", "west exit", "ramp", "fire exit west", "accessible exit", "safe ramp"] },
  { id: "poi-exit-east", name: "Fire Exit East", category: "Emergency Exit", nodeId: "exit-east", aliases: ["east exit", "fire exit east", "stair ne", "east stairs"] },
  { id: "poi-stair-se", name: "Stairs SE (ST-SE)", category: "Stairs", nodeId: "node-stairs-se", aliases: ["stairs se", "southeast stairs", "st-se"] },
  { id: "poi-balcony", name: "Circular Balcony", category: "Outdoor Terrace", nodeId: "c-balcony-circ", aliases: ["balcony", "terrace", "circular balcony"] }
];

export type FootfallTier = "high" | "moderate" | "low" | "deserted";

export interface FootfallRating {
  tier: FootfallTier;
  percentage: number;
  color: string;
  fillColor: string;
  strokeColor: string;
  label: string;
  badge: string;
  description: string;
}

/**
 * Returns the night-time footfall safety rating and color tier for any room or zone.
 * - High Footfall (85%+): Green (Central concourse, security desk, active labs)
 * - Moderate Footfall (50%-80%): Orange (Standard classroom wings)
 * - Low Footfall (20%-45%): Lighter Red (Peripheral faculty cabins & washrooms)
 * - Deserted (<15%): Darker Red to Black (Terraces, outer balconies, dead-ends)
 */
export function getRoomFootfall(roomId: string): FootfallRating {
  const code = roomId.replace(/^(room-|node-|poi-)/i, "").toLowerCase();

  // 1. High Footfall (85%+): Green
  if (
    ["204", "208", "219", "212", "st-nm", "stair-nm", "c-lift", "c-atrium", "lift"].includes(code) ||
    code.includes("ai") ||
    code.includes("iot")
  ) {
    const pct = code.includes("219") ? 94 : code.includes("st-nm") || code.includes("lift") ? 95 : 88;
    return {
      tier: "high",
      percentage: pct,
      color: "#22C55E",
      fillColor: "#052e16",
      strokeColor: "#22C55E",
      label: "High Footfall (85%+)",
      badge: `${pct}%`,
      description: "100% well-lit, active central concourse with 24/7 CCTV surveillance"
    };
  }

  // 2. Deserted / Dangerous at Night (<15%): Pure Black (Null or very very less footfall)
  if (
    [
      "balcony",
      "c-balcony",
      "c-balcony-circ",
      "c-west",
      "node-wash-boys",
      "st-nw",
      "stair-nw",
      "st-se",
      "stair-se",
      "c-se",
      "void-1",
      "void-2",
      "void-3"
    ].includes(code) ||
    code.includes("balcony") ||
    code.includes("void")
  ) {
    const pct = code.includes("balcony") ? 6 : code.includes("void") ? 0 : 9;
    return {
      tier: "deserted",
      percentage: pct,
      color: "#000000",
      fillColor: "#000000",
      strokeColor: "#000000",
      label: "Black: Null / Very Very Less (<15%)",
      badge: `${pct}%`,
      description: "Dark, deserted zone with null or minimal footfall. Strictly avoided by night routing"
    };
  }

  // 3. Low Footfall (20%-45%): Lighter Red
  if (
    [
      "201",
      "207",
      "211",
      "213",
      "214",
      "215",
      "217",
      "w-nw",
      "w-ne",
      "w-sw",
      "w-se",
      "wash-nw",
      "wash-ne",
      "wash-sw",
      "wash-se"
    ].includes(code) ||
    code.includes("wash") ||
    code.includes("prof")
  ) {
    const pct = code.includes("207") || code.includes("217") ? 26 : 34;
    return {
      tier: "low",
      percentage: pct,
      color: "#EF4444",
      fillColor: "#2a080c",
      strokeColor: "#EF4444",
      label: "Red: Very Low Footfall (20%-45%)",
      badge: `${pct}%`,
      description: "Infrequent evening footfall, peripheral office and restroom wing"
    };
  }

  // 4. Moderate Footfall (50%-80%): Orange (Little Low)
  return {
    tier: "moderate",
    percentage: 65,
    color: "#F97316",
    fillColor: "#2b1303",
    strokeColor: "#F97316",
    label: "Orange: Little Low / Moderate Footfall (50%-80%)",
    badge: "65%",
    description: "Standard academic wing corridor with regular class transit"
  };
}

