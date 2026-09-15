import type { CompassDir, GenerationParams, MapEdge, MapNode, NodeType } from "../types/map";
import { ALL_DIRS, dirBetween, dirToVector } from "./compass";
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
  targetDegreeFor,
  type Zone,
} from "./generationShared";
import { randPick, shuffle, type RngFn } from "./rng";

// The "radial" (core-out) placement algorithm (spec Section 7e): a core
// settlement sits at the exact center of the grid; spokes (one per chosen
// CompassDir) grow outward as backbone chains, with lateral ring connections
// between neighboring spokes that taper off with distance from the core, and
// a final convergence pass connecting nodes from different spokes that ended
// up geometrically close. See core/generationShared.ts for the
// geometry-agnostic classification/connectivity helpers this shares with
// core/generator.ts's "grid" path — nothing in this file duplicates that
// logic, and nothing here is imported back into generator.ts except this
// module's own generateRadial entry point (one-directional dependency, no
// cycle).

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Radius fraction -> Zone, replacing the grid algorithm's rectangular
// col/row banding with distance-from-core — a more natural fit here, and one
// that needs no separate "is this too close to the forbidden band" safety
// check the way the grid algorithm's midZoneBoundaryAllowed provides, since
// the thresholds themselves already carry enough margin.
function radiusZone(radius: number, stepsPerSpoke: number): Zone {
  const frac = stepsPerSpoke <= 0 ? 1 : radius / stepsPerSpoke;
  if (frac >= 0.85) return "edge";
  if (frac >= 0.5) return "mid";
  return "center";
}

export interface RadialResult {
  nodes: MapNode[];
  edges: MapEdge[];
  gridCols: number;
  gridRows: number;
}

export function generateRadial(params: GenerationParams, rng: RngFn): RadialResult {
  const spokeCount = clamp(Math.round(params.radialSpokeCount), 1, 8);
  const { gridCols: side } = recommendedRadialGridDimensions(params.targetNodeCount, spokeCount);
  const stepsPerSpoke = (side - 1) / 2;
  const center = stepsPerSpoke;

  const dirsPool = [...ALL_DIRS];
  shuffle(rng, dirsPool);
  const spokeDirs = dirsPool.slice(0, spokeCount);

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const nextLabel = createLabelGenerator();
  const civilianState = { cityOrAboveCount: 0 };

  function makeNode(type: NodeType, zone: Zone, gx: number, gy: number): MapNode {
    const { subtype, boundary, coastal } = classifyNode(type, zone, true, params, rng, civilianState);
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
  const core = makeNode("settlement", "center", center, center);

  // Exact-budget bag for the planned backbone nodes (one per spoke per
  // radius step) — same "shuffled bag hits the target composition exactly"
  // approach the grid algorithm uses, since the backbone's total count is
  // known up front. Nodes created afterward by branchChance/clusterChance
  // (an unknown quantity ahead of time) draw from pickNodeTypeWeighted
  // instead — a live weighted roll rather than an exact-budget draw.
  const backboneCount = spokeDirs.length * stepsPerSpoke;
  const bias = params.nodeTypeBias;
  const totalWeight = bias.settlement + bias.wilderness + bias.poi;
  const settlementBudget = totalWeight > 0 ? Math.round(backboneCount * (bias.settlement / totalWeight)) : 0;
  const wildernessBudget = totalWeight > 0 ? Math.round(backboneCount * (bias.wilderness / totalWeight)) : 0;
  const poiBudget = Math.max(0, backboneCount - settlementBudget - wildernessBudget);
  const bag: NodeType[] = [
    ...Array(settlementBudget).fill("settlement" as NodeType),
    ...Array(wildernessBudget).fill("wilderness" as NodeType),
    ...Array(poiBudget).fill("poi" as NodeType),
  ];
  shuffle(rng, bag);
  let bagIndex = 0;
  const nextBackboneType = (): NodeType => bag[bagIndex++] ?? "wilderness";

  // Per-spoke bookkeeping: the outermost node placed so far (for backbone
  // continuation) and a lookup of every node placed at each (dir, radius) —
  // the latter feeds the ring-connection pass below.
  const tip = new Map<CompassDir, MapNode>();
  const atRadius = new Map<string, MapNode>(); // key `${dir}|${radius}`
  for (const dir of spokeDirs) tip.set(dir, core);

  for (let r = 1; r <= stepsPerSpoke; r++) {
    const zone = radiusZone(r, stepsPerSpoke);

    for (const dir of spokeDirs) {
      const vec = dirToVector(dir);
      const gx = center + vec.dx * r + (rng() - 0.5) * 0.5;
      const gy = center + vec.dy * r + (rng() - 0.5) * 0.5;

      let primary: MapNode;
      if (rng() < params.radialClusterChance) {
        // Hamlet cluster: 2-3 nodes huddled tightly at this ring position.
        // The first continues the spoke outward; the rest just connect back
        // into it as short local edges — the "grouped settlements" knob.
        const clusterSize = rng() < 0.5 ? 2 : 3;
        const clusterNodes: MapNode[] = [];
        for (let c = 0; c < clusterSize; c++) {
          const cx = gx + (rng() - 0.5) * 0.35;
          const cy = gy + (rng() - 0.5) * 0.35;
          clusterNodes.push(makeNode(nextBackboneType(), zone, cx, cy));
        }
        primary = clusterNodes[0];
        const prev = tip.get(dir)!;
        const idealToPrimary = dirBetween(prev.gx, prev.gy, primary.gx, primary.gy);
        connect(prev, primary, bestAvailableDirection(prev.id, primary.id, idealToPrimary, edges));
        for (let c = 1; c < clusterNodes.length; c++) {
          const member = clusterNodes[c];
          const ideal = dirBetween(primary.gx, primary.gy, member.gx, member.gy);
          connect(primary, member, bestAvailableDirection(primary.id, member.id, ideal, edges));
        }
      } else {
        primary = makeNode(nextBackboneType(), zone, gx, gy);
        const prev = tip.get(dir)!;
        const ideal = dirBetween(prev.gx, prev.gy, primary.gx, primary.gy);
        connect(prev, primary, bestAvailableDirection(prev.id, primary.id, ideal, edges));
      }

      tip.set(dir, primary);
      atRadius.set(`${dir}|${r}`, primary);

      // Branch: an organic fork off the just-placed backbone node, heading
      // toward one of dir's two neighboring compass directions instead of
      // continuing straight along the spoke.
      if (rng() < params.radialBranchChance) {
        const dirIndex = ALL_DIRS.indexOf(dir);
        const neighborDir = ALL_DIRS[(dirIndex + (rng() < 0.5 ? 1 : 7)) % 8];
        const nv = dirToVector(neighborDir);
        const bx = primary.gx + nv.dx * 0.8 + (rng() - 0.5) * 0.35;
        const by = primary.gy + nv.dy * 0.8 + (rng() - 0.5) * 0.35;
        const branchNode = makeNode(pickNodeTypeWeighted(rng, params.nodeTypeBias), zone, bx, by);
        const ideal = dirBetween(primary.gx, primary.gy, branchNode.gx, branchNode.gy);
        connect(primary, branchNode, bestAvailableDirection(primary.id, branchNode.id, ideal, edges));
      }
    }

    // Ring connections at this radius: adjacent spokes taper off with
    // distance from the core — this is the algorithm's core interconnectivity
    // behavior, not a variant. Skippable (no forced fallback direction) since
    // it's a bonus connection, not structural.
    const ringChance = Math.max(0, params.radialCoreInterconnectivity * (1 - r / stepsPerSpoke));
    if (ringChance > 0) {
      for (let i = 0; i < spokeDirs.length; i++) {
        for (let j = i + 1; j < spokeDirs.length; j++) {
          const dirA = spokeDirs[i];
          const dirB = spokeDirs[j];
          if (circularDist(dirA, dirB) !== 1) continue; // only true geometric neighbors ring-connect
          const nodeA = atRadius.get(`${dirA}|${r}`);
          const nodeB = atRadius.get(`${dirB}|${r}`);
          if (!nodeA || !nodeB) continue;
          if (hasEdgeBetween(nodeA.id, nodeB.id, edges)) continue;
          if (rng() >= ringChance) continue;
          const ideal = dirBetween(nodeA.gx, nodeA.gy, nodeB.gx, nodeB.gy);
          const direction = jointlyFreeDirection(nodeA.id, nodeB.id, ideal, edges);
          if (!direction) continue;
          connect(nodeA, nodeB, direction);
        }
      }
    }
  }

  // Convergence pass: nodes from different spokes that ended up
  // geometrically close despite growing independently get an extra
  // connection where one doesn't already exist — also core behavior, not a
  // variant. Distance-weighted acceptance mirrors buildEdgesGrid's own
  // candidate/acceptance pattern; targetDegreeFor keeps this pass from
  // unboundedly stacking degree beyond what edgeDensity already implies.
  const targetDegree = targetDegreeFor(params);
  const convergenceOrder = [...nodes];
  shuffle(rng, convergenceOrder);
  for (const a of convergenceOrder) {
    if (degreeOf(a.id, edges) >= targetDegree) continue;
    const candidates = nodes
      .filter((b) => b.id !== a.id && !hasEdgeBetween(a.id, b.id, edges) && dist(a, b) <= params.radialConvergenceRadius)
      .sort((x, y) => dist(a, x) - dist(a, y));
    for (const b of candidates) {
      if (degreeOf(a.id, edges) >= targetDegree) break;
      if (degreeOf(b.id, edges) >= targetDegree) continue;
      const ideal = dirBetween(a.gx, a.gy, b.gx, b.gy);
      const direction = jointlyFreeDirection(a.id, b.id, ideal, edges);
      if (!direction) continue;
      const acceptProb = Math.max(0.15, 1 - dist(a, b) / params.radialConvergenceRadius);
      if (rng() >= acceptProb) continue;
      connect(a, b, direction);
    }
  }

  // Dead-end -> poi retyping: must happen on the skeleton exactly as built
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
