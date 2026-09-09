import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runKNN, Fingerprint } from "../services/positioning/knn.js";

describe("Canonical locations.json and KNN Corridor Waypoints", () => {
  const locationsPath = path.resolve(__dirname, "../data/locations.json");
  const raw = fs.readFileSync(locationsPath, "utf-8");
  const data = JSON.parse(raw);
  const locations = data.locations;

  it("loads all 44 survey locations with correct metadata", () => {
    expect(Object.keys(locations).length).toBe(44);
    expect(data.stats.total_locations).toBe(44);
    expect(data.stats.visible_rooms).toBe(25);
    expect(data.stats.invisible_corridors).toBe(19);
  });

  it("has mathematically correct midpoint for BETWEEN 212-209", () => {
    const loc = locations["BETWEEN 212-209"];
    expect(loc).toBeDefined();
    expect(loc.x).toBe(7.25);
    expect(loc.y).toBe(0.00);
    expect(loc.type).toBe("corridor");
    expect(loc.visible).toBe(false);

    const locB = locations["BETWEEN 212-209 B"];
    expect(locB).toBeDefined();
    expect(locB.x).toBe(7.25);
    expect(locB.y).toBe(-1.50);
    expect(locB.type).toBe("corridor");
    expect(locB.visible).toBe(false);
  });

  it("returns type and visible for office room match in runKNN", () => {
    const mockFingerprints: Fingerprint[] = [
      {
        x: 1.75,
        y: 7.25,
        label: "Room 204",
        type: "office",
        visible: true,
        aps: [
          { bssid: "90:14:AF:5F:B1:10", rssi: -61 },
          { bssid: "FC:11:65:DF:CB:F0", rssi: -50 }
        ]
      },
      {
        x: 7.25,
        y: 0.00,
        label: "Corridor 212-209",
        type: "corridor",
        visible: false,
        aps: [
          { bssid: "AA:BB:CC:11:22:33", rssi: -45 },
          { bssid: "AA:BB:CC:44:55:66", rssi: -55 }
        ]
      }
    ];

    const scan = [
      { bssid: "90:14:AF:5F:B1:10", rssi: -60 },
      { bssid: "FC:11:65:DF:CB:F0", rssi: -52 }
    ];

    const estimate = runKNN(scan, mockFingerprints);
    expect(estimate).not.toBeNull();
    expect(estimate?.label).toBe("Room 204");
    expect(estimate?.type).toBe("office");
    expect(estimate?.visible).toBe(true);
    expect(estimate?.x).toBeCloseTo(1.75, 1);
    expect(estimate?.y).toBeCloseTo(7.25, 1);
  });

  it("returns type and visible:false when matching invisible corridor waypoint", () => {
    const mockFingerprints: Fingerprint[] = [
      {
        x: 1.75,
        y: 7.25,
        label: "Room 204",
        type: "office",
        visible: true,
        aps: [
          { bssid: "90:14:AF:5F:B1:10", rssi: -61 },
          { bssid: "FC:11:65:DF:CB:F0", rssi: -50 }
        ]
      },
      {
        x: 7.25,
        y: 0.00,
        label: "Corridor 212-209",
        type: "corridor",
        visible: false,
        aps: [
          { bssid: "AA:BB:CC:11:22:33", rssi: -45 },
          { bssid: "AA:BB:CC:44:55:66", rssi: -55 }
        ]
      }
    ];

    const corridorScan = [
      { bssid: "AA:BB:CC:11:22:33", rssi: -44 },
      { bssid: "AA:BB:CC:44:55:66", rssi: -56 }
    ];

    const estimate = runKNN(corridorScan, mockFingerprints);
    expect(estimate).not.toBeNull();
    expect(estimate?.label).toBe("Corridor 212-209");
    expect(estimate?.type).toBe("corridor");
    expect(estimate?.visible).toBe(false);
    expect(estimate?.x).toBeCloseTo(7.25, 1);
    expect(estimate?.y).toBeCloseTo(0.00, 1);
  });
});
