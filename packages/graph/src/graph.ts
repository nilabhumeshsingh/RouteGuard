import { EdgeType, LightingStatus, FootfallDensity } from "@routeguard/shared";

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  floorId: string;
  isExit?: boolean;
  isRefuge?: boolean;
  isStepFree?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  distance: number;
  type: EdgeType;
  isStepFree: boolean;
  lighting: LightingStatus;
  crowd: FootfallDensity;
  isBlocked?: boolean;
}

export class CampusGraph {
  public nodes: Map<string, GraphNode> = new Map();
  public adjacency: Map<string, GraphEdge[]> = new Map();

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  public addEdge(edge: GraphEdge, bidirectional = true): void {
    if (!this.adjacency.has(edge.from)) {
      this.adjacency.set(edge.from, []);
    }
    this.adjacency.get(edge.from)!.push(edge);

    if (bidirectional) {
      if (!this.adjacency.has(edge.to)) {
        this.adjacency.set(edge.to, []);
      }
      this.adjacency.get(edge.to)!.push({
        ...edge,
        from: edge.to,
        to: edge.from
      });
    }
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.adjacency.get(nodeId) || [];
  }

  public static fromJson(data: { nodes: any[]; edges: any[]; floorId?: string }): CampusGraph {
    const graph = new CampusGraph();
    const floorId = data.floorId || "floor-2";

    for (const n of data.nodes) {
      graph.addNode({
        id: n.id,
        label: n.label || n.id,
        x: n.x,
        y: n.y,
        floorId: n.floorId || floorId,
        isExit: n.isExit || false,
        isRefuge: n.isRefuge || false,
        isStepFree: n.isStepFree !== false
      });
    }

    for (const e of data.edges) {
      graph.addEdge({
        from: e.from,
        to: e.to,
        distance: e.distance || 5,
        type: e.type || "corridor",
        isStepFree: e.isStepFree !== false,
        lighting: e.lighting || "well_lit",
        crowd: e.crowd || "low",
        isBlocked: e.isBlocked || false
      });
    }

    return graph;
  }
}
