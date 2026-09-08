import { RouteResult } from "@routeguard/shared";

export function generateTradeOffExplanation(
  recommended: RouteResult,
  shortest: RouteResult,
  stepFree?: RouteResult
): string {
  if (recommended.status !== "found" || shortest.status !== "found") {
    return "Direct route unavailable.";
  }

  const timeDiffSec = recommended.estimatedTimeSeconds - shortest.estimatedTimeSeconds;
  const distDiffMeters = Math.round(recommended.totalDistanceMeters - shortest.totalDistanceMeters);

  if (timeDiffSec <= 5 && distDiffMeters <= 5) {
    return "Fastest and safest path along well-lit main corridors.";
  }

  const mins = Math.max(1, Math.round(timeDiffSec / 60));
  const minText = mins === 1 ? "1 min" : `${mins} mins`;

  return `Adds ~${minText} (+${distDiffMeters}m) to stay on well-lit, staffed corridors and avoid unlit areas.`;
}
