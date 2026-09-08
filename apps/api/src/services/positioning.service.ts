import {
  estimatePositionWeightedKnn,
  snapToNearestCorridor,
  SurveyFingerprint
} from "@routeguard/positioning";
import { PositionEstimate, WifiScanItem } from "@routeguard/shared";
import { getFingerprints } from "../db.js";
import { getCorridorSegments } from "./campus.service.js";
import { loadFloor2Graph } from "../data/loader.js";

export interface EstimateOptions {
  k?: number;
  snapToCorridor?: boolean;
  maxSnapDistance?: number;
}

export interface DetailedPositionEstimate extends PositionEstimate {
  rawX: number;
  rawY: number;
  snapped: boolean;
  nearestNodeId?: string;
}

export async function estimateLocation(
  scanItems: WifiScanItem[],
  options: EstimateOptions = {}
): Promise<DetailedPositionEstimate> {
  const k = options.k ?? 3;
  const shouldSnap = options.snapToCorridor ?? true;
  const maxSnapDistance = options.maxSnapDistance ?? 40;

  // Retrieve survey fingerprints from MongoDB (or cached sample)
  const fingerprints: SurveyFingerprint[] = await getFingerprints();

  // Run weighted k-NN + Cosine estimator
  const rawEstimate = estimatePositionWeightedKnn(
    scanItems.map((item) => ({ bssid: item.bssid, signal: item.signal })),
    fingerprints,
    k
  );

  let finalX = rawEstimate.x;
  let finalY = rawEstimate.y;
  let wasSnapped = false;

  if (shouldSnap && (rawEstimate.x !== 0 || rawEstimate.y !== 0)) {
    const corridors = getCorridorSegments();
    const snappedPoint = snapToNearestCorridor(
      { x: rawEstimate.x, y: rawEstimate.y },
      corridors,
      maxSnapDistance
    );

    if (snappedPoint.x !== rawEstimate.x || snappedPoint.y !== rawEstimate.y) {
      finalX = Math.round(snappedPoint.x * 10) / 10;
      finalY = Math.round(snappedPoint.y * 10) / 10;
      wasSnapped = true;
    }
  }

  // Find nearest graph node to provide nodeId reference
  const graph = loadFloor2Graph();
  let nearestNodeId: string | undefined;
  let minNodeDist = Infinity;

  for (const node of graph.nodes) {
    const d = Math.hypot(node.x - finalX, node.y - finalY);
    if (d < minNodeDist) {
      minNodeDist = d;
      nearestNodeId = node.id;
    }
  }

  return {
    ...rawEstimate,
    x: finalX,
    y: finalY,
    rawX: rawEstimate.x,
    rawY: rawEstimate.y,
    snapped: wasSnapped,
    nearestNodeId,
    timestamp: Date.now()
  };
}
