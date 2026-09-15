import type { CompassDir, GenerationParams, MapEdge, MapNode, NodeType } from "../types/map";
import { ALL_DIRS, dirBetween, dirToVector } from "./compass";
import { freeDirections } from "./graph";
import { recommendedRadialGridDimensions } from "./geometry";
import {
  bestAvailableDirection,
  circularDist,
  classifyNode,
  connectionTypeFor,
  createLabelGenerator,
  degreeOf,
  dist,
  ensureMinimumDegree,
  hasEdgeBetween,
  jointlyFreeDirection,
  pickNodeTypeWeighted,
  POI_KIND_VALUES,
  repairConnectivity,
  type Zone,
} from "./generationShared";
import { randPick, shuffle, type RngFn } from "./rng";

// The "radial" (core-out) placement algorithm (spec Section 7e): a core
// settlement sits at the exact center of the grid, and paths grow outward
// from it via a Growing-Tree-style maze walk (see the corrected-design notes
// below) rather than literal straight spokes. See core/generationShared.ts
// for the geometry-agnostic classification/connectivity helpers this shares
// with core/generator.ts's "grid" path — nothing in this file duplicates
// that logic, and nothing here is imported back into generator.ts except
// this module's own generateRadial entry point (one-directional dependency,
// no cycle).
//
// --- Corrected design (post-M4.8 user feedback) -----------------------------
// The first implementation grew literal spokes: each step snapped to
// whichever free direction was closest to "keep going the way this arm
// started," producing straight rays out of the core. Real feedback: there
// should be NO preference to continue in the same direction, direction
// freedom should be wide open (most of the 8 compass directions, tapering
// only softly against pointing straight back at the center), and the
// algorithm needs actual collision handling — checking proximity to
// existing nodes as it grows and deciding whether to connect or route
// around, not a separate "ring pass" bolted onto a rigid skeleton.
//
// This is now a Growing Tree maze algorithm (the well-known generalization
// of recursive-backtracker/Prim's-style maze generation: maintain a list of
// still-growable cells, repeatedly pick one — strategy determines
// character — and grow from it) adapted to continuous compass-direction
// space instead of a literal cell grid, with a proximity check before
// committing each new node (the same idea space-colonization-style
// procedural branching uses to keep branches from crossing each other).

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Radius fraction -> Zone, replacing the old grid algorithm's rectangular
// col/row banding with distance-from-core — a natural fit for a core-out
// layout either way.
function radiusZone(radius: number, maxRadius: number): Zone {
  const frac = maxRadius <= 0 ? 1 : radius / maxRadius;
  if (frac >= 0.85) return "edge";
  if (frac >= 0.5) return "mid";
  return "center";
}

// Radius is a *circular* measure but validator invariant 4's forbidden band
// is a *square* (fx/fy both in [0.3, 0.7]) — a diagonal-direction node can
// sit safely past the "mid" zone's radius threshold (0.5) while its absolute
// (fx, fy) position still falls inside that square, since the square's
// corners are farther from center (in Euclidean terms) than its edges. This
// mirrors the grid algorithm's own midZoneBoundaryAllowed safety check
// (same [0.2, 0.8] margin) — needed here for exactly the same reason: keep
// jitter/geometry from ever landing a boundary marker in forbidden territory.
function boundaryAllowedAt(gx: number, gy: number, gridSize: number): boolean {
  const fx = gridSize <= 1 ? 0.5 : gx / (gridSize - 1);
  const fy = gridSize <= 1 ? 0.5 : gy / (gridSize - 1);
  return fx < 0.2 || fx > 0.8 || fy < 0.2 || fy > 0.8;
}

// radialBranchChance now drives frontier selection strategy directly (the
// Growing Tree algorithm's defining knob): chance of picking a uniformly
// random frontier entry (Prim's-style — bushier, more branch points) versus
// the most-recently-added one (recursive-backtracker-style — long, winding,
// dead-end-rich single threads). An earlier version tried a separate
// "immediately grow another child" burst mechanic, but that turned out to
// be almost entirely redundant with always re-queuing the just-grown node
// (which the newest-first bias already picks back up right away most of the
// time) — no measurable effect on the result. Driving selection strategy
// directly gives a real, visible difference instead.
const INWARD_WEIGHT_FLOOR = 0.15; // soft floor so heading toward the center stays possible, just discouraged

export interface RadialResult {
  nodes: MapNode[];
  edges: MapEdge[];
  gridCols: number;
  gridRows: number;
}

export function generateRadial(params: GenerationParams, rng: RngFn): RadialResult {
  const initialArmCount = clamp(Math.round(params.radialSpokeCount), 1, 8);
  const { gridCols: side } = recommendedRadialGridDimensions(params.targetNodeCount);
  const center = (side - 1) / 2;
  const maxRadius = center;

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const nextLabel = createLabelGenerator();
  const civilianState = { cityOrAboveCount: 0 };

  // Cluster (hamlet) members are deliberately placed within a fraction of a
  // grid unit of each other — collision detection must not treat that
  // intentional closeness as a maze self-crossing, or every cluster member
  // finds its own sibling as "nearest" in virtually every direction and can
  // never grow further, which silently strangled the whole algorithm at
  // high radialClusterChance. Only populated for actual cluster members
  // (regular single-node children never appear here).
  const clusterGroupOf = new Map<string, string>();

  function radiusOf(gx: number, gy: number): number {
    return dist({ gx, gy }, { gx: center, gy: center });
  }

  function makeNode(type: NodeType, gx: number, gy: number): MapNode {
    const zone = radiusZone(radiusOf(gx, gy), maxRadius);
    const { subtype, boundary, coastal } = classifyNode(
      type,
      zone,
      boundaryAllowedAt(gx, gy, side),
      params,
      rng,
      civilianState
    );
    const node: MapNode = {
      id: crypto.randomUUID(),
      label: nextLabel(subtype),
      type,
      subtype,
      ...(boundary ? { boundary } : {}),
      ...(coastal ? { coastal: true } : {}),
      gx,
      gy,
    };
    nodes.push(node);
    return node;
  }

  function connect(a: MapNode, b: MapNode, direction: CompassDir): void {
    edges.push({
      id: crypto.randomUUID(),
      fromId: a.id,
      toId: b.id,
      direction,
      connectionType: connectionTypeFor(a, b, rng),
      checkRequired: false,
    });
  }

  // "Placement of the initial settlement in the middle of the board" is the
  // whole premise of this algorithm.
  const core = makeNode("settlement", center, center);

  // Exact-budget bag for the planned node count — same "shuffled bag hits
  // the target composition exactly" approach the grid algorithm uses. Any
  // node created beyond the bag's size (cluster/branch overshoot) draws from
  // pickNodeTypeWeighted instead — a live weighted roll rather than an
  // exact-budget draw.
  const plannedCount = Math.max(0, params.targetNodeCount - 1);
  const bias = params.nodeTypeBias;
  const totalWeight = bias.settlement + bias.wilderness + bias.poi;
  const settlementBudget = totalWeight > 0 ? Math.round(plannedCount * (bias.settlement / totalWeight)) : 0;
  const wildernessBudget = totalWeight > 0 ? Math.round(plannedCount * (bias.wilderness / totalWeight)) : 0;
  const poiBudget = Math.max(0, plannedCount - settlementBudget - wildernessBudget);
  const bag: NodeType[] = [
    ...Array(settlementBudget).fill("settlement" as NodeType),
    ...Array(wildernessBudget).fill("wilderness" as NodeType),
    ...Array(poiBudget).fill("poi" as NodeType),
  ];
  shuffle(rng, bag);
  let bagIndex = 0;
  const nextType = (): NodeType => bag[bagIndex++] ?? pickNodeTypeWeighted(rng, bias);

  const STEP = 1.0;
  const JITTER = 0.3;

  // [0, side-1] is exactly the coordinate range the canvas/exporter project
  // into their margins and the validator computes fx/fy fractions against —
  // letting growth spill past it (even by half a unit) clips nodes off the
  // rendered edge.
  function withinBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx <= side - 1 && gy >= 0 && gy <= side - 1;
  }

  // Unit-length step vector for a compass direction — dirToVector's raw
  // dx/dy are unit-ish but diagonal directions (dx=dy=±1) are sqrt(2) long,
  // which would make diagonal hops noticeably longer than cardinal ones.
  // Normalizing keeps growth geometrically uniform regardless of direction.
  function stepVector(dir: CompassDir): { dx: number; dy: number } {
    const v = dirToVector(dir);
    const mag = Math.hypot(v.dx, v.dy) || 1;
    return { dx: v.dx / mag, dy: v.dy / mag };
  }

  function candidatePosition(from: MapNode, dir: CompassDir): { gx: number; gy: number } {
    const v = stepVector(dir);
    return {
      gx: from.gx + v.dx * STEP + (rng() - 0.5) * JITTER,
      gy: from.gy + v.dy * STEP + (rng() - 0.5) * JITTER,
    };
  }

  // Weighted-random pick over every still-free direction at `from`, biased
  // only against pointing back at the center — never toward "continue the
  // way we've been going," which was the old algorithm's actual bug.
  function pickDirection(from: MapNode, candidates: CompassDir[]): CompassDir {
    const inward = radiusOf(from.gx, from.gy) < 0.01 ? null : dirBetween(from.gx, from.gy, center, center);
    const weights = candidates.map((d) => (inward ? INWARD_WEIGHT_FLOOR + circularDist(d, inward) : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // `from` is the node growing outward (its id, and — if it's a cluster
  // member — its shared group, are both excluded from counting as a
  // collision; see clusterGroupOf above).
  function nearestCollision(gx: number, gy: number, from: MapNode): MapNode | null {
    const group = clusterGroupOf.get(from.id);
    let nearest: MapNode | null = null;
    let nearestD = params.radialConvergenceRadius;
    for (const other of nodes) {
      if (other.id === from.id) continue;
      if (group && clusterGroupOf.get(other.id) === group) continue;
      const d = dist(other, { gx, gy });
      if (d < nearestD) {
        nearest = other;
        nearestD = d;
      }
    }
    return nearest;
  }

  function connectChanceAt(radius: number): number {
    return Math.max(0, params.radialCoreInterconnectivity * (1 - radius / maxRadius));
  }

  // Returns every node created — the primary (still connected to `from`)
  // plus every hamlet member — so all of them become growth points. Only
  // returning the primary was a real bug: it starved the frontier under high
  // radialClusterChance (fewer growable points added per successful step),
  // which is backwards from what a "more clustering" knob should do.
  function placeCluster(from: MapNode, gx: number, gy: number): MapNode[] {
    const clusterSize = rng() < 0.5 ? 2 : 3;
    const members: MapNode[] = [];
    for (let c = 0; c < clusterSize; c++) {
      const cx = gx + (rng() - 0.5) * 0.35;
      const cy = gy + (rng() - 0.5) * 0.35;
      members.push(makeNode(nextType(), cx, cy));
    }
    const groupId = members[0].id;
    for (const member of members) clusterGroupOf.set(member.id, groupId);
    const primary = members[0];
    const idealIn = dirBetween(from.gx, from.gy, primary.gx, primary.gy);
    connect(from, primary, bestAvailableDirection(from.id, primary.id, idealIn, edges));
    for (let c = 1; c < members.length; c++) {
      const member = members[c];
      const ideal = dirBetween(primary.gx, primary.gy, member.gx, member.gy);
      connect(primary, member, bestAvailableDirection(primary.id, member.id, ideal, edges));
    }
    return members;
  }

  // Attempts one growth step from `n`, trying its remaining free directions
  // (each one only once) until something succeeds or none do. Returns every
  // node that should become a new growth point (a single child, the far end
  // of an accepted collision-connect, or a whole cluster), or null if every
  // direction was exhausted without success (n is done growing, at least
  // for now).
  function tryGrowOnce(n: MapNode): MapNode[] | null {
    let candidates = freeDirections(n.id, edges);
    while (candidates.length > 0) {
      const dir = pickDirection(n, candidates);
      candidates = candidates.filter((d) => d !== dir);

      const { gx, gy } = candidatePosition(n, dir);
      if (!withinBounds(gx, gy)) continue;

      const nearby = nearestCollision(gx, gy, n);
      if (nearby) {
        // Already connected to it (most commonly: it's n's own parent,
        // sitting roughly a step away in the inward direction) — this
        // isn't a new connection opportunity, just try a different heading.
        if (hasEdgeBetween(n.id, nearby.id, edges)) continue;
        const radius = radiusOf(n.gx, n.gy);
        if (rng() >= connectChanceAt(radius)) continue; // declined — try another direction
        const ideal = dirBetween(n.gx, n.gy, nearby.gx, nearby.gy);
        const direction = jointlyFreeDirection(n.id, nearby.id, ideal, edges);
        if (!direction) continue; // no room at the other end either — try another direction
        connect(n, nearby, direction);
        return [nearby];
      }

      // Clear to place something new.
      if (rng() < params.radialClusterChance) {
        return placeCluster(n, gx, gy);
      }
      const child = makeNode(nextType(), gx, gy);
      connect(n, child, bestAvailableDirection(n.id, child.id, dir, edges));
      return [child];
    }
    return null; // every direction tried, nothing worked — n is done
  }

  // Seed the frontier with radialSpokeCount initial arms from the core —
  // "how many arms fan out from the hub," not a commitment to straight
  // continuation; every subsequent step uses the same general growth rule
  // as everywhere else.
  const dirsPool = [...ALL_DIRS];
  shuffle(rng, dirsPool);
  const initialDirs = dirsPool.slice(0, initialArmCount);
  const frontier: MapNode[] = [];
  for (const dir of initialDirs) {
    const { gx, gy } = candidatePosition(core, dir);
    if (!withinBounds(gx, gy)) continue;
    // No collision check here: arms fanning out from one hub are naturally
    // going to sit close together near it (adjacent 45°-apart directions at
    // radius ~1 are only ~0.77 units apart) — that's expected geometry, not
    // a maze self-crossing, so radialSpokeCount gets exactly the arm count
    // it asks for (within bounds) instead of most of them being silently
    // dropped as "collisions" with each other.
    const child = makeNode(nextType(), gx, gy);
    connect(core, child, bestAvailableDirection(core.id, child.id, dir, edges));
    frontier.push(child);
  }

  const guardLimit = Math.max(200, params.targetNodeCount * 60);
  let guard = 0;
  while (nodes.length < params.targetNodeCount && frontier.length > 0 && guard < guardLimit) {
    guard++;
    // radialBranchChance drives the pick: random entry (bushier, more branch
    // points, Prim's-style) vs. the most-recently-added one (long winding
    // single threads with more dead ends, recursive-backtracker-style).
    const index = rng() < params.radialBranchChance ? Math.floor(rng() * frontier.length) : frontier.length - 1;
    const [n] = frontier.splice(index, 1);

    const grown = tryGrowOnce(n);
    if (grown) {
      frontier.push(...grown);
      if (freeDirections(n.id, edges).length > 0) frontier.push(n);
    }
    // if grown is null, n had no viable direction left — drop it for good.
  }

  // Dead-end -> poi retyping: must happen on the skeleton exactly as grown
  // above, strictly before ensureMinimumDegree forces every node to degree
  // >= 2 below — a node's dead-end-ness is only knowable right here. "Paths
  // that lead nowhere tend to end at a point of interest."
  for (const node of nodes) {
    if (node.type === "poi") continue;
    if (degreeOf(node.id, edges) !== 1) continue;
    if (rng() >= params.radialDeadEndPoiBias) continue;
    if (node.type === "settlement" && (node.subtype === "city" || node.subtype === "metropolis")) {
      civilianState.cityOrAboveCount = Math.max(0, civilianState.cityOrAboveCount - 1);
    }
    node.type = "poi";
    node.subtype = randPick(rng, POI_KIND_VALUES);
    node.label = nextLabel(node.subtype);
  }

  const repaired = repairConnectivity(nodes, edges, rng);
  const finalEdges = ensureMinimumDegree(nodes, repaired, rng);

  return { nodes, edges: finalEdges, gridCols: side, gridRows: side };
}
