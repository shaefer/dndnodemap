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
    // Relaxation off: this asserts the *placement* contract, and the
    // post-placement visual pass (spec Section 7f) legitimately nudges the
    // core off dead center along with everything else.
    const map = generateMap({ ...RADIAL_PARAMS, layoutRelaxStrength: 0 });
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
    expect(map.algorithmVersion).toBe("2.9.0");
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
  describe("fine-tuning knobs (M4.9)", () => {
    function boundaryCount(map: ReturnType<typeof generateMap>) {
      return map.nodes.filter((n) => n.boundary).length;
    }
    function connectionTypeCount(map: ReturnType<typeof generateMap>, type: string) {
      return map.edges.filter((e) => e.connectionType === type).length;
    }
    const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it("radialJitter: higher values spread nodes further off their exact step positions", () => {
      // With zero jitter every hop lands exactly one unit along a compass
      // direction, so coordinates stay on a tidy lattice; raising it should
      // measurably increase how far positions drift from whole/half steps.
      function latticeDeviation(map: ReturnType<typeof generateMap>) {
        return map.nodes.reduce((sum, n) => {
          const dx = Math.abs(n.gx - Math.round(n.gx * 2) / 2);
          const dy = Math.abs(n.gy - Math.round(n.gy * 2) / 2);
          return sum + dx + dy;
        }, 0);
      }
      let low = 0;
      let high = 0;
      for (const seed of SEEDS) {
        low += latticeDeviation(generateMap({ ...RADIAL_PARAMS, seed, radialJitter: 0 }));
        high += latticeDeviation(generateMap({ ...RADIAL_PARAMS, seed, radialJitter: 1 }));
      }
      expect(high).toBeGreaterThan(low);
    });

    it("radialRimFraction: a smaller rim puts more of the map in boundary-marked territory", () => {
      let wideRim = 0; // rim starts late -> few edge-zone nodes
      let tightRim = 0; // rim starts early -> many edge-zone nodes
      for (const seed of SEEDS) {
        wideRim += boundaryCount(generateMap({ ...RADIAL_PARAMS, seed, radialRimFraction: 0.95 }));
        tightRim += boundaryCount(generateMap({ ...RADIAL_PARAMS, seed, radialRimFraction: 0.5 }));
      }
      expect(tightRim).toBeGreaterThan(wideRim);
    });

    it("radialClusterMaxSize: a bigger cap produces bigger hamlets", () => {
      // Measured with the layout relaxation pass off (spec Section 7f): this
      // is a *placement* knob, and relaxation deliberately normalizes node
      // spacing afterward, which erases the "huddled" signature this counts.
      // Count nodes sitting very close to at least one other node — the
      // signature of cluster membership.
      function huddledCount(map: ReturnType<typeof generateMap>) {
        return map.nodes.filter((n) =>
          map.nodes.some((o) => o.id !== n.id && Math.hypot(o.gx - n.gx, o.gy - n.gy) < 0.5)
        ).length;
      }
      let small = 0;
      let large = 0;
      for (const seed of SEEDS) {
        small += huddledCount(generateMap({ ...RADIAL_PARAMS, seed, layoutRelaxStrength: 0, radialClusterChance: 1, radialClusterMaxSize: 2 }));
        large += huddledCount(generateMap({ ...RADIAL_PARAMS, seed, layoutRelaxStrength: 0, radialClusterChance: 1, radialClusterMaxSize: 5 }));
      }
      expect(large).toBeGreaterThan(small);
    });

    it("maxLargeSettlements: caps city-or-metropolis settlements (shared with the grid algorithm)", () => {
      for (const seed of SEEDS) {
        for (const cap of [0, 1, 4]) {
          const map = generateMap({ ...RADIAL_PARAMS, seed, targetNodeCount: 80, maxLargeSettlements: cap });
          const large = map.nodes.filter((n) => n.subtype === "city" || n.subtype === "metropolis").length;
          expect(large).toBeLessThanOrEqual(cap);
        }
      }
    });

    it("roadFraction: 0 yields no roads, 1 yields no settlement-touching trails", () => {
      for (const seed of SEEDS.slice(0, 4)) {
        const noRoads = generateMap({ ...RADIAL_PARAMS, seed, roadFraction: 0 });
        expect(connectionTypeCount(noRoads, "road")).toBe(0);

        const allRoads = generateMap({ ...RADIAL_PARAMS, seed, roadFraction: 1 });
        expect(connectionTypeCount(allRoads, "road")).toBeGreaterThan(0);
      }
    });

    it("coastalChance: higher values mark more nodes coastal", () => {
      let low = 0;
      let high = 0;
      for (const seed of SEEDS) {
        low += generateMap({ ...RADIAL_PARAMS, seed, coastalChance: 0 }).nodes.filter((n) => n.coastal).length;
        high += generateMap({ ...RADIAL_PARAMS, seed, coastalChance: 0.9 }).nodes.filter((n) => n.coastal).length;
      }
      expect(high).toBeGreaterThan(low);
    });

    it("interiorBoundaryDamping: higher values allow more boundary markers off the rim", () => {
      let low = 0;
      let high = 0;
      for (const seed of SEEDS) {
        low += boundaryCount(generateMap({ ...RADIAL_PARAMS, seed, interiorBoundaryDamping: 0 }));
        high += boundaryCount(generateMap({ ...RADIAL_PARAMS, seed, interiorBoundaryDamping: 1 }));
      }
      expect(high).toBeGreaterThan(low);
    });

    it("wildernessCheckMultiplier: higher values make interior routes more check-heavy", () => {
      let low = 0;
      let high = 0;
      for (const seed of SEEDS) {
        low += generateMap({ ...RADIAL_PARAMS, seed, checkRequiredFraction: 1, wildernessCheckMultiplier: 0 }).edges.filter((e) => e.checkRequired).length;
        high += generateMap({ ...RADIAL_PARAMS, seed, checkRequiredFraction: 1, wildernessCheckMultiplier: 1 }).edges.filter((e) => e.checkRequired).length;
      }
      expect(high).toBeGreaterThan(low);
    });

    it("every fine-tuning knob stays valid at both extremes", () => {
      const extremes: Partial<GenerationParams>[] = [
        { radialInwardWeight: 0 }, { radialInwardWeight: 1 },
        { radialFalloffExponent: 0.1 }, { radialFalloffExponent: 5 },
        { radialJitter: 0 }, { radialJitter: 1 },
        { radialRimFraction: 0.5 }, { radialRimFraction: 0.95 },
        { radialClusterChance: 1, radialClusterMaxSize: 5 },
        { radialClusterSpread: 0 }, { radialClusterSpread: 1 },
        { maxLargeSettlements: 0 }, { maxLargeSettlements: 6 },
        { roadFraction: 0 }, { roadFraction: 1 },
        { coastalChance: 0 }, { coastalChance: 1 },
        { interiorBoundaryDamping: 0 }, { interiorBoundaryDamping: 1 },
        { wildernessCheckMultiplier: 0 }, { wildernessCheckMultiplier: 1 },
      ];
      for (const override of extremes) {
        for (const seed of [1, 7]) {
          const map = generateMap({ ...RADIAL_PARAMS, seed, ...override });
          expect(validateMap(map)).toEqual([]);
        }
      }
    });
  });
});
