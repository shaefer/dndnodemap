// Geometry-agnostic helpers shared by both placement algorithms
// (core/generator.ts's "grid" scan and core/radialGenerator.ts's "spoke"
// walk). Placement geometry differs completely between the two — this
// module holds only the parts that don't care about geometry at all: Tier
// 1.5/Tier 2 classification, connection-type inference, direction/degree
// bookkeeping, and the connectivity-repair safety net. Neither generator.ts
// nor radialGenerator.ts should duplicate any of this; generator.ts imports
// it for its own "grid" path exactly the same way radialGenerator.ts does,
// so behavior here can never quietly drift between the two algorithms.
//
// Dependency direction: generator.ts -> radialGenerator.ts -> here, and
// generator.ts -> here directly too. Never the reverse — this module must
// stay algorithm-agnostic and must never import from either generator file.

import type {
  Biome,
  BoundaryMarker,
  BoundaryReason,
  CivilianScale,
  CompassDir,
  ConnectionType,
  GenerationParams,
  MapEdge,
  MapNode,
  NodeSubtype,
  NodeType,
  OutpostKind,
  PoiKind,
  WaterFeature,
} from "../types/map";
import { ALL_DIRS, dirBetween, oppositeDir } from "./compass";
import { freeDirections } from "./graph";
import { randPick, type RngFn } from "./rng";
import { isWaterBranch } from "./taxonomy";

// "center" / "mid" / "edge" — a coarse zone a node's position falls into,
// used only to gate BoundaryMarker probability (spec Section 7). Each
// placement algorithm computes this from its own geometry (grid: rectangular
// col/row banding; radial: radius fraction from the core) and passes the
// result into classifyNode below, which doesn't know or care which.
export type Zone = "center" | "mid" | "edge";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Sequential per-subtype labels ("Village-1", "Forest-3", ...) — a fresh
// counter per generateMap() call, shared across however many nodes get
// created (including any created after the fact, e.g. a dead-end retyped to
// poi keeps counting from wherever its new subtype's counter already is).
export function createLabelGenerator(): (key: string) => string {
  const counters: Record<string, number> = {};
  return (key: string) => {
    counters[key] = (counters[key] ?? 0) + 1;
    return `${capitalize(key)}-${counters[key]}`;
  };
}

export const BIOME_VALUES: Biome[] = ["forest", "swamp", "plains", "desert", "tundra", "jungle"];
export const WATER_FEATURE_VALUES: WaterFeature[] = ["pond", "lake", "river_crossing", "hot_spring", "waterfall", "delta"];
export const OUTPOST_KIND_VALUES: OutpostKind[] = ["monastery", "military_fort", "trading_post", "mining_camp", "waystation"];
export const POI_KIND_VALUES: PoiKind[] = ["ruin", "dungeon", "lair", "landmark"];
export const BOUNDARY_REASONS: BoundaryReason[] = ["coastline", "mountain_range", "canyon_void", "magical_barrier"];

// Civilian settlements skew toward village/town — city and especially
// metropolis should be rare regardless of targetNodeCount, so a hard cap
// (params.maxLargeSettlements, formerly a hardcoded 2) backs up the
// weighting rather than relying on probability alone.
const CIVILIAN_SCALE_WEIGHTS: Record<CivilianScale, number> = { village: 45, town: 35, city: 15, metropolis: 5 };

export function pickCivilianScale(rng: RngFn, cityOrAboveCount: number, maxLargeSettlements: number): CivilianScale {
  const allowCityOrAbove = cityOrAboveCount < maxLargeSettlements;
  const pool: CivilianScale[] = allowCityOrAbove ? ["village", "town", "city", "metropolis"] : ["village", "town"];
  const weights = pool.map((s) => CIVILIAN_SCALE_WEIGHTS[s]);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Weighted pick against params.biomeMix (spec Section 7c) — replaces a flat
// uniform pick so a generated map can read as regionally coherent. The
// generator has no concept of "region presets"; it only ever reads whatever
// weights are in biomeMix, exactly like every other param.
export function pickBiome(rng: RngFn, biomeMix: GenerationParams["biomeMix"]): Biome {
  const weights = BIOME_VALUES.map((b) => biomeMix[b]);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return BIOME_VALUES[0];
  let roll = rng() * total;
  for (let i = 0; i < BIOME_VALUES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return BIOME_VALUES[i];
  }
  return BIOME_VALUES[BIOME_VALUES.length - 1];
}

// Weighted pick against params.nodeTypeBias directly (vs. the exact-budget
// "shuffled bag" both placement algorithms use for their primary/planned
// node counts) — for nodes created in numbers that aren't known in advance,
// e.g. a radial branch/cluster node rolled probabilistically mid-walk.
export function pickNodeTypeWeighted(rng: RngFn, bias: GenerationParams["nodeTypeBias"]): NodeType {
  const total = bias.settlement + bias.wilderness + bias.poi;
  if (total <= 0) return "wilderness";
  let roll = rng() * total;
  roll -= bias.settlement;
  if (roll <= 0) return "settlement";
  roll -= bias.wilderness;
  if (roll <= 0) return "wilderness";
  return "poi";
}

export interface NodeClassification {
  subtype: NodeSubtype;
  boundary?: BoundaryMarker;
  coastal: boolean;
}

// Tier 1.5 fork + Tier 2 subtype + boundary marker + coastal flag — the
// entire "what flavor is this node" decision, independent of where it sits
// geometrically. `zone` and `zoneAllowsMidBoundary` are the only geometry
// inputs; each placement algorithm computes them from its own coordinate
// system (grid: rectangular banding + a 2D safety-margin check; radial:
// radius fraction, where the fraction thresholds themselves already carry
// enough margin that no separate check is needed — always pass `true`).
// `civilianState` is a shared mutable counter (params.maxLargeSettlements
// must apply across an entire generation run, not per-algorithm).
export function classifyNode(
  type: NodeType,
  zone: Zone,
  zoneAllowsMidBoundary: boolean,
  params: GenerationParams,
  rng: RngFn,
  civilianState: { cityOrAboveCount: number }
): NodeClassification {
  let subtype: NodeSubtype;
  if (type === "wilderness") {
    if (rng() < params.wildernessWaterFraction) {
      subtype = randPick(rng, WATER_FEATURE_VALUES);
    } else {
      subtype = pickBiome(rng, params.biomeMix);
    }
  } else if (type === "settlement") {
    if (rng() < params.settlementOutpostFraction) {
      subtype = randPick(rng, OUTPOST_KIND_VALUES);
    } else {
      subtype = pickCivilianScale(rng, civilianState.cityOrAboveCount, params.maxLargeSettlements);
      if (subtype === "city" || subtype === "metropolis") civilianState.cityOrAboveCount++;
    }
  } else {
    subtype = randPick(rng, POI_KIND_VALUES);
  }

  let boundary: BoundaryMarker | undefined;
  if (zone === "edge") {
    if (rng() < params.boundaryFraction) boundary = { reason: randPick(rng, BOUNDARY_REASONS) };
  } else if (zone === "mid" && zoneAllowsMidBoundary) {
    if (rng() < params.boundaryFraction * params.interiorBoundaryDamping) {
      boundary = { reason: randPick(rng, BOUNDARY_REASONS) };
    }
  }

  const coastal = boundary?.reason === "coastline" ? true : rng() < params.coastalChance;
  return { subtype, boundary, coastal };
}

export function connectionTypeFor(a: MapNode, b: MapNode, rng: RngFn, params: GenerationParams): ConnectionType {
  const aMountain = a.boundary?.reason === "mountain_range";
  const bMountain = b.boundary?.reason === "mountain_range";
  const isMountainPair =
    (aMountain && (bMountain || b.type === "wilderness")) ||
    (bMountain && (aMountain || a.type === "wilderness"));
  if (isMountainPair) return "pass";

  if (isWaterBranch(a) || isWaterBranch(b)) return "river_ford";

  if (a.coastal && b.coastal) return "sea_route";

  const isSettlementPair =
    (a.type === "settlement" && (b.type === "settlement" || b.type === "wilderness")) ||
    (b.type === "settlement" && (a.type === "settlement" || a.type === "wilderness"));
  if (isSettlementPair) return rng() < params.roadFraction ? "road" : "trail";

  return "trail";
}

export function dist(a: { gx: number; gy: number }, b: { gx: number; gy: number }): number {
  return Math.hypot(a.gx - b.gx, a.gy - b.gy);
}

export function targetDegreeFor(params: GenerationParams): number {
  return 2 + Math.round(params.edgeDensity * 4);
}

export function degreeOf(nodeId: string, edges: MapEdge[]): number {
  let count = 0;
  for (const e of edges) {
    if (e.fromId === nodeId || e.toId === nodeId) count++;
  }
  return count;
}

export function hasEdgeBetween(aId: string, bId: string, edges: MapEdge[]): boolean {
  return edges.some((e) => (e.fromId === aId && e.toId === bId) || (e.fromId === bId && e.toId === aId));
}

export function circularDist(a: CompassDir, b: CompassDir): number {
  const diff = Math.abs(ALL_DIRS.indexOf(a) - ALL_DIRS.indexOf(b));
  return Math.min(diff, 8 - diff);
}

// Picks the direction (from fromId's perspective) closest to `ideal` that is
// simultaneously free at fromId and free at toId (via its implied opposite),
// so a new edge never creates a one-direction-per-node or direction-symmetry
// violation at either end. Returns null if no such direction exists — the
// caller decides whether that means "skip this optional connection" or
// "fall back to anything free" (see bestAvailableDirection below).
export function jointlyFreeDirection(fromId: string, toId: string, ideal: CompassDir, edges: MapEdge[]): CompassDir | null {
  const freeAtFrom = freeDirections(fromId, edges);
  const freeAtTo = new Set(freeDirections(toId, edges));
  const jointlyFree = freeAtFrom.filter((dir) => freeAtTo.has(oppositeDir(dir)));
  if (jointlyFree.length === 0) return null;
  return jointlyFree.reduce((best, dir) => (circularDist(dir, ideal) < circularDist(best, ideal) ? dir : best), jointlyFree[0]);
}

// Same as jointlyFreeDirection, but falls back to whatever's free at fromId
// alone (accepting a possible direction-symmetry violation) rather than
// returning null — for edges that structurally must succeed (a repair edge,
// a radial backbone step), unlike a purely optional connection.
export function bestAvailableDirection(fromId: string, toId: string, ideal: CompassDir, edges: MapEdge[]): CompassDir {
  const jointlyFree = jointlyFreeDirection(fromId, toId, ideal, edges);
  if (jointlyFree) return jointlyFree;
  const freeAtFrom = freeDirections(fromId, edges);
  if (freeAtFrom.length === 0) return ideal;
  return freeAtFrom.reduce((best, dir) => (circularDist(dir, ideal) < circularDist(best, ideal) ? dir : best), freeAtFrom[0]);
}

export function connectedComponents(nodes: MapNode[], edges: MapEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const e of edges) {
    adjacency.get(e.fromId)?.push(e.toId);
    adjacency.get(e.toId)?.push(e.fromId);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

// The distance/probability pass in either placement algorithm can leave a
// node with only 1 edge (invariant 5 requires >=2). Top up any such node
// with its nearest not-yet-connected neighbor, picking whichever direction
// is jointly free at both ends and closest to the ideal geometric heading.
export function ensureMinimumDegree(nodes: MapNode[], edges: MapEdge[], rng: RngFn, params: GenerationParams): MapEdge[] {
  const working = [...edges];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) {
    let guard = 0;
    while (degreeOf(node.id, working) < 2 && guard < nodes.length) {
      guard++;
      const candidates = nodes
        .filter((other) => other.id !== node.id && !hasEdgeBetween(node.id, other.id, working))
        .sort((x, y) => dist(node, x) - dist(node, y));

      let added = false;
      for (const other of candidates) {
        const ideal = dirBetween(node.gx, node.gy, other.gx, other.gy);
        const direction = jointlyFreeDirection(node.id, other.id, ideal, working);
        if (!direction) continue;

        working.push({
          id: crypto.randomUUID(),
          fromId: node.id,
          toId: other.id,
          direction,
          connectionType: connectionTypeFor(node, nodeById.get(other.id)!, rng, params),
          checkRequired: false,
        });
        added = true;
        break;
      }
      if (!added) break; // no eligible candidate left; nothing more we can do
    }
  }
  return working;
}

// True nearest-component-pair merging (single-linkage): find the closest
// node pair across *any* two components, not just "2nd-biggest into
// biggest." See generator.ts's ALGORITHM_VERSION 2.1.1 history comment for
// why size-ranked merging was wrong (absurdly long bridge edges on sparse
// maps with several small isolated pockets).
export function repairConnectivity(nodes: MapNode[], edges: MapEdge[], rng: RngFn, params: GenerationParams): MapEdge[] {
  const working = [...edges];
  let components = connectedComponents(nodes, working);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  while (components.length > 1) {
    let bestPair: { fromId: string; toId: string; d: number } | null = null;
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        for (const aId of components[i]) {
          const aNode = nodeById.get(aId)!;
          for (const bId of components[j]) {
            const bNode = nodeById.get(bId)!;
            const d = dist(aNode, bNode);
            if (!bestPair || d < bestPair.d) bestPair = { fromId: aId, toId: bId, d };
          }
        }
      }
    }

    const { fromId, toId } = bestPair!;
    const fromNode = nodeById.get(fromId)!;
    const toNode = nodeById.get(toId)!;
    const ideal = dirBetween(fromNode.gx, fromNode.gy, toNode.gx, toNode.gy);
    const direction = bestAvailableDirection(fromId, toId, ideal, working);

    working.push({
      id: crypto.randomUUID(),
      fromId,
      toId,
      direction,
      connectionType: connectionTypeFor(fromNode, toNode, rng, params),
      checkRequired: false,
    });

    components = connectedComponents(nodes, working);
  }

  return working;
}

