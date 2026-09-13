import type { MapEdge, MapNode, WorldMap } from "../types/map";
import { edgesForNode, isConnected, unreachableFrom, usedDirections } from "./graph";

export interface Violation {
  rule: string;
  detail: string;
  nodeId?: string;
  edgeId?: string;
}

function findDuplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const dupes = new Set<T>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    else seen.add(v);
  }
  return [...dupes];
}

// Invariant 1: no node has two outgoing (fromId) edges with the same direction.
function checkOneDirectionPerNode(nodes: MapNode[], edges: MapEdge[]): Violation[] {
  const violations: Violation[] = [];
  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.fromId === node.id).map((e) => e.direction);
    for (const dir of findDuplicates(outgoing)) {
      violations.push({
        rule: "one-direction-per-node",
        detail: `Node "${node.label}" has more than one outgoing edge heading ${dir}.`,
        nodeId: node.id,
      });
    }
  }
  return violations;
}

// Invariant 2: only one edge between any two nodes (undirected check).
function checkNoDuplicatePairs(edges: MapEdge[]): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const key = [edge.fromId, edge.toId].sort().join("|");
    if (seen.has(key)) {
      violations.push({
        rule: "no-duplicate-pairs",
        detail: `More than one edge connects the same pair of nodes.`,
        edgeId: edge.id,
      });
    } else {
      seen.add(key);
    }
  }
  return violations;
}

// Invariant 3: every node reachable from every other node.
function checkFullyConnected(nodes: MapNode[], edges: MapEdge[]): Violation[] {
  if (nodes.length === 0 || isConnected(nodes, edges)) return [];
  const unreachable = unreachableFrom(nodes[0].id, nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return unreachable.map((nodeId) => ({
    rule: "fully-connected",
    detail: `Node "${byId.get(nodeId)?.label ?? nodeId}" is unreachable from the rest of the map.`,
    nodeId,
  }));
}

// Invariant 4: no mountain node has gx and gy both in the inner 40% of the grid.
function checkMountainPlacement(nodes: MapNode[], gridCols: number, gridRows: number): Violation[] {
  const violations: Violation[] = [];
  for (const node of nodes) {
    if (node.type !== "mountain") continue;
    const fx = gridCols <= 1 ? 0.5 : node.gx / (gridCols - 1);
    const fy = gridRows <= 1 ? 0.5 : node.gy / (gridRows - 1);
    const inInner40 = fx >= 0.3 && fx <= 0.7 && fy >= 0.3 && fy <= 0.7;
    if (inInner40) {
      violations.push({
        rule: "mountain-placement",
        detail: `Mountain node "${node.label}" sits in the inner 40% of the grid.`,
        nodeId: node.id,
      });
    }
  }
  return violations;
}

// Invariant 5: every node has at least 2 edges (either direction counts).
function checkMinimumExits(nodes: MapNode[], edges: MapEdge[]): Violation[] {
  const violations: Violation[] = [];
  for (const node of nodes) {
    const count = edgesForNode(node.id, edges).length;
    if (count < 2) {
      violations.push({
        rule: "minimum-exits",
        detail: `Node "${node.label}" has only ${count} exit(s); at least 2 are required.`,
        nodeId: node.id,
      });
    }
  }
  return violations;
}

// Invariant 6: every node has at least one edge where checkRequired = false.
function checkNoStrandedCheckRequired(nodes: MapNode[], edges: MapEdge[]): Violation[] {
  const violations: Violation[] = [];
  for (const node of nodes) {
    const nodeEdges = edgesForNode(node.id, edges);
    if (nodeEdges.length > 0 && nodeEdges.every((e) => e.checkRequired)) {
      violations.push({
        rule: "no-stranded-check-required",
        detail: `Node "${node.label}" has no exit that is free of a skill check.`,
        nodeId: node.id,
      });
    }
  }
  return violations;
}

// Invariant 7 (warn only): if edge A→B has direction N, no other edge from B
// should have direction S — that mixes an explicit outgoing edge with the
// direction implied by an incoming one, and would overlap visually.
function checkDirectionSymmetry(nodes: MapNode[], edges: MapEdge[]): Violation[] {
  const violations: Violation[] = [];
  for (const node of nodes) {
    const outgoingOnly = edges.filter((e) => e.fromId === node.id).map((e) => e.direction);
    const outgoingDupes = new Set(findDuplicates(outgoingOnly));
    const allUsed = usedDirections(node.id, edges);
    for (const dir of findDuplicates(allUsed)) {
      if (outgoingDupes.has(dir)) continue; // already reported by invariant 1
      violations.push({
        rule: "direction-symmetry",
        detail: `Node "${node.label}" has two connections that both resolve to ${dir} from its perspective.`,
        nodeId: node.id,
      });
    }
  }
  return violations;
}

export function validateMap(map: WorldMap): Violation[] {
  return [
    ...checkOneDirectionPerNode(map.nodes, map.edges),
    ...checkNoDuplicatePairs(map.edges),
    ...checkFullyConnected(map.nodes, map.edges),
    ...checkMountainPlacement(map.nodes, map.params.gridCols, map.params.gridRows),
    ...checkMinimumExits(map.nodes, map.edges),
    ...checkNoStrandedCheckRequired(map.nodes, map.edges),
    ...checkDirectionSymmetry(map.nodes, map.edges),
  ];
}
