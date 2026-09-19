import type {
  Biome,
  ConnectionType,
  GenerationParams,
  MapEdge,
  MapNode,
  NodeType,
  WorldMap,
} from "../types/map";
import type { TerrainZone } from "../types/extensions";
import { dirBetween, oppositeDir } from "./compass";
import { usedDirections } from "./graph";
import {
  capitalize,
  classifyNode,
  connectionTypeFor,
  createLabelGenerator,
  degreeOf,
  dist,
  ensureMinimumDegree,
  hasEdgeBetween,
  repairConnectivity,
  targetDegreeFor,
  type Zone,
} from "./generationShared";
import { relaxLayout } from "./layoutRelax";
import { applyNodeNames, generateMapName } from "./naming";
import { generateRadial } from "./radialGenerator";
import { makeRng, randInt, type RngFn } from "./rng";
import { BIOMES } from "./taxonomy";

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
// 2.1.2: CANDIDATE_RADIUS (buildEdges' candidate search radius and
// acceptance-probability falloff) changed from a fixed constant to a
// density-aware formula (core/generator.ts's candidateRadiusFor, backing
// core/geometry.ts's recommendedGridDimensions default grid sizing) so
// sparser grids still find a healthy number of in-range neighbors instead of
// pushing more of the graph onto the repair paths. Calibrated to reproduce
// the old constant exactly at the pre-existing default density (49 nodes /
// 10x8 grid) — only non-default grid/node combinations see a different RNG
// sequence.
// 2.2.0: new "radial" placementAlgorithm (spec Section 7e) — a genuinely
// different placement/edge-building code path (core/radialGenerator.ts),
// selectable via params.placementAlgorithm alongside the original "grid"
// path (unchanged, still bit-identical for existing seeds/params — this is
// a capability bump, not a behavior change to the default path). Shared
// classification/connectivity-repair logic extracted to
// core/generationShared.ts so neither path can quietly drift from the
// other's taxonomy rules.
// 2.3.0: "radial" reworked from literal fixed-radius spokes to organic,
// collision-avoiding maze-style growth (a Growing Tree algorithm) after
// direct user testing feedback that the first implementation was too
// literal — every step used to snap toward "keep going the way this spoke
// started," producing straight rays with no real direction freedom or
// collision handling. Same six radialSpokeCount/radialCoreInterconnectivity/
// radialBranchChance/radialClusterChance/radialDeadEndPoiBias/
// radialConvergenceRadius fields, reinterpreted (see core/radialGenerator.ts
// and spec Section 7e) rather than replaced — no params/UI/codec changes,
// only the "radial" RNG sequence and resulting map shape. "grid" mode is
// completely unaffected.
// 2.4.0: new post-placement layout relaxation pass (spec Section 7f,
// core/layoutRelax.ts) applied to both placement algorithms — a Magnetic
// Spring Model relaxation that spaces cramped nodes apart and rotates edges
// toward the CompassDir they already declare (directions themselves are
// never relabeled). Consumes no rng() draws, but does move node positions,
// so a given seed renders differently than it did at 2.3.0. Controlled by
// layoutRelaxStrength/layoutNodeSpacing/layoutDirectionWeight; strength 0
// restores exactly the pre-2.4.0 placement.
// 2.5.0: new post-generation naming pass (core/naming.ts, backed by the
// standalone src/nameforge library) replaces placeholder "Village-1"-style
// node labels and the hardcoded "Unnamed Region" map name with real
// generated names. A genuinely new capability that consumes rng() draws for
// every node plus one for the map name, so every seed's output changes.
// 2.6.0: nameforge's roots/suffixes/adjectives/nouns banks became
// categorized (colors, gems, materials, flora, fauna, etc. as named
// sub-lists) across every theme naming.ts uses, with category-weighted
// picking (pick a category uniformly, then a word within it) so a large
// category no longer dominates a small one — a categorized bank consumes two
// rng() draws per pick instead of one. regionName also gained two additional
// pattern shapes (a compact single-word compound and a nested genitive "The
// [noun] of [descriptor] [compound]") alongside its existing phrase pattern,
// for real cadence variety in map names, not just word variance. Both
// changes shift the naming pass's rng() sequence for every node and the map
// name, on every seed.
// 2.7.0: nameforge word lists consolidated into a shared category library
// (src/nameforge/categories/ — colors/gems/materials/flora/fauna/directions/
// descriptors/personal names reused across themes instead of hand-duplicated
// per theme) and expanded to 8-16 words each; settlementMedieval gained a
// possessive ("Devon's Ford") and a descriptive ("Northern Bridge") pattern
// alongside its compound one, and waterFeature gained a descriptive ("The
// Silver Pool") pattern — every theme now has >= 3. Pattern selection also
// became weight-proportional (Pattern.weight, default 1) rather than strictly
// uniform. Bigger banks and more patterns per theme both shift the naming
// pass's rng() sequence for every seed.
// 2.8.0 (M4.16.1): every already-wired nameforge theme's word lists grew
// substantially (most categories now sit at 16-24+ entries, several 2-3x
// their 2.7.0 size — personalNames alone grew from ~12 to 50) and
// settlementMedieval gained two new "named after a beast" patterns
// ("Red Dragon Hall", "Crystal Griffon's Barrow"). Bigger banks change which
// word a given rng() draw resolves to (category-weighted picking still
// consumes the same number of draws per pick, but the word-within-category
// index range is now wider), and settlementMedieval's added patterns shift
// weighted pattern selection — both change the naming pass's output for
// every seed. The 17 race themes (nameforge/themes/races/) were also
// expanded and gained a fourth pattern (native-of-epithet), but race themes
// still aren't wired into generateMap() (that's M4.17), so they don't factor
// into this bump.
export const ALGORITHM_VERSION = "2.8.0";

// --- Step 1: node placement ("grid" algorithm) -------------------------------

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

function placeNodesGrid(params: GenerationParams, rng: RngFn): MapNode[] {
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

  const nextLabel = createLabelGenerator();
  const civilianState = { cityOrAboveCount: 0 };

  const placed = zoned.map((cell, i) => {
    const type = bag[i] ?? "wilderness";

    const { subtype, boundary, coastal } = classifyNode(
      type,
      cell.zone,
      midZoneBoundaryAllowed(cell.col, cell.row, params.gridCols, params.gridRows),
      params,
      rng,
      civilianState
    );

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

// --- Step 2: edges ("grid" algorithm) -----------------------------------------

// Calibrated so candidateRadiusFor(params) reproduces exactly 1.6 (the
// original fixed constant) at the pre-existing default density (49 nodes /
// 10x8 grid = 0.6125); density cancels out algebraically at that point.
const CANDIDATE_RADIUS_BASE = 1.6 * Math.sqrt(49 / (10 * 8));

function candidateRadiusFor(params: GenerationParams): number {
  const density = params.targetNodeCount / (params.gridCols * params.gridRows);
  return CANDIDATE_RADIUS_BASE / Math.sqrt(density);
}

function buildEdgesGrid(nodes: MapNode[], params: GenerationParams, rng: RngFn): MapEdge[] {
  const edges: MapEdge[] = [];
  const targetDegree = targetDegreeFor(params);
  const candidateRadius = candidateRadiusFor(params);

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
      .filter((b) => b.id !== a.id && dist(a, b) <= candidateRadius)
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

      const acceptProb = Math.max(0.15, 1 - dist(a, b) / candidateRadius);
      if (rng() >= acceptProb) continue;

      edges.push({
        id: crypto.randomUUID(),
        fromId: a.id,
        toId: b.id,
        direction,
        connectionType: connectionTypeFor(a, b, rng, params),
        checkRequired: false,
      });
    }
  }

  const connected = repairConnectivity(nodes, edges, rng, params);
  return ensureMinimumDegree(nodes, connected, rng, params);
}

// --- Step 2.5: optional terrain zones ----------------------------------------

// A zone should read as "a cluster of nearby nodes," not "every node of this
// flavor anywhere on the map" — grouping purely by matching value (with no
// distance limit) produces one giant hull per biome that mostly overlaps
// every other biome's hull, which is unreadable once drawn. This threshold
// keeps clusters regional; tune alongside candidateRadiusFor if it ever needs
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
    else if (neitherBoundary) checkRequired = rng() < params.checkRequiredFraction * params.wildernessCheckMultiplier;

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

function generateGrid(params: GenerationParams, rng: RngFn): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes = placeNodesGrid(params, rng);
  const edges = buildEdgesGrid(nodes, params, rng);
  return { nodes, edges };
}

// --- Step 5: assemble ----------------------------------------------------------

export function generateMap(params: GenerationParams): WorldMap {
  const rng = makeRng(params.seed);

  // "radial" derives its own grid size from targetNodeCount/radialSpokeCount
  // rather than reading params.gridCols/gridRows — the effective params
  // stored on the resulting map must reflect that *actual* size (not
  // whatever gridCols/gridRows happened to be sitting in draftParams), since
  // the validator's boundary-placement check, the share-code codec, and the
  // canvas/exporter's margin math all key off map.params.gridCols/gridRows.
  let nodes: MapNode[];
  let built: MapEdge[];
  let effectiveParams: GenerationParams;
  if (params.placementAlgorithm === "radial") {
    const radial = generateRadial(params, rng);
    nodes = radial.nodes;
    built = radial.edges;
    effectiveParams = { ...params, gridCols: radial.gridCols, gridRows: radial.gridRows };
  } else {
    const grid = generateGrid(params, rng);
    nodes = grid.nodes;
    built = grid.edges;
    effectiveParams = params;
  }

  // Layout relaxation (spec Section 7f): a geometry-only visual pass shared
  // by both placement algorithms — opens up cramped nodes and rotates edges
  // toward the compass directions they declare. Runs before markCheckRequired
  // and generateTerrainZonesStep because the latter clusters by spatial
  // proximity and must see final positions. Consumes no rng() draws.
  nodes = relaxLayout(nodes, built, effectiveParams, effectiveParams.gridCols, effectiveParams.gridRows);

  // Naming pass (M4.12): a standalone post-generation transform, same shape
  // as relaxLayout above — knows nothing about geometry/edges, just replaces
  // each node's placeholder label with a real generated name based on its
  // already-resolved type/subtype/biome.
  nodes = applyNodeNames(nodes, rng);

  const checked = markCheckRequired(nodes, built, effectiveParams, rng);
  const edges = assignCheckTypes(checked, rng);
  const terrainZones = effectiveParams.generateTerrainZones ? generateTerrainZonesStep(nodes) : undefined;

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: generateMapName(rng),
    nodes,
    edges,
    extensions: terrainZones && terrainZones.length > 0 ? { terrainZones } : {},
    params: effectiveParams,
    algorithmVersion: ALGORITHM_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
