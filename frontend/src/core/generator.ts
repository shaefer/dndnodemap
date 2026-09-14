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
  WorldMap,
} from "../types/map";
import type { TerrainZone } from "../types/extensions";
import { ALL_DIRS, dirBetween, oppositeDir } from "./compass";
import { freeDirections, usedDirections } from "./graph";
import { makeRng, randInt, randPick, type RngFn } from "./rng";
import { BIOMES, isWaterBranch } from "./taxonomy";

// Bump (minor) whenever the RNG call sequence below changes such that a given
// seed would produce different output. Major version = breaking change to the
// data model. See spec Section 4.
//
// 2.0.0: taxonomy rework (spec Section 3c) — NodeType shrank to
// settlement/wilderness/poi; the old "mountain" NodeType became a
// BoundaryMarker (mountain_range reason) and the old "water" NodeType became
// a Wilderness-internal fork. M4.5 landed the migration with no new
// generation variety; M4.6 (still 2.0.0 — same data model, just the
// generator getting smarter within it) adds real Tier 2 subtype placement,
// coastal/sea_route, and optional terrain-zone generation. (In hindsight
// M4.6 changed the RNG sequence enough to deserve its own minor bump and
// didn't get one — not repeating that gap here.)
// 2.1.0: M4.7.2 — wilderness land-branch Biome selection changed from a flat
// uniform pick to a weighted pick against params.biomeMix (spec Section 7c).
// Same seed now produces different biome placement than 2.0.0 did.
// 2.1.1: repairConnectivity's merge strategy changed from size-ranked
// ("2nd-biggest component into biggest") to true nearest-component-pair
// (closest node pair across any two components) — fixes absurdly long
// bridge edges on sparse maps with several small isolated pockets. Doesn't
// change how many bridge edges get added, but changes which node pairs get
// bridged, which can shift connectionTypeFor's rng() draws for the rest of
// generation — same seed can produce a different (better-connected) map.
export const ALGORITHM_VERSION = "2.1.1";

type Zone = "center" | "mid" | "edge";

// --- Step 1: node placement -------------------------------------------------

function classifyZone(col: number, row: number, gridCols: number, gridRows: number): Zone {
  const edgeBand = Math.min(gridCols, gridRows) <= 8 ? 1 : 2;
  const inEdgeBand =
    col < edgeBand || row < edgeBand || col >= gridCols - edgeBand || row >= gridRows - edgeBand;
  if (inEdgeBand) return "edge";

  // Center zone = "inner 50% by area" — a centered band covering 50% of the
  // area means each axis spans sqrt(0.5) ≈ 70.7% of the grid, i.e. roughly
  // the inner [0.15, 0.85] fraction. All three Tier 1 types are eligible in
  // every zone now (spec Section 7) — zone only affects boundary-marker
  // probability, not type eligibility — so this classification exists solely
  // to gate where a BoundaryMarker may be placed (invariant 4: no
  // boundary-marked node in the inner 40% band, i.e. the [0.3, 0.7] fraction
  // — a distinct, narrower threshold from this 50%-by-area band).
  const fx = gridCols <= 1 ? 0.5 : col / (gridCols - 1);
  const fy = gridRows <= 1 ? 0.5 : row / (gridRows - 1);
  const inCenterBand = fx >= 0.15 && fx <= 0.85 && fy >= 0.15 && fy <= 0.85;
  return inCenterBand ? "center" : "mid";
}

// Mid-zone boundary markers are kept a safe margin outside the invariant-4
// band (inner 40%, i.e. the [0.3, 0.7] fraction on both axes) so generator
// jitter can never push one back into forbidden territory.
function midZoneBoundaryAllowed(col: number, row: number, gridCols: number, gridRows: number): boolean {
  const fx = gridCols <= 1 ? 0.5 : col / (gridCols - 1);
  const fy = gridRows <= 1 ? 0.5 : row / (gridRows - 1);
  return fx < 0.2 || fx > 0.8 || fy < 0.2 || fy > 0.8;
}

// Mid-zone boundary markers occur at a much lower rate than edge-zone ones —
// boundaryFraction is "how much of the edge concentrates a marker," not an
// independent per-cell probability everywhere.
const MID_ZONE_BOUNDARY_DAMPING = 0.15;

const BOUNDARY_REASONS: BoundaryReason[] = ["coastline", "mountain_range", "canyon_void", "magical_barrier"];

// A node independently reads as coastal at this low rate even without a
// coastline boundary marker, so coastal flavor isn't confined to the
// boundary ring (spec Section 7, Step 1).
const INDEPENDENT_COASTAL_CHANCE = 0.05;

const BIOME_VALUES: Biome[] = ["forest", "swamp", "plains", "desert", "tundra", "jungle"];
const WATER_FEATURE_VALUES: WaterFeature[] = ["pond", "lake", "river_crossing", "hot_spring", "waterfall", "delta"];
const OUTPOST_KIND_VALUES: OutpostKind[] = ["monastery", "military_fort", "trading_post", "mining_camp", "waystation"];
const POI_KIND_VALUES: PoiKind[] = ["ruin", "dungeon", "lair", "landmark"];

// Civilian settlements skew toward village/town — city and especially
// metropolis should be rare regardless of targetNodeCount, so a hard cap
// backs up the weighting rather than relying on probability alone.
const CIVILIAN_SCALE_WEIGHTS: Record<CivilianScale, number> = { village: 45, town: 35, city: 15, metropolis: 5 };
const MAX_CITY_OR_ABOVE = 2;

function pickCivilianScale(rng: RngFn, cityOrAboveCount: number): CivilianScale {
  const allowCityOrAbove = cityOrAboveCount < MAX_CITY_OR_ABOVE;
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
function pickBiome(rng: RngFn, biomeMix: GenerationParams["biomeMix"]): Biome {
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function placeNodes(params: GenerationParams, rng: RngFn): MapNode[] {
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < params.gridRows; row++) {
    for (let col = 0; col < params.gridCols; col++) {
      cells.push({ col, row });
    }
  }

  // Shuffle so which grid cells get filled (when targetNodeCount < capacity)
  // is seed-driven, not just "top-left first".
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const nodeCount = Math.min(params.targetNodeCount, cells.length);
  const chosen = cells.slice(0, nodeCount);
  const zoned = chosen.map((cell) => ({
    ...cell,
    zone: classifyZone(cell.col, cell.row, params.gridCols, params.gridRows),
  }));

  // Exact-budget type assignment: since all three Tier 1 types are eligible
  // in every zone now (spec Section 7 — zone only gates BoundaryMarker
  // placement, not type eligibility), the target nodeTypeBias split can be
  // hit exactly with a shuffled bag instead of per-zone eligibility rules.
  const bias = params.nodeTypeBias;
  const totalWeight = bias.settlement + bias.wilderness + bias.poi;
  const settlementBudget = totalWeight > 0 ? Math.round(nodeCount * (bias.settlement / totalWeight)) : 0;
  const wildernessBudget = totalWeight > 0 ? Math.round(nodeCount * (bias.wilderness / totalWeight)) : 0;
  const poiBudget = Math.max(0, nodeCount - settlementBudget - wildernessBudget);

  const bag: NodeType[] = [
    ...Array(settlementBudget).fill("settlement" as NodeType),
    ...Array(wildernessBudget).fill("wilderness" as NodeType),
    ...Array(poiBudget).fill("poi" as NodeType),
  ];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  const labelCounters: Record<string, number> = {};
  const nextLabel = (key: string): string => {
    labelCounters[key] = (labelCounters[key] ?? 0) + 1;
    return `${capitalize(key)}-${labelCounters[key]}`;
  };

  let cityOrAboveCount = 0;

  const placed = zoned.map((cell, i) => {
    const type = bag[i] ?? "wilderness";

    // Tier 1.5 fork + Tier 2 subtype.
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
        subtype = pickCivilianScale(rng, cityOrAboveCount);
        if (subtype === "city" || subtype === "metropolis") cityOrAboveCount++;
      }
    } else {
      subtype = randPick(rng, POI_KIND_VALUES);
    }

    // Boundary marker.
    let boundary: BoundaryMarker | undefined;
    if (cell.zone === "edge") {
      if (rng() < params.boundaryFraction) boundary = { reason: randPick(rng, BOUNDARY_REASONS) };
    } else if (cell.zone === "mid" && midZoneBoundaryAllowed(cell.col, cell.row, params.gridCols, params.gridRows)) {
      if (rng() < params.boundaryFraction * MID_ZONE_BOUNDARY_DAMPING) {
        boundary = { reason: randPick(rng, BOUNDARY_REASONS) };
      }
    }

    // Coastal — always true when the boundary reason is coastline; otherwise
    // a low independent chance so coastal flavor isn't confined to the
    // boundary ring.
    const coastal = boundary?.reason === "coastline" ? true : rng() < INDEPENDENT_COASTAL_CHANCE;

    const gx = cell.col + (rng() - 0.5) * 0.5;
    const gy = cell.row + (rng() - 0.5) * 0.5;
    return {
      id: crypto.randomUUID(),
      label: nextLabel(subtype),
      type,
      subtype,
      ...(boundary ? { boundary } : {}),
      ...(coastal ? { coastal: true } : {}),
      gx,
      gy,
    };
  });

  return placed;
}

// --- Step 2: edges -----------------------------------------------------------

function connectionTypeFor(a: MapNode, b: MapNode, rng: RngFn): ConnectionType {
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
  if (isSettlementPair) return rng() < 0.5 ? "road" : "trail";

  return "trail";
}

function dist(a: MapNode, b: MapNode): number {
  return Math.hypot(a.gx - b.gx, a.gy - b.gy);
}

function targetDegreeFor(params: GenerationParams): number {
  return 2 + Math.round(params.edgeDensity * 4);
}

function degreeOf(nodeId: string, edges: MapEdge[]): number {
  let count = 0;
  for (const e of edges) {
    if (e.fromId === nodeId || e.toId === nodeId) count++;
  }
  return count;
}

function hasEdgeBetween(aId: string, bId: string, edges: MapEdge[]): boolean {
  return edges.some(
    (e) => (e.fromId === aId && e.toId === bId) || (e.fromId === bId && e.toId === aId)
  );
}

const CANDIDATE_RADIUS = 1.6;

function buildEdges(nodes: MapNode[], params: GenerationParams, rng: RngFn): MapEdge[] {
  const edges: MapEdge[] = [];
  const targetDegree = targetDegreeFor(params);

  // Order in which nodes get to propose edges is itself seed-driven.
  const order = nodes.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (const i of order) {
    const a = nodes[i];
    if (degreeOf(a.id, edges) >= targetDegree) continue;

    const candidates = nodes
      .filter((b) => b.id !== a.id && dist(a, b) <= CANDIDATE_RADIUS)
      .sort((x, y) => dist(a, x) - dist(a, y));

    for (const b of candidates) {
      if (degreeOf(a.id, edges) >= targetDegree) break;
      if (degreeOf(b.id, edges) >= targetDegree) continue;

      const direction = dirBetween(a.gx, a.gy, b.gx, b.gy);
      if (usedDirections(a.id, edges).includes(direction)) continue;
      // Also guard b's side — the implied reverse direction must be free there
      // too, or we'd create a direction-symmetry violation at b.
      if (usedDirections(b.id, edges).includes(oppositeDir(direction))) continue;
      if (hasEdgeBetween(a.id, b.id, edges)) continue;

      const acceptProb = Math.max(0.15, 1 - dist(a, b) / CANDIDATE_RADIUS);
      if (rng() >= acceptProb) continue;

      edges.push({
        id: crypto.randomUUID(),
        fromId: a.id,
        toId: b.id,
        direction,
        connectionType: connectionTypeFor(a, b, rng),
        checkRequired: false,
      });
    }
  }

  const connected = repairConnectivity(nodes, edges, rng);
  return ensureMinimumDegree(nodes, connected, rng);
}

// The distance/probability pass above can leave a node with only 1 edge
// (invariant 5 requires >=2). Top up any such node with its nearest
// not-yet-connected neighbor, picking whichever direction is jointly free at
// both ends and closest to the ideal geometric heading.
function ensureMinimumDegree(nodes: MapNode[], edges: MapEdge[], rng: RngFn): MapEdge[] {
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
        const freeAtNode = freeDirections(node.id, working);
        const freeAtOther = new Set(freeDirections(other.id, working));
        const jointlyFree = freeAtNode.filter((d) => freeAtOther.has(oppositeDir(d)));
        if (jointlyFree.length === 0) continue;

        const direction = jointlyFree.reduce((best, d) =>
          circularDist(d, ideal) < circularDist(best, ideal) ? d : best
        , jointlyFree[0]);

        working.push({
          id: crypto.randomUUID(),
          fromId: node.id,
          toId: other.id,
          direction,
          connectionType: connectionTypeFor(node, nodeById.get(other.id)!, rng),
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

function connectedComponents(nodes: MapNode[], edges: MapEdge[]): string[][] {
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

function circularDist(a: CompassDir, b: CompassDir): number {
  const diff = Math.abs(ALL_DIRS.indexOf(a) - ALL_DIRS.indexOf(b));
  return Math.min(diff, 8 - diff);
}

// Picks the direction (from fromId's perspective) closest to `ideal` that is
// simultaneously free at fromId and free at toId (via its implied opposite) —
// so a repair edge never creates a one-direction-per-node or direction-symmetry
// violation at either end. Falls back to whatever's free at fromId alone if no
// direction satisfies both sides (pathological — should not occur in practice).
function bestAvailableDirection(fromId: string, toId: string, ideal: CompassDir, edges: MapEdge[]): CompassDir {
  const freeAtFrom = freeDirections(fromId, edges);
  const freeAtTo = new Set(freeDirections(toId, edges));
  const jointlyFree = freeAtFrom.filter((dir) => freeAtTo.has(oppositeDir(dir)));

  const pool = jointlyFree.length > 0 ? jointlyFree : freeAtFrom;
  if (pool.length === 0) return ideal;
  return pool.reduce((best, dir) =>
    circularDist(dir, ideal) < circularDist(best, ideal) ? dir : best
  , pool[0]);
}

function repairConnectivity(
  nodes: MapNode[],
  edges: MapEdge[],
  rng: RngFn
): MapEdge[] {
  const working = [...edges];
  let components = connectedComponents(nodes, working);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  while (components.length > 1) {
    // True nearest-component-pair merging (single-linkage): find the closest
    // node pair across *any* two components, not just "2nd-biggest into
    // biggest." The size-ranked version of this used to always attach
    // whichever component wasn't currently the largest directly to the
    // largest one, regardless of geography — so a small isolated pocket
    // sitting right next to a handful of other small pockets, but far from
    // whatever the largest component happened to be, paid the full
    // cross-map distance on every merge instead of consolidating locally
    // first. (Found from a real generated map where this produced a ~10-unit
    // edge on a map where every other edge was under ~2 units — see
    // generator.test.ts's regression test pinned to that exact seed.)
    let bestPair: { fromId: string; toId: string; d: number; compA: number; compB: number } | null = null;
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        for (const aId of components[i]) {
          const aNode = nodeById.get(aId)!;
          for (const bId of components[j]) {
            const bNode = nodeById.get(bId)!;
            const d = dist(aNode, bNode);
            if (!bestPair || d < bestPair.d) {
              bestPair = { fromId: aId, toId: bId, d, compA: i, compB: j };
            }
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
      connectionType: connectionTypeFor(fromNode, toNode, rng),
      checkRequired: false,
    });

    components = connectedComponents(nodes, working);
  }

  return working;
}

// --- Step 2.5: optional terrain zones ----------------------------------------

// A zone should read as "a cluster of nearby nodes," not "every node of this
// flavor anywhere on the map" — grouping purely by matching value (with no
// distance limit) produces one giant hull per biome that mostly overlaps
// every other biome's hull, which is unreadable once drawn. This threshold
// keeps clusters regional; tune alongside CANDIDATE_RADIUS if it ever needs
// to change (they answer related but distinct questions — edge candidacy vs.
// zone membership).
const TERRAIN_CLUSTER_RADIUS = 2.2;

// Union-find over nodes already known to share some grouping key (a biome, or
// "is coastal") — connects any two within TERRAIN_CLUSTER_RADIUS of each
// other, then returns each resulting connected component as its own group.
// Two same-biome nodes on opposite sides of the map end up in separate
// clusters (and separate TerrainZones) instead of one map-spanning blob.
function clusterBySpatialProximity(nodes: MapNode[]): MapNode[][] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const n of nodes) parent.set(n.id, n.id);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (dist(nodes[i], nodes[j]) <= TERRAIN_CLUSTER_RADIUS) {
        const ra = find(nodes[i].id);
        const rb = find(nodes[j].id);
        if (ra !== rb) parent.set(ra, rb);
      }
    }
  }
  const groups = new Map<string, MapNode[]>();
  for (const n of nodes) {
    const root = find(n.id);
    const group = groups.get(root) ?? [];
    group.push(n);
    groups.set(root, group);
  }
  return [...groups.values()];
}

// Groups land-branch wilderness nodes that share a Biome, clustered by
// spatial proximity (see above) into one TerrainZone per regional cluster —
// a biome present in two separate parts of the map yields two zones, not
// one. Also clusters coastal nodes into "ocean" zone(s) the same way. Only
// called when params.generateTerrainZones is true (spec Section 7).
function generateTerrainZonesStep(nodes: MapNode[]): TerrainZone[] {
  const zones: TerrainZone[] = [];

  const biomeGroups = new Map<Biome, MapNode[]>();
  for (const node of nodes) {
    if (node.type === "wilderness" && node.subtype && BIOMES.has(node.subtype)) {
      const biome = node.subtype as Biome;
      const group = biomeGroups.get(biome) ?? [];
      group.push(node);
      biomeGroups.set(biome, group);
    }
  }
  for (const [biome, biomeNodes] of biomeGroups) {
    for (const cluster of clusterBySpatialProximity(biomeNodes)) {
      if (cluster.length < 2) continue; // not worth a zone for a single node
      const hasMountainRange = cluster.some((n) => n.boundary?.reason === "mountain_range");
      zones.push({
        id: crypto.randomUUID(),
        label: `The ${capitalize(biome)}`,
        terrain: biome,
        elevation: hasMountainRange ? "elevated" : "flatland",
        nodeIds: cluster.map((n) => n.id),
      });
    }
  }

  const coastalNodes = nodes.filter((n) => n.coastal);
  for (const cluster of clusterBySpatialProximity(coastalNodes)) {
    if (cluster.length < 2) continue;
    zones.push({
      id: crypto.randomUUID(),
      label: "The Open Sea",
      terrain: "ocean",
      elevation: "flatland",
      nodeIds: cluster.map((n) => n.id),
    });
  }

  return zones;
}

// --- Step 3: check-required marking ------------------------------------------

const DIFFICULTY_RANK: Record<ConnectionType, number> = {
  road: 0,
  trail: 1,
  river_ford: 2,
  pass: 3,
  sea_route: 4,
  seasonal: 5,
};

// Invariant 6: every node must keep at least one non-check-required edge.
// Unmarks the lowest-difficulty edge at any node where every edge is
// currently check-required. Exported so non-generator sources of edges (e.g.
// the hand-authored prototype fixture) can be brought into compliance with
// the same repair policy instead of a bespoke one.
export function enforceNonCheckRequiredExit(nodes: MapNode[], edges: MapEdge[]): MapEdge[] {
  const marked = [...edges];
  for (const node of nodes) {
    const nodeEdges = marked.filter((e) => e.fromId === node.id || e.toId === node.id);
    if (nodeEdges.length === 0) continue;
    if (nodeEdges.every((e) => e.checkRequired)) {
      const easiest = nodeEdges.reduce((best, e) =>
        DIFFICULTY_RANK[e.connectionType] < DIFFICULTY_RANK[best.connectionType] ? e : best
      );
      const idx = marked.findIndex((e) => e.id === easiest.id);
      marked[idx] = { ...marked[idx], checkRequired: false };
    }
  }
  return marked;
}

function markCheckRequired(
  nodes: MapNode[],
  edges: MapEdge[],
  params: GenerationParams,
  rng: RngFn
): MapEdge[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const marked = edges.map((edge) => {
    const a = nodeById.get(edge.fromId)!;
    const b = nodeById.get(edge.toId)!;
    const aMountain = a.boundary?.reason === "mountain_range";
    const bMountain = b.boundary?.reason === "mountain_range";
    const bothMountainish = (aMountain && b.boundary !== undefined) || (bMountain && a.boundary !== undefined);
    const oneMountainOneWilderness = (aMountain && b.type === "wilderness") || (bMountain && a.type === "wilderness");
    const aBoundary = a.boundary !== undefined;
    const bBoundary = b.boundary !== undefined;
    const oneBoundaryOneWilderness =
      (aBoundary && b.type === "wilderness") || (bBoundary && a.type === "wilderness");
    const neitherBoundary = !aBoundary && !bBoundary;

    let checkRequired = false;
    if (bothMountainish || oneMountainOneWilderness) checkRequired = true;
    else if (oneBoundaryOneWilderness) checkRequired = rng() < params.checkRequiredFraction;
    else if (neitherBoundary) checkRequired = rng() < params.checkRequiredFraction * 0.2;

    return { ...edge, checkRequired };
  });

  return enforceNonCheckRequiredExit(nodes, marked);
}

// --- Step 4: check types ------------------------------------------------------

function checkTypeFor(edge: MapEdge, rng: RngFn): string {
  switch (edge.connectionType) {
    case "pass": return `Athletics DC ${randInt(rng, 14, 18)}`;
    case "river_ford": return `Athletics DC ${randInt(rng, 10, 14)}`;
    case "sea_route": return `Athletics DC ${randInt(rng, 12, 16)}`;
    case "trail": return `Survival DC ${randInt(rng, 10, 14)}`;
    case "road": return `Athletics DC ${randInt(rng, 8, 12)}`;
    default: return `Athletics DC ${randInt(rng, 10, 14)}`;
  }
}

function assignCheckTypes(edges: MapEdge[], rng: RngFn): MapEdge[] {
  return edges.map((edge) =>
    edge.checkRequired ? { ...edge, checkType: checkTypeFor(edge, rng) } : edge
  );
}

// --- Step 5: assemble ----------------------------------------------------------

export function generateMap(params: GenerationParams): WorldMap {
  const rng = makeRng(params.seed);

  const nodes = placeNodes(params, rng);
  const built = buildEdges(nodes, params, rng);
  const checked = markCheckRequired(nodes, built, params, rng);
  const edges = assignCheckTypes(checked, rng);
  const terrainZones = params.generateTerrainZones ? generateTerrainZonesStep(nodes) : undefined;

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Unnamed Region",
    nodes,
    edges,
    extensions: terrainZones && terrainZones.length > 0 ? { terrainZones } : {},
    params,
    algorithmVersion: ALGORITHM_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
