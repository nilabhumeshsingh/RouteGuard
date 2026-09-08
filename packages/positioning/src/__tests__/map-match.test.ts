import { describe, it, expect } from "vitest";
import { snapToNearestCorridor, ReplayWalkProvider } from "../index.js";

describe("Map-Matching and Replay Walk Engine", () => {
  it("snaps a point slightly off-corridor to the centerline", () => {
    const corridors = [
      { from: { x: 100, y: 280 }, to: { x: 500, y: 280 } }
    ];

    const rawEstimate = { x: 250, y: 288 }; // 8px off centerline
    const snapped = snapToNearestCorridor(rawEstimate, corridors, 20);

    expect(snapped.x).toBe(250);
    expect(snapped.y).toBe(280);
  });

  it("advances through synthetic replay walk waypoints", () => {
    const provider = new ReplayWalkProvider();
    const first = provider.getNextEstimate();
    const second = provider.getNextEstimate();

    expect(first.nearestPlaceName).toBe("AB1 Room 204");
    expect(second.nearestPlaceName).toBe("Corridor West");
    expect(first.source).toBe("replay");
  });
});
