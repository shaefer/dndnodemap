import type { CompassDir, MapEdge, MapNode } from "../types/map";
import { ALL_DIRS, oppositeDir } from "./compass";

// Edges are undirected for reachability purposes — `direction` only labels
// fromId's compass heading, but travel is possible both ways along an edge.
function buildAdjacency(edges: MapEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const addLink = (from: string, to: string) => {
    const neighbors = adjacency.get(from);
    if (neighbors) neighbors.push(to);
    else adjacency.set(from, [to]);
  };
  for (const edge of edges) {
    addLink(edge.fromId, edge.toId);
    addLink(edge.toId, edge.fromId);
  }
  return adjacency;
}

function bfsDistances(startId: string, adjacency: Map<string, string[]>): Map<string, number> {
  const distances = new Map<string, number>([[startId, 0]]);
  const queue: string[] = [startId];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = distances.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

// Returns true if all nodes are reachable from any start node
export function isConnected(nodes: MapNode[], edges: MapEdge[]): boolean {
  if (nodes.length <= 1) return true;
  const adjacency = buildAdjacency(edges);
  const distances = bfsDistances(nodes[0].id, adjacency);
  return nodes.every((node) => distances.has(node.id));
}

// Returns array of node ids unreachable from startId
export function unreachableFrom(
  startId: string,
  nodes: MapNode[],
  edges: MapEdge[]
): string[] {
  const adjacency = buildAdjacency(edges);
  const distances = bfsDistances(startId, adjacency);
  return nodes
    .map((node) => node.id)
    .filter((id) => !distances.has(id));
}

// Returns the shortest hop count between two nodes (-1 if not connected)
export function hopCount(
  fromId: string,
  toId: string,
  edges: MapEdge[]
): number {
  if (fromId === toId) return 0;
  const adjacency = buildAdjacency(edges);
  const distances = bfsDistances(fromId, adjacency);
  return distances.get(toId) ?? -1;
}

// Returns the farthest hop count reachable from a given node
export function maxHopsFrom(nodeId: string, edges: MapEdge[]): number {
  const adjacency = buildAdjacency(edges);
  const distances = bfsDistances(nodeId, adjacency);
  let max = 0;
  for (const dist of distances.values()) {
    if (dist > max) max = dist;
  }
  return max;
}

// Returns all edges connected to a node (in either direction)
export function edgesForNode(nodeId: string, edges: MapEdge[]): MapEdge[] {
  return edges.filter((edge) => edge.fromId === nodeId || edge.toId === nodeId);
}

// Returns all directions already used from a node (outgoing only).
// `direction` is stored from fromId's perspective, so an edge where this
// node is toId contributes the opposite direction instead.
export function usedDirections(nodeId: string, edges: MapEdge[]): CompassDir[] {
  const dirs: CompassDir[] = [];
  for (const edge of edges) {
    if (edge.fromId === nodeId) dirs.push(edge.direction);
    else if (edge.toId === nodeId) dirs.push(oppositeDir(edge.direction));
  }
  return dirs;
}

// Returns which CompassDirs are still free from a node
export function freeDirections(nodeId: string, edges: MapEdge[]): CompassDir[] {
  const used = new Set(usedDirections(nodeId, edges));
  return ALL_DIRS.filter((dir) => !used.has(dir));
}
