import { describe, expect, it } from "vitest";
import { generateMap } from "../../src/core/generator";
import { validateMap } from "../../src/core/validator";
import type { GenerationParams, WorldMap } from "../../src/types/map";

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

  it("derives its own grid size and overrides whatever gridCols/gridRows were passed in", () => {
    // stepsPerSpoke = ceil((41-1)/8) = 5 -> side = 2*5+1 = 11
    const map = generateMap(RADIAL_PARAMS);
    expect(map.params.gridCols).toBe(11);
    expect(map.params.gridRows).toBe(11);
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
    expect(map.algorithmVersion).toBe("2.2.0");
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
    it("higher values produce more nodes on average across seeds (branches add nodes)", () => {
      const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      let lowTotal = 0;
      let highTotal = 0;
      for (const seed of seeds) {
        const low = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 0, radialClusterChance: 0 });
        const high = generateMap({ ...RADIAL_PARAMS, seed, radialBranchChance: 1, radialClusterChance: 0 });
        lowTotal += low.nodes.length;
        highTotal += high.nodes.length;
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
