import { describe, it, expect } from "vitest";
import { cosineSimilarity, estimatePositionWeightedKnn } from "../index.js";
import fingerprints from "../../../../data/sample/floor2-fingerprints.json";

describe("Weighted k-NN Positioning Engine & Cosine Metrics", () => {
  it("calculates exact 1.0 cosine similarity for identical vectors", () => {
    const vecA = new Map([["AP1", 0.9], ["AP2", 0.8], ["AP3", 0.7]]);
    const sim = cosineSimilarity(vecA, vecA);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it("calculates 0.0 cosine similarity for disjoint vectors", () => {
    const vecA = new Map([["AP1", 0.9]]);
    const vecB = new Map([["AP2", 0.9]]);
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBe(0);
  });

  it("accurately locates Room 204 from genuine survey scan", () => {
    const scan = [
      { bssid: "90:14:AF:5F:B1:10", signal: 77 },
      { bssid: "FC:11:65:DF:CB:F0", signal: 100 },
      { bssid: "FC:11:65:DF:CC:00", signal: 92 }
    ];

    const estimate = estimatePositionWeightedKnn(scan, fingerprints as any, 3);
    expect(estimate.nearestPlaceName).toBe("AB1 Room 204");
    expect(Math.abs(estimate.x - 120)).toBeLessThan(5);
    expect(Math.abs(estimate.y - 220)).toBeLessThan(5);
    expect(estimate.quality).toBe("high");
    expect(estimate.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("degrades gracefully to low quality when only 1 weak AP is visible", () => {
    const weakScan = [
      { bssid: "FC:11:65:DF:CC:00", signal: 20 }
    ];

    const estimate = estimatePositionWeightedKnn(weakScan, fingerprints as any, 3);
    expect(estimate.quality).toBe("low");
    expect(estimate.uncertaintyRadius).toBeGreaterThanOrEqual(10);
  });

  it("returns stale state when no known APs are detected", () => {
    const alienScan = [
      { bssid: "AA:BB:CC:DD:EE:FF", signal: 90 }
    ];

    const estimate = estimatePositionWeightedKnn(alienScan, fingerprints as any, 3);
    expect(estimate.quality).toBe("stale");
    expect(estimate.confidence).toBe(0);
  });
});
