import fs from "node:fs";
import path from "node:path";
import { CampusGraph, GraphNode, GraphEdge } from "@routeguard/graph";
import { config } from "../config.js";

import defaultGraphData from "./sample/floor2-graph.json" with { type: "json" };
import defaultPoisData from "./sample/pois.json" with { type: "json" };
import defaultFingerprintsData from "./sample/floor2-fingerprints.json" with { type: "json" };

export interface FloorGraphData {
  floorId: string;
  name: string;
  dimensions: { width: number; height: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PoiData {
  id: string;
  name: string;
  category: string;
  nodeId: string;
  aliases: string[];
  coordinates?: { x: number; y: number };
}

export interface FingerprintData {
  location: string;
  x: number;
  y: number;
  floorId: string;
  bssids: Record<string, number>;
  apCount?: number;
}

let cachedGraphData: FloorGraphData | null = null;
let cachedCampusGraph: CampusGraph | null = null;
let cachedPois: PoiData[] | null = null;
let cachedFingerprints: FingerprintData[] | null = null;

function resolveDataPath(filename: string): string | null {
  const candidates = [
    path.join(config.dataDir, filename),
    path.resolve(process.cwd(), "data/sample", filename),
    path.resolve(process.cwd(), "../../data/sample", filename),
    path.resolve(process.cwd(), "apps/api/src/data/sample", filename)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function loadFloor2Graph(): FloorGraphData {
  if (cachedGraphData) {
    return cachedGraphData;
  }
  const filePath = resolveDataPath("floor2-graph.json");
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedGraphData = JSON.parse(raw) as FloorGraphData;
      return cachedGraphData;
    } catch {
      // fallback to bundled JSON
    }
  }
  cachedGraphData = defaultGraphData as FloorGraphData;
  return cachedGraphData;
}

export function getCampusGraph(): CampusGraph {
  if (cachedCampusGraph) {
    return cachedCampusGraph;
  }
  const data = loadFloor2Graph();
  const graph = new CampusGraph();

  for (const node of data.nodes) {
    graph.addNode({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      floorId: node.floorId || data.floorId || "floor-2",
      isExit: node.isExit ?? false,
      isRefuge: node.isRefuge ?? false,
      isStepFree: node.isStepFree ?? true
    });
  }

  for (const edge of data.edges) {
    graph.addEdge(
      {
        from: edge.from,
        to: edge.to,
        distance: edge.distance,
        type: edge.type,
        isStepFree: edge.isStepFree ?? true,
        lighting: edge.lighting || "well_lit",
        crowd: edge.crowd || "low",
        isBlocked: edge.isBlocked ?? false
      },
      true // bidirectional corridors and paths
    );
  }

  cachedCampusGraph = graph;
  return cachedCampusGraph;
}

export function loadPois(): PoiData[] {
  if (cachedPois) {
    return cachedPois;
  }
  let pois: PoiData[] = defaultPoisData as PoiData[];
  const filePath = resolveDataPath("pois.json");
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      pois = JSON.parse(raw) as PoiData[];
    } catch {
      // use bundled defaultPoisData
    }
  }

  // Augment POIs with coordinates from graph nodes
  const graph = loadFloor2Graph();
  const nodeMap = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const poi of pois) {
    const node = nodeMap.get(poi.nodeId);
    if (node) {
      poi.coordinates = { x: node.x, y: node.y };
    }
  }

  cachedPois = pois;
  return cachedPois;
}

export function loadSampleFingerprints(): FingerprintData[] {
  if (cachedFingerprints) {
    return cachedFingerprints;
  }
  const filePath = resolveDataPath("floor2-fingerprints.json");
  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedFingerprints = JSON.parse(raw) as FingerprintData[];
      return cachedFingerprints;
    } catch {
      // use bundled defaultFingerprintsData
    }
  }
  cachedFingerprints = defaultFingerprintsData as unknown as FingerprintData[];
  return cachedFingerprints;
}
