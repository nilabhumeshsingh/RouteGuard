import { PositionEstimate, PositionQuality } from "@routeguard/shared";
import { normalizeBssid, parseSignalStrength, computeFingerprintDistance } from "./metrics.js";

export interface SurveyFingerprint {
  location: string;
  x: number;
  y: number;
  floorId: string;
  bssids: Record<string, number>;
}

export function estimatePositionWeightedKnn(
  scan: Array<{ bssid: string; signal: number | string }>,
  fingerprints: SurveyFingerprint[],
  k = 3
): PositionEstimate {
  const queryMap = new Map<string, number>();
  for (const item of scan) {
    const bssid = normalizeBssid(item.bssid);
    queryMap.set(bssid, parseSignalStrength(item.signal));
  }

  if (queryMap.size === 0 || fingerprints.length === 0) {
    return {
      x: 0,
      y: 0,
      floorId: "floor-2",
      confidence: 0,
      uncertaintyRadius: 50,
      source: "wifi",
      quality: "stale",
      timestamp: Date.now()
    };
  }

  // Score against all fingerprints
  const candidates: Array<{
    fp: SurveyFingerprint;
    similarity: number;
    distance: number;
    sharedAps: number;
  }> = [];

  for (const fp of fingerprints) {
    const refMap = new Map<string, number>();
    for (const [bssid, val] of Object.entries(fp.bssids)) {
      refMap.set(normalizeBssid(bssid), parseSignalStrength(val));
    }

    const { similarity, distance, sharedAps } = computeFingerprintDistance(queryMap, refMap);
    if (sharedAps > 0) {
      candidates.push({ fp, similarity, distance, sharedAps });
    }
  }

  // Sort by lowest distance (highest similarity)
  candidates.sort((a, b) => a.distance - b.distance);

  const topK = candidates.slice(0, Math.max(1, k));

  if (topK.length === 0) {
    return {
      x: 0,
      y: 0,
      floorId: "floor-2",
      confidence: 0,
      uncertaintyRadius: 50,
      source: "wifi",
      quality: "stale",
      timestamp: Date.now()
    };
  }

  // Inverse distance weights
  let sumWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let maxSimilarity = 0;
  let maxSharedAps = 0;

  for (const cand of topK) {
    const weight = Math.pow(cand.similarity, 2) / (cand.distance + 0.001);
    sumWeight += weight;
    weightedX += cand.fp.x * weight;
    weightedY += cand.fp.y * weight;

    if (cand.similarity > maxSimilarity) maxSimilarity = cand.similarity;
    if (cand.sharedAps > maxSharedAps) maxSharedAps = cand.sharedAps;
  }

  const estX = Math.round((weightedX / sumWeight) * 10) / 10;
  const estY = Math.round((weightedY / sumWeight) * 10) / 10;

  // Determine quality and confidence
  let quality: PositionQuality = "low";
  let uncertaintyRadius = 15;

  if (maxSimilarity >= 0.8 && maxSharedAps >= 3) {
    quality = "high";
    uncertaintyRadius = 3.5;
  } else if (maxSimilarity >= 0.55 && maxSharedAps >= 2) {
    quality = "medium";
    uncertaintyRadius = 8.0;
  }

  return {
    x: estX,
    y: estY,
    floorId: topK[0].fp.floorId,
    confidence: Math.round(maxSimilarity * 100) / 100,
    uncertaintyRadius,
    source: "wifi",
    quality,
    nearestPlaceName: topK[0].fp.location,
    timestamp: Date.now()
  };
}
