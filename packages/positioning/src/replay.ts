import { PositionEstimate } from "@routeguard/shared";

export interface ReplayWaypoint {
  x: number;
  y: number;
  placeName: string;
  durationMs: number;
}

export const FLOOR2_DEMO_WALK_WAYPOINTS: ReplayWaypoint[] = [
  { x: 120, y: 220, placeName: "AB1 Room 204", durationMs: 3000 },
  { x: 120, y: 280, placeName: "Corridor West", durationMs: 2500 },
  { x: 220, y: 280, placeName: "Corridor Hall 208", durationMs: 3000 },
  { x: 300, y: 280, placeName: "Corridor 206", durationMs: 2500 },
  { x: 380, y: 280, placeName: "Corridor 212-209", durationMs: 2500 },
  { x: 440, y: 280, placeName: "Corridor 210-212", durationMs: 2500 },
  { x: 480, y: 280, placeName: "Corridor 211-210", durationMs: 2000 },
  { x: 500, y: 240, placeName: "Elevator & Stair Lobby", durationMs: 3000 },
  { x: 560, y: 280, placeName: "Corridor 217", durationMs: 2500 },
  { x: 620, y: 280, placeName: "Corridor 218", durationMs: 2500 },
  { x: 680, y: 280, placeName: "Corridor 219", durationMs: 2500 },
  { x: 680, y: 220, placeName: "Room 219 (AI & Research Lab)", durationMs: 3500 }
];

export class ReplayWalkProvider {
  private currentIndex = 0;
  private waypoints: ReplayWaypoint[];

  constructor(waypoints = FLOOR2_DEMO_WALK_WAYPOINTS) {
    this.waypoints = waypoints;
  }

  public getNextEstimate(): PositionEstimate {
    const wp = this.waypoints[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.waypoints.length;

    return {
      x: wp.x,
      y: wp.y,
      floorId: "floor-2",
      confidence: 0.95,
      uncertaintyRadius: 2.0,
      source: "replay",
      quality: "high",
      nearestPlaceName: wp.placeName,
      timestamp: Date.now()
    };
  }

  public reset(): void {
    this.currentIndex = 0;
  }
}
