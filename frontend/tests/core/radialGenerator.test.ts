import { describe, expect, it } from "vitest";
import { oppositeDir } from "../../src/core/compass";
import { generateMap } from "../../src/core/generator";
import { validateMap } from "../../src/core/validator";
import type { CompassDir, GenerationParams, WorldMap } from "../../src/types/map";

const RADIAL_PARAMS: GenerationParams = {
  seed: 42,
  placementAlgorithm: "radial",
  targetNodeCount: 41,
  // gridCols/gridRows are deliberately "wrong" here — radial mode derives
  // its own grid size from targetNodeCount/radialSpokeCount and must
  // override these on the returned map, never read them as input.
  gridCols: 999,
  gridRows: 999,
  radialSpokeCount: 8,
  radialCoreInterconnectivity: 0.5,
  radialBranchChance: 0.15,
  radialClusterChance: 0.1,
  radialDeadEndPoiBias: 0.6,
  radialConvergenceRadius: 1.5,
  nodeTypeBias: { settlement: 0.2, wilderness: 0.55, poi: 0.25 },
  wildernessWaterFraction: 0.15,
  settlementOutpostFraction: 0.25,
  biomeMix: { forest: 0.3, swamp: 0.15, plains: 0.25, desert: 0.1, tundra: 0.1, jungle: 0.1 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  boundaryFraction: 0.7,
  generateTerrainZones: false,
};

// Mirrors generator.test.ts's normalize() helper.
function normalize(map: WorldMap) {
  const indexOf = new Map(map.nodes.map((n, i) => [n.id, i]));
  return {
    nodes: map.nodes.map((n) => ({ label: n.label, type: n.type, subtype: n.subtype, boundary: n.boundary, coastal: n.coastal, gx: n.gx, gy: n.gy })),
    edges: map.edges.map((e) => ({
      from: indexOf.get(e.fromId),
      to: indexOf.get(e.toId),
      direction: e.direction,
      connectionType: e.connectionType,
      checkRequired: e.checkRequired,
      checkType: e.checkType,
    })),
  };
}

describe("generateMap (radial)", () => {
  it("produces identical structural output for the same seed and params (run 3 times)", () => {
    const a = normalize(generateMap(RADIAL_PARAMS));
    const b = normalize(generateMap({ ...RADIAL_PARAMS }));
    const c = normalize(generateMap({ ...RADIAL_PARAMS }));
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  it("produces a different map when only the seed changes", () => {
    const a = normalize(generateMap(RADIAL_PARAMS));
    const b = normalize(generateMap({ ...RADIAL_PARAMS, seed: RADIAL_PARAMS.seed + 1 }));
    expect(a).not.toEqual(b);
  });

  it("derives its own grid size (by area, from node count) and overrides whatever gridCols/gridRows were passed in", () => {
    // ceil(sqrt(41)) * 2 = 14, forced odd (a true center cell for the core) -> 15
    const map = generateMap(RADIAL_PARAMS);
    expect(map.params.gridCols).toBe(15);
    expect(map.params.gridRows).toBe(15);
  });

  it("sizes the grid from node count alone — arm count doesn't change the area needed", () => {
    const fewArms = generateMap({ ...RADIAL_PARAMS, radialSpokeCount: 2 });
    const manyArms = generateMap({ ...RADIAL_PARAMS, radialSpokeCount: 8 });
    expect(fewArms.params.gridCols).toBe(manyArms.params.gridCols);
  });

  it("places exactly one settlement node at the exact, unjittered grid center", () => {
    const map = generateMap(RADIAL_PARAMS);
    const center = (map.params.gridCols - 1) / 2;
    const atCenter = map.nodes.filter((n) => n.gx === center && n.gy === center);
    expect(atCenter).toHaveLength(1);
    expect(atCenter[0].type).toBe("settlement");
  });

  it("passes all validator invariants across a range of seeds, spoke counts, and node counts", () => {
    const seeds = [1, 2, 3, 42, 999, 123456];
    for (const seed of seeds) {
      for (const radialSpokeCount of [1, 3, 6, 8]) {
        for (const targetNodeCount of [20, 41, 80]) {
          const map = generateMap({ ...RADIAL_PARAMS, seed, radialSpokeCount, targetNodeCount });
          expect(validateMap(map)).toEqual([]);
        }
      }
    }
  });

  it("assigns a Tier 2 subtype to every node, same as the grid algorithm", () => {
    const map = generateMap(RADIAL_PARAMS);
    for (const node of map.nodes) {
      expect(node.subtype).toBeDefined();
    }
  });

  it("sets the current algorithm version", () => {
    const map = generateMap(RADIAL_PARAMS);
    expect(map.algorithmVersion).toBe("2.3.0");
  });

  it("does not prefer continuing straight through a node (regression — the M4.8 bug)", () => {
    // The first implementation snapped every step toward "keep going the
    // way this spoke started," so a pass-through node's two exits (from its
    // own perspective) were opposite compass directions almost every time —
    // a dead giveaway of a straight ray. Direction choice here has no term
    // for "match the incoming heading" at all, so for a degree-2 node the
    // fraction whose two exits happen to be exactly opposite should sit
    // near the pure-chance baseline (~1/7, since 1 of the 7 remaining free
    // directions is "opposite the one just used") — nowhere near "almost
    // every time."
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let straight = 0;
    let total = 0;
    for (const seed of seeds) {
      const map = generateMap({ ...RADIAL_PARAMS, seed, targetNodeCount: 60 });
      const dirsByNode = new Map<string, CompassDir[]>();
      for (const e of map.edges) {
        const fromDirs = dirsByNode.get(e.fromId) ?? [];
        fromDirs.push(e.direction);
        dirsByNode.set(e.fromId, fromDirs);
        const toDirs = dirsByNode.get(e.toId) ?? [];
        toDirs.push(oppositeDir(e.direction));
        dirsByNode.set(e.toId, toDirs);
      }
      for (const dirs of dirsByNode.values()) {
        if (dirs.length !== 2) continue; // only plain pass-through nodes are meaningful here
        total++;
        if (oppositeDir(dirs[0]) === dirs[1]) straight++;
      }
    }
    expect(total).toBeGreaterThan(50); // sanity: the sample is big enough to mean something
    expect(straight / total).toBeLessThan(0.35); // well below "almost always" (was ~1.0 pre-fix), close to chance (~0.14)
  });

  describe("radialCoreInterconnectivity", () => {
    it("higher values produce more total edges on average across seeds (ring connections are additive)", () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let lowTotal = 0;
      let highTotal = 0;
      for (const seed of seeds) {
        const low = generateMap({ ...RADIAL_PARAMS, seed, radialCoreInterconnectivity: 0, radialBranchChance: 0, radialClusterChance: 0 });
        const high = generateMap({ ...RADIAL_PARAMS, seed, radialCoreInterconnectivity: 1, radialBranchChance: 0, radialClusterChance: 0 });
        lowTotal += low.edges.length;
        highTotal += high.edges.length;
      }
      expect(highTotal).toBeGreaterThan(lowTotal);
    });
  });

  describe("radialBranchChance", () => {
    // radialBranchChance drives frontier-selection strategy (the Growing
    // Tree algorithm's defining knob): 0 always picks the newest frontier
    // entry (recursive-backtracker-style — long winding single threads),
    // 1 always picks a random entry (Prim's-style — bushier, more branch
    // points). Final node count reliably hits ~targetNodeCount either way
    // (the outer loop stops right at target), so "more nodes" isn't a
    // meaningful signal here — branch-point count (nodes with 3+ edges) is.
    function branchPointCount(map: ReturnType<typeof generateMap>) {
      const degree = new Map<string, number>();
      for (const e of map.edges) {
        degree.set(e.fromId, (degree.get(e.fromId) ?? 0) + 1);
        degree.set(e.toId, (degree.get(e.toId) ?? 0) + 1);
      }
      return [...degree.values()].filter((d) => d >= 3).length;
    }

    it("higher values produce more branch points on average across seeds (bushier growth)", () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let lowTotal = 0;
      let highTotal = 0;
      for (const seed of seeds) {
        const low = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 0, radialClusterChance: 0 });
        const high = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 1, radialClusterChance: 0 });
        lowTotal += branchPointCount(low);
        highTotal += branchPointCount(high);
      }
      expect(highTotal).toBeGreaterThan(lowTotal);
    });
  });

  describe("radialClusterChance", () => {
    it("higher values produce more nodes on average across seeds (clusters add nodes)", () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let lowTotal = 0;
      let highTotal = 0;
      for (const seed of seeds) {
        const low = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 0, radialClusterChance: 0 });
        const high = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 0, radialClusterChance: 1 });
        lowTotal += low.nodes.length;
        highTotal += high.nodes.length;
      }
      expect(highTotal).toBeGreaterThan(lowTotal);
    });
  });

  describe("radialDeadEndPoiBias", () => {
    it("retypes a genuine dead end to poi when set to 1, and leaves it alone when set to 0", () => {
      // A single spoke with no rings/branches/clusters/convergence guarantees
      // the outermost node is a true degree-1 dead end before the min-degree
      // top-up runs. poi weight is 0 so the bag can never assign poi on its
      // own — any poi at the tip must be the retype step's doing.
      const single: GenerationParams = {
        ...RADIAL_PARAMS,
        radialSpokeCount: 1,
        radialCoreInterconnectivity: 0,
        radialBranchChance: 0,
        radialClusterChance: 0,
        radialConvergenceRadius: 0.5,
        nodeTypeBias: { settlement: 0.5, wilderness: 0.5, poi: 0 },
      };

      function findTip(map: WorldMap) {
        const center = (map.params.gridCols - 1) / 2;
        return map.nodes.reduce((farthest, n) =>
          Math.hypot(n.gx - center, n.gy - center) > Math.hypot(farthest.gx - center, farthest.gy - center) ? n : farthest
        );
      }

      const biased = generateMap({ ...single, radialDeadEndPoiBias: 1 });
      expect(findTip(biased).type).toBe("poi");

      const unbiased = generateMap({ ...single, radialDeadEndPoiBias: 0 });
      expect(findTip(unbiased).type).not.toBe("poi");
    });
  });
});
