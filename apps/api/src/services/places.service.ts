import { loadPois } from "../data/loader.js";

export interface SearchResultItem {
  id: string;
  name: string;
  category: string;
  nodeId: string;
  aliases: string[];
  coordinates?: { x: number; y: number };
  matchScore: number;
}

export function searchPlaces(query?: string): SearchResultItem[] {
  const pois = loadPois();
  if (!query || query.trim() === "" || query.trim() === "*") {
    return pois.map((poi) => ({ ...poi, matchScore: 1 }));
  }

  const cleanQuery = query.trim().toLowerCase();
  const results: SearchResultItem[] = [];

  for (const poi of pois) {
    const nameLower = poi.name.toLowerCase();
    const categoryLower = poi.category.toLowerCase();
    const aliasesLower = (poi.aliases || []).map((a) => a.toLowerCase());

    let score = 0;

    // 1. Exact match on name or ID
    if (nameLower === cleanQuery || poi.id.toLowerCase() === cleanQuery || poi.nodeId.toLowerCase() === cleanQuery) {
      score = Math.max(score, 100);
    }

    // 2. Exact match on an alias
    for (const alias of aliasesLower) {
      if (alias === cleanQuery) {
        score = Math.max(score, 95);
      }
    }

    // 3. Name or alias starts with query
    if (nameLower.startsWith(cleanQuery)) {
      score = Math.max(score, 85);
    }
    for (const alias of aliasesLower) {
      if (alias.startsWith(cleanQuery)) {
        score = Math.max(score, 80);
      }
    }

    // 4. Word boundary match
    const words = nameLower.split(/\s+/);
    if (words.some((w) => w.startsWith(cleanQuery))) {
      score = Math.max(score, 75);
    }
    for (const alias of aliasesLower) {
      const aliasWords = alias.split(/\s+/);
      if (aliasWords.some((w) => w.startsWith(cleanQuery))) {
        score = Math.max(score, 70);
      }
    }

    // 5. Substring match
    if (nameLower.includes(cleanQuery)) {
      score = Math.max(score, 60);
    }
    for (const alias of aliasesLower) {
      if (alias.includes(cleanQuery)) {
        score = Math.max(score, 55);
      }
    }

    // 6. Category match
    if (categoryLower.includes(cleanQuery)) {
      score = Math.max(score, 45);
    }

    if (score > 0) {
      results.push({
        ...poi,
        matchScore: score
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}
