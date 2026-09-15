import { describe, expect, it } from "vitest";
import { buildPrototypeMap } from "../../src/core/prototypeMap";
import { validateMap } from "../../src/core/validator";
import type { GenerationParams, MapEdge, MapNode, WorldMap } from "../../src/types/map";

const BASE_PARAMS: GenerationParams = {
  seed: 1,
  placementAlgorithm: "grid",
  targetNodeCount: 4,
  gridCols: 10,
  gridRows: 8,
  radialSpokeCount: 6,
  radialCoreInterconnectivity: 0.5,
  radialBranchChance: 0.15,
  radialClusterChance: 0.1,
  radialDeadEndPoiBias: 0.6,
  radialConvergenceRadius: 1.5,
  radialInwardWeight: 0.15,
  radialFalloffExponent: 1,
  radialJitter: 0.3,
  radialRimFraction: 0.85,
  radialClusterMaxSize: 3,
  radialClusterSpread: 0.35,
  maxLargeSettlements: 2,
  roadFraction: 0.5,
  coastalChance: 0.05,
  interiorBoundaryDamping: 0.15,
  wildernessCheckMultiplier: 0.2,
  layoutRelaxStrength: 0.6,
  layoutNodeSpacing: 0.6,
  layoutDirectionWeight: 0.8,
  nodeTypeBias: { settlement: 0.2, wilderness: 0.55, poi: 0.25 },
  wildernessWaterFraction: 0.15,
  settlementOutpostFraction: 0.25,
  biomeMix: { forest: 0.3, swamp: 0.15, plains: 0.25, desert: 0.1, tundra: 0.1, jungle: 0.1 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  boundaryFraction: 0.7,
  generateTerrainZones: false,
};

function node(overrides: Partial<MapNode> & Pick<MapNode, "id" | "label" | "type" | "gx" | "gy">): MapNode {
  return overrides;
}

function edge(overrides: Partial<MapEdge> & Pick<MapEdge, "id" | "fromId" | "toId" | "direction">): MapEdge {
  return { connectionType: "trail", checkRequired: false, ...overrides };
}

function baseMap(nodes: MapNode[], edges: MapEdge[]): WorldMap {
  const now = new Date().toISOString();
  return {
    id: "test-map",
    name: "Test Map",
    nodes,
    edges,
    extensions: {},
    params: BASE_PARAMS,
    algorithmVersion: "1.0.0",
    createdAt: now,
    updatedAt: now,
  };
}

// A small, hand-built map that satisfies every invariant — used as the
// "known-good" baseline that each violation test perturbs.
function validQuad(): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = [
    node({ id: "a", label: "A", type: "settlement", gx: 0, gy: 0 }),
    node({ id: "b", label: "B", type: "wilderness", gx: 1, gy: 0 }),
    node({ id: "c", label: "C", type: "wilderness", gx: 1, gy: 1 }),
    node({ id: "d", label: "D", type: "settlement", gx: 0, gy: 1 }),
  ];
  const edges: MapEdge[] = [
    edge({ id: "e1", fromId: "a", toId: "b", direction: "E" }),
    edge({ id: "e2", fromId: "b", toId: "c", direction: "S" }),
    edge({ id: "e3", fromId: "c", toId: "d", direction: "W" }),
    edge({ id: "e4", fromId: "d", toId: "a", direction: "N" }),
  ];
  return { nodes, edges };
}

describe("validateMap", () => {
  it("returns no violations for a valid hand-built map", () => {
    const { nodes, edges } = validQuad();
    expect(validateMap(baseMap(nodes, edges))).toEqual([]);
  });

  it("returns no hard-invariant violations for the prototype reference map", () => {
    // The prototype is a hand-drawn map, not generator output, and it does
    // trip the warn-only direction-symmetry rule (invariant 7) in ~20 spots —
    // e.g. two connections both resolving to the same compass direction from
    // a given node. Spec Section 9 explicitly marks that rule "warn only, do
    // not reject", so this checks the six blocking invariants only.
    const map = buildPrototypeMap();
    const hardViolations = validateMap(map).filter((v) => v.rule !== "direction-symmetry");
    expect(hardViolations).toEqual([]);
  });

  it("flags one-direction-per-node when a node has two outgoing edges in the same direction", () => {
    const { nodes, edges } = validQuad();
    edges.push(edge({ id: "e5", fromId: "a", toId: "c", direction: "E" }));
    const violations = validateMap(baseMap(nodes, edges));
    expect(violations.some((v) => v.rule === "one-direction-per-node")).toBe(true);
  });

  it("flags no-duplicate-pairs when two edges connect the same pair of nodes", () => {
    const { nodes, edges } = validQuad();
    edges.push(edge({ id: "e5", fromId: "b", toId: "a", direction: "W" }));
    const violations = validateMap(baseMap(nodes, edges));
    expect(violations.some((v) => v.rule === "no-duplicate-pairs")).toBe(true);
  });

  it("flags fully-connected when a node is unreachable", () => {
    const { nodes, edges } = validQuad();
    nodes.push(node({ id: "e", label: "E", type: "wilderness", gx: 5, gy: 5 }));
    const violations = validateMap(baseMap(nodes, edges));
    const v = violations.find((x) => x.rule === "fully-connected");
    expect(v).toBeDefined();
    expect(v?.nodeId).toBe("e");
  });

  it("flags boundary-placement when a boundary-marked node sits in the inner 40% of the grid", () => {
    const { nodes, edges } = validQuad();
    // gridCols=10, gridRows=8 (BASE_PARAMS) -> inner band is gx in [3,7], gy in [2.1,4.9]
    nodes[1] = { ...nodes[1], boundary: { reason: "mountain_range" }, gx: 5, gy: 3.5 };
    const violations = validateMap(baseMap(nodes, edges));
    expect(violations.some((v) => v.rule === "boundary-placement")).toBe(true);
  });

  it("flags minimum-exits when a node has fewer than 2 edges", () => {
    const { nodes, edges } = validQuad();
    const trimmed = edges.filter((e) => e.id !== "e4"); // leaves "d" and "a" with 1 edge each
    const violations = validateMap(baseMap(nodes, trimmed));
    expect(violations.some((v) => v.rule === "minimum-exits")).toBe(true);
  });

  it("flags no-stranded-check-required when a node's only edges are all check-required", () => {
    const { nodes, edges } = validQuad();
    const marked = edges.map((e) => (e.fromId === "a" || e.toId === "a" ? { ...e, checkRequired: true } : e));
    const violations = validateMap(baseMap(nodes, marked));
    expect(violations.some((v) => v.rule === "no-stranded-check-required" && v.nodeId === "a")).toBe(true);
  });

  it("flags direction-symmetry when an outgoing edge collides with an incoming edge's implied direction", () => {
    const { nodes, edges } = validQuad();
    // e4 is d->a with direction N, so from a's perspective (a is toId) that
    // edge implies S. Add a distinct node "f" and an outgoing a->f edge that
    // also resolves to S from a's perspective — a genuine mixed collision,
    // not a duplicate of the a-d pair.
    nodes.push(node({ id: "f", label: "F", type: "wilderness", gx: 0, gy: 5 }));
    edges.push(edge({ id: "e5", fromId: "a", toId: "f", direction: "S" }));
    const violations = validateMap(baseMap(nodes, edges));
    expect(violations.some((v) => v.rule === "direction-symmetry" && v.nodeId === "a")).toBe(true);
    // This should NOT also be reported as one-direction-per-node (that rule
    // only covers two outgoing/fromId edges sharing a direction).
    expect(
      violations.some((v) => v.rule === "one-direction-per-node" && v.nodeId === "a")
    ).toBe(false);
  });
});
