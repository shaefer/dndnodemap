import type {
  CompassDir,
  ConnectionType,
  GenerationParams,
  MapEdge,
  MapNode,
  NodeType,
  WorldMap,
} from "../types/map";
import { ALL_DIRS, dirBetween, oppositeDir } from "./compass";
import { freeDirections, usedDirections } from "./graph";
import { makeRng, randInt, type RngFn } from "./rng";

// Bump (minor) whenever the RNG call sequence below changes such that a given
// seed would produce different output. See spec Section 4.
export const ALGORITHM_VERSION = "1.0.0";

type Zone = "center" | "mid" | "edge";

// --- Step 1: node placement -------------------------------------------------

function classifyZone(col: number, row: number, gridCols: number, gridRows: number): Zone {
  const edgeBand = Math.min(gridCols, gridRows) <= 8 ? 1 : 2;
  const inEdgeBand =
    col < edgeBand || row < edgeBand || col >= gridCols - edgeBand || row >= gridRows - edgeBand;
  if (inEdgeBand) return "edge";

  // Center zone = "inner 50% by area" (Section 7, Step 1) — a centered band
  // covering 50% of the area means each axis spans sqrt(0.5) ≈ 70.7% of the
  // grid, i.e. roughly the inner [0.15, 0.85] fraction. This is deliberately
  // a *much* wider band than invariant 4's inner-40% mountain-forbidden zone
  // (see checkMountainPlacement in validator.ts / midZoneMountainAllowed
  // below) — those are two unrelated thresholds for two different purposes.
  const fx = gridCols <= 1 ? 0.5 : col / (gridCols - 1);
  const fy = gridRows <= 1 ? 0.5 : row / (gridRows - 1);
  const inCenterBand = fx >= 0.15 && fx <= 0.85 && fy >= 0.15 && fy <= 0.85;
  return inCenterBand ? "center" : "mid";
}

// Mid-zone mountains are kept a safe margin outside the invariant-4 band
// (inner 40%, i.e. the [0.3, 0.7] fraction on both axes) so generator jitter
// can never push one back into forbidden territory.
function midZoneMountainAllowed(col: number, row: number, gridCols: number, gridRows: number): boolean {
  const fx = gridCols <= 1 ? 0.5 : col / (gridCols - 1);
  const fy = gridRows <= 1 ? 0.5 : row / (gridRows - 1);
  return fx < 0.2 || fx > 0.8 || fy < 0.2 || fy > 0.8;
}

const CENTER_ZONE_TYPES: NodeType[] = ["settlement", "wilderness", "ruin"];
const MID_ZONE_TYPES: NodeType[] = ["wilderness", "ruin", "mountain"];

function weightFor(type: NodeType, bias: GenerationParams["nodeTypeBias"]): number {
  switch (type) {
    case "settlement": return bias.settlement;
    case "wilderness": return bias.wilderness;
    case "mountain": return bias.mountain;
    case "ruin": return bias.ruin;
    case "water": return 0; // never generator-placed — see Section 3a doc comment
  }
}

// Weighted pick among an eligible subset, renormalizing nodeTypeBias over just
// those types (spec Section 7, Step 1: "constrain each type to its eligible zones").
function pickEligibleType(eligible: NodeType[], bias: GenerationParams["nodeTypeBias"], rng: RngFn): NodeType {
  const weights = eligible.map((t) => weightFor(t, bias));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return eligible[0];
  let roll = rng() * total;
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

function pickTypeForCell(
  zone: Zone,
  col: number,
  row: number,
  params: GenerationParams,
  rng: RngFn,
  mountainAllowed: boolean,
  forceSettlement: boolean
): NodeType {
  if (zone === "center") {
    // Settlement is the only type restricted to center-zone-only placement,
    // and that zone is a minority of the grid — left to organic weighted
    // rolls, wilderness/ruin's competing weight structurally starves it well
    // below nodeTypeBias.settlement's global share. forceSettlement (set by
    // placeNodes once remaining center cells run low relative to the
    // remaining settlement quota) guarantees the budget is actually met.
    if (forceSettlement) return "settlement";
    return pickEligibleType(CENTER_ZONE_TYPES, params.nodeTypeBias, rng);
  }
  if (zone === "edge") {
    if (!mountainAllowed) return "wilderness";
    // mountainEdgeFraction (Section 3a, "Containment") controls how much of
    // the *mountain budget* (see placeNodes) concentrates on the perimeter
    // vs. spilling into the mid zone, not an independent per-cell roll —
    // otherwise it and nodeTypeBias.mountain fight each other (a 1-cell-thick
    // edge ring is already ~40% of a modest grid's area).
    return rng() < params.mountainEdgeFraction ? "mountain" : "wilderness";
  }
  // mid zone
  const eligible = mountainAllowed ? MID_ZONE_TYPES : (["wilderness", "ruin"] as NodeType[]);
  const type = pickEligibleType(eligible, params.nodeTypeBias, rng);
  if (type === "mountain" && !midZoneMountainAllowed(col, row, params.gridCols, params.gridRows)) {
    return pickEligibleType(["wilderness", "ruin"], params.nodeTypeBias, rng);
  }
  return type;
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

  // Mountain count is capped at nodeTypeBias.mountain's global share (the
  // "budget"). Edge-zone cells are processed first so mountainEdgeFraction
  // gets first claim on that budget (containment), with any remainder
  // available to mid-zone cells afterward. Center-zone cells never place
  // mountains, so their processing order relative to the budget is moot.
  const zoned = chosen.map((cell) => ({
    ...cell,
    zone: classifyZone(cell.col, cell.row, params.gridCols, params.gridRows),
  }));
  const zonePriority: Record<Zone, number> = { edge: 0, mid: 1, center: 2 };
  const ordered = [...zoned].sort((a, b) => zonePriority[a.zone] - zonePriority[b.zone]);

  const totalBiasWeight =
    params.nodeTypeBias.settlement +
    params.nodeTypeBias.wilderness +
    params.nodeTypeBias.mountain +
    params.nodeTypeBias.ruin;
  const mountainBudget =
    totalBiasWeight > 0
      ? Math.round(nodeCount * (params.nodeTypeBias.mountain / totalBiasWeight))
      : 0;
  let mountainCount = 0;

  // Settlement budget, clamped to however many center cells actually exist —
  // can't force more settlements than there is room for.
  const centerCellCount = zoned.filter((c) => c.zone === "center").length;
  const settlementBudget = Math.min(
    centerCellCount,
    totalBiasWeight > 0 ? Math.round(nodeCount * (params.nodeTypeBias.settlement / totalBiasWeight)) : 0
  );
  let settlementCount = 0;
  let centerCellsLeft = centerCellCount;

  const counters: Record<NodeType, number> = { settlement: 0, wilderness: 0, mountain: 0, ruin: 0, water: 0 };
  const typeLabel: Record<NodeType, string> = {
    settlement: "Settlement",
    wilderness: "Wilderness",
    mountain: "Mountain",
    ruin: "Ruin",
    water: "Water",
  };

  const placed = ordered.map(({ col, row, zone }) => {
    const mountainAllowed = mountainCount < mountainBudget;
    let forceSettlement = false;
    if (zone === "center") {
      const settlementRemaining = settlementBudget - settlementCount;
      forceSettlement = settlementRemaining > 0 && settlementRemaining >= centerCellsLeft;
      centerCellsLeft--;
    }
    const type = pickTypeForCell(zone, col, row, params, rng, mountainAllowed, forceSettlement);
    if (type === "mountain") mountainCount++;
    if (type === "settlement") settlementCount++;
    counters[type] += 1;
    const gx = col + (rng() - 0.5) * 0.5;
    const gy = row + (rng() - 0.5) * 0.5;
    return {
      id: crypto.randomUUID(),
      label: `${typeLabel[type]}-${counters[type]}`,
      type,
      gx,
      gy,
    };
  });

  return placed;
}

// --- Step 2: edges -----------------------------------------------------------

function connectionTypeFor(a: NodeType, b: NodeType, rng: RngFn): ConnectionType {
  if (a === "water" || b === "water") return "river_ford";
  const isMountainPair =
    (a === "mountain" && (b === "mountain" || b === "wilderness")) ||
    (b === "mountain" && (a === "mountain" || a === "wilderness"));
  if (isMountainPair) return "pass";
  const isSettlementPair =
    (a === "settlement" && (b === "settlement" || b === "wilderness")) ||
    (b === "settlement" && (a === "settlement" || a === "wilderness"));
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
        connectionType: connectionTypeFor(a.type, b.type, rng),
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
          connectionType: connectionTypeFor(node.type, other.type, rng),
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
    // Largest component is treated as "main".
    components.sort((a, b) => b.length - a.length);
    const [main, ...rest] = components;
    const isolated = rest[0];

    let bestPair: { fromId: string; toId: string; d: number } | null = null;
    for (const isolatedId of isolated) {
      const isolatedNode = nodeById.get(isolatedId)!;
      for (const mainId of main) {
        const mainNode = nodeById.get(mainId)!;
        const d = dist(isolatedNode, mainNode);
        if (!bestPair || d < bestPair.d) {
          bestPair = { fromId: isolatedId, toId: mainId, d };
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
      connectionType: connectionTypeFor(fromNode.type, toNode.type, rng),
      checkRequired: false,
    });

    components = connectedComponents(nodes, working);
  }

  return working;
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
    const bothMountain = a.type === "mountain" && b.type === "mountain";
    const oneMountainOneWilderness =
      (a.type === "mountain" && b.type === "wilderness") ||
      (b.type === "mountain" && a.type === "wilderness");
    const neitherMountain = a.type !== "mountain" && b.type !== "mountain";

    let checkRequired = false;
    if (bothMountain) checkRequired = true;
    else if (oneMountainOneWilderness) checkRequired = rng() < params.checkRequiredFraction;
    else if (neitherMountain) checkRequired = rng() < params.checkRequiredFraction * 0.2;

    return { ...edge, checkRequired };
  });

  return enforceNonCheckRequiredExit(nodes, marked);
}

// --- Step 4: check types ------------------------------------------------------

function checkTypeFor(edge: MapEdge, rng: RngFn): string {
  switch (edge.connectionType) {
    case "pass": return `Athletics DC ${randInt(rng, 14, 18)}`;
    case "river_ford": return `Athletics DC ${randInt(rng, 10, 14)}`;
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

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Unnamed Region",
    nodes,
    edges,
    extensions: {},
    params,
    algorithmVersion: ALGORITHM_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
