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
  width: 850,
  height: 650
};

export const ARCHITECTURAL_ROOMS: ArchitecturalRoom[] = [
  { id: "room-204", name: "Room 204", code: "204", category: "classroom", nodeId: "node-204", bounds: { x: 90, y: 170, width: 60, height: 85 } },
  { id: "room-208", name: "Computer / IoT Lab", code: "208", category: "lab", nodeId: "node-208", bounds: { x: 185, y: 170, width: 70, height: 85 } },
  { id: "wash-girls-208", name: "Girls Restroom", code: "W-208", category: "restroom", nodeId: "node-wash-girls-208", bounds: { x: 185, y: 130, width: 45, height: 35 } },
  { id: "room-207", name: "Faculty Office 207", code: "207", category: "office", nodeId: "node-207", bounds: { x: 260, y: 170, width: 35, height: 85 } },
  { id: "room-206", name: "Room 206", code: "206", category: "classroom", nodeId: "node-206", bounds: { x: 300, y: 170, width: 55, height: 85 } },
  { id: "room-209", name: "Room 209", code: "209", category: "classroom", nodeId: "node-209", bounds: { x: 360, y: 170, width: 55, height: 85 } },
  { id: "wash-214", name: "Washroom Near 214", code: "W-214", category: "restroom", nodeId: "node-wash-214", bounds: { x: 395, y: 130, width: 35, height: 35 } },
  { id: "room-214", name: "Room 214", code: "214", category: "classroom", nodeId: "node-214", bounds: { x: 420, y: 170, width: 50, height: 85 } },
  { id: "room-210", name: "Room 210", code: "210", category: "classroom", nodeId: "node-210", bounds: { x: 420, y: 170, width: 50, height: 42 } },
  { id: "room-212", name: "Seminar Room 212", code: "212", category: "classroom", nodeId: "node-212", bounds: { x: 420, y: 213, width: 50, height: 42 } },
  { id: "lobby-lift", name: "Elevator & Stair Lobby", code: "LIFT", category: "service", nodeId: "c-lift", bounds: { x: 475, y: 210, width: 50, height: 50 } },
  { id: "stairs-north", name: "North Staircase", code: "STAIRS", category: "service", nodeId: "node-stairs-north", bounds: { x: 475, y: 155, width: 50, height: 50 } },
  { id: "room-215", name: "Room 215", code: "215", category: "classroom", nodeId: "node-215", bounds: { x: 475, y: 170, width: 40, height: 40 } },
  { id: "room-211", name: "Room 211", code: "211", category: "classroom", nodeId: "node-211", bounds: { x: 530, y: 170, width: 50, height: 85 } },
  { id: "room-217", name: "Faculty Office 217", code: "217", category: "office", nodeId: "node-217", bounds: { x: 585, y: 170, width: 50, height: 85 } },
  { id: "room-218", name: "Room 218", code: "218", category: "classroom", nodeId: "node-218", bounds: { x: 640, y: 170, width: 50, height: 85 } },
  { id: "room-219", name: "AI & Research Lab", code: "219", category: "lab", nodeId: "node-219", bounds: { x: 695, y: 170, width: 60, height: 85 } },
  { id: "room-220", name: "Auditorium Annex 220", code: "220", category: "classroom", nodeId: "node-220", bounds: { x: 760, y: 170, width: 45, height: 85 } },

  // South Side
  { id: "room-201", name: "Room 201", code: "201", category: "classroom", nodeId: "node-201", bounds: { x: 90, y: 325, width: 60, height: 60 } },
  { id: "wash-boys", name: "Boys Washroom", code: "W-BOYS", category: "restroom", nodeId: "node-wash-boys", bounds: { x: 90, y: 395, width: 60, height: 50 } },
  { id: "wash-girls-211", name: "Girls Washroom 211", code: "W-211", category: "restroom", nodeId: "node-wash-girls-211", bounds: { x: 475, y: 335, width: 50, height: 50 } }
];

export const EMERGENCY_EQUIPMENT: EmergencyEquipment[] = [
  { id: "exit-west-ramp", type: "exit-ramp", label: "Fire Exit West (Ramp)", x: 70, y: 280, nodeId: "exit-west" },
  { id: "exit-east-door", type: "exit-door", label: "Fire Exit East", x: 785, y: 280, nodeId: "exit-east" },
  { id: "fe-1", type: "extinguisher", label: "FE-01 West Corridor", x: 145, y: 268 },
  { id: "fe-2", type: "extinguisher", label: "FE-02 Near Lab 208", x: 235, y: 268 },
  { id: "fe-3", type: "extinguisher", label: "FE-03 Central Lobby", x: 535, y: 268 },
  { id: "fe-4", type: "extinguisher", label: "FE-04 East Corridor", x: 670, y: 268 },
  { id: "aed-lobby", type: "aed", label: "AED Central Lobby", x: 515, y: 240, nodeId: "c-lift" }
];

export const RAW_POIS: POI[] = [
  { id: "poi-206", name: "Room 206", category: "Classroom", nodeId: "node-206", aliases: ["206", "AB1-206", "lab 206"] },
  { id: "poi-207", name: "Room 207", category: "Faculty Office", nodeId: "node-207", aliases: ["207", "AB1-207", "prof cabin 207"] },
  { id: "poi-208", name: "Room 208", category: "Computer Lab", nodeId: "node-208", aliases: ["208", "AB1-208", "iot lab 208"] },
  { id: "poi-209", name: "Room 209", category: "Classroom", nodeId: "node-209", aliases: ["209", "AB1-209"] },
  { id: "poi-210", name: "Room 210", category: "Classroom", nodeId: "node-210", aliases: ["210", "AB1-210"] },
  { id: "poi-211", name: "Room 211", category: "Classroom", nodeId: "node-211", aliases: ["211", "AB1-211"] },
  { id: "poi-212", name: "Room 212", category: "Seminar Room", nodeId: "node-212", aliases: ["212", "AB1-212"] },
  { id: "poi-214", name: "Room 214", category: "Classroom", nodeId: "node-214", aliases: ["214", "AB1-214"] },
  { id: "poi-215", name: "Room 215", category: "Classroom", nodeId: "node-215", aliases: ["215", "AB1-215"] },
  { id: "poi-217", name: "Room 217", category: "Faculty Office", nodeId: "node-217", aliases: ["217", "AB1-217"] },
  { id: "poi-218", name: "Room 218", category: "Classroom", nodeId: "node-218", aliases: ["218", "AB1-218"] },
  { id: "poi-219", name: "Room 219", category: "Research Lab", nodeId: "node-219", aliases: ["219", "219a", "219c", "ai lab"] },
  { id: "poi-220", name: "Room 220", category: "Auditorium Annex", nodeId: "node-220", aliases: ["220", "AB1-220"] },
  { id: "poi-lift", name: "Central Elevator", category: "Elevator", nodeId: "c-lift", aliases: ["lift", "elevator", "accessible lift"] },
  { id: "poi-stairs-north", name: "North Staircase", category: "Stairs", nodeId: "node-stairs-north", aliases: ["stairs", "steps", "north stairwell"] },
  { id: "poi-exit-west", name: "Fire Exit West (Ramp)", category: "Emergency Exit", nodeId: "exit-west", aliases: ["exit", "west exit", "ramp", "fire exit"] },
  { id: "poi-exit-east", name: "Fire Exit East", category: "Emergency Exit", nodeId: "exit-east", aliases: ["east exit", "fire exit east"] },
  { id: "poi-wash-boys", name: "Boys Washroom", category: "Restroom", nodeId: "node-wash-boys", aliases: ["washroom", "men", "boys restroom"] },
  { id: "poi-wash-girls-208", name: "Girls Washroom (Near 208)", category: "Restroom", nodeId: "node-wash-girls-208", aliases: ["washroom", "women", "ladies restroom"] },
  { id: "poi-wash-girls-211", name: "Girls Washroom (Front of 211)", category: "Restroom", nodeId: "node-wash-girls-211", aliases: ["girls washroom", "restroom 211"] },
  { id: "poi-balcony", name: "Circular Balcony", category: "Outdoor Terrace", nodeId: "c-balcony-circ", aliases: ["balcony", "terrace", "circular balcony"] }
];
