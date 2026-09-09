export interface Fingerprint {
  x: number;
  y: number;
  label: string;
  type?: string;
  visible?: boolean;
  aps: { bssid: string; rssi: number }[];
}

export interface APReading {
  bssid: string;
  rssi: number;
  ssid?: string;
  freq?: number;
  channel?: number;
}

export interface PositionEstimate {
  x: number;
  y: number;
  confidence: number;
  source: 'wifi' | 'manual' | 'replay' | 'no_fingerprints';
  label?: string;
  type?: string;
  visible?: boolean;
  anchorsUsed: number;
  uncertaintyMeters?: number;
}

const K = 5;
const MIN_ANCHOR_OVERLAP = 2;

function rssiDistance(scanAps: APReading[], fpAps: { bssid: string; rssi: number }[]): number {
  let totalSq = 0;
  let overlap = 0;
  const fpMap = new Map((fpAps || []).map(a => [a.bssid?.toUpperCase(), a.rssi]));

  for (const ap of scanAps) {
    const fpRssi = fpMap.get(ap.bssid?.toUpperCase());
    if (fpRssi !== undefined) {
      const diff = ap.rssi - fpRssi;
      totalSq += diff * diff;
      overlap++;
    }
  }

  if (overlap < MIN_ANCHOR_OVERLAP) return Infinity;
  const penalty = Math.max(0, (5 - overlap)) * 50;
  return Math.sqrt(totalSq / overlap) + penalty;
}

// Computes k-NN position against dynamic fingerprints loaded from MongoDB Atlas
export function runKNN(scanAps: APReading[], fingerprints: Fingerprint[]): PositionEstimate | null {
  if (!scanAps || scanAps.length === 0) return null;
  if (!fingerprints || fingerprints.length === 0) return null;

  const distances = fingerprints
    .map(fp => ({
      fp,
      dist: rssiDistance(scanAps, fp.aps || [])
    }))
    .filter(d => d.dist < Infinity)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, K);

  if (distances.length === 0) {
    return {
      x: 0,
      y: 0,
      confidence: 0,
      source: 'wifi',
      anchorsUsed: 0,
      uncertaintyMeters: 50
    };
  }

  // Spatial consensus: prune candidates farther than 6.5m from top match
  const bestX = distances[0].fp.x;
  const bestY = distances[0].fp.y;
  const cluster = distances.filter(d => {
    const dx = d.fp.x - bestX;
    const dy = d.fp.y - bestY;
    return Math.sqrt(dx * dx + dy * dy) <= 6.5;
  });

  const effective = cluster.length > 0 ? cluster : distances.slice(0, 3);

  const epsilon = 0.1;
  let totalWeight = 0;
  let xSum = 0, ySum = 0;

  for (const d of effective) {
    const w = 1 / ((d.dist + epsilon) * (d.dist + epsilon));
    xSum += d.fp.x * w;
    ySum += d.fp.y * w;
    totalWeight += w;
  }

  const x = Number((xSum / totalWeight).toFixed(2));
  const y = Number((ySum / totalWeight).toFixed(2));

  const bestOverlap = scanAps.filter(ap =>
    (distances[0].fp.aps || []).some(fpAp => fpAp.bssid?.toUpperCase() === ap.bssid?.toUpperCase())
  ).length;
  const confidence = Number(Math.min(1, bestOverlap / 5).toFixed(2));

  const xs = effective.map(d => d.fp.x);
  const ys = effective.map(d => d.fp.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  const uncertainty = Number((Math.max(xRange, yRange) / 2).toFixed(2));

  return {
    x,
    y,
    confidence,
    source: 'wifi',
    label: distances[0].fp.label,
    type: distances[0].fp.type,
    visible: distances[0].fp.visible,
    anchorsUsed: bestOverlap,
    uncertaintyMeters: uncertainty
  };
}
