export function normalizeBssid(bssid: string): string {
  return bssid.trim().toUpperCase().replace(/\\/g, "");
}

export function parseSignalStrength(val: number | string): number {
  if (typeof val === "number") {
    if (val > 1) return Math.min(1, Math.max(0, val / 100));
    return Math.min(1, Math.max(0, val));
  }
  const clean = val.replace("%", "").trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0.5;
  return Math.min(1, Math.max(0, num / 100));
}

export function cosineSimilarity(
  query: Map<string, number>,
  reference: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [, val] of query) {
    normA += val * val;
  }
  for (const [, val] of reference) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;

  for (const [bssid, qVal] of query) {
    const rVal = reference.get(bssid);
    if (rVal !== undefined) {
      dotProduct += qVal * rVal;
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function computeFingerprintDistance(
  query: Map<string, number>,
  reference: Map<string, number>
): { similarity: number; distance: number; sharedAps: number } {
  let sharedAps = 0;
  for (const [bssid] of query) {
    if (reference.has(bssid)) {
      sharedAps++;
    }
  }

  const similarity = cosineSimilarity(query, reference);
  const totalUnique = new Set([...query.keys(), ...reference.keys()]).size;
  const overlapRatio = totalUnique > 0 ? sharedAps / totalUnique : 0;

  // Hybrid distance: Cosine dissimilarity weighted by AP overlap penalty
  const distance = (1 - similarity) + (1 - overlapRatio) * 0.5;

  return { similarity, distance, sharedAps };
}
