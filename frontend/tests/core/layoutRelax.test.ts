import { describe, expect, it } from "vitest";
import { dirToVector } from "../../src/core/compass";
import { generateMap } from "../../src/core/generator";
import { validateMap } from "../../src/core/validator";
import type { GenerationParams, PlacementAlgorithm, WorldMap } from "../../src/types/map";

const BASE: GenerationParams = {
  seed: 12345,
  placementAlgorithm: "grid",
  targetNodeCount: 49,
  gridCols: 14,
  gridRows: 14,
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

const SEEDS = [1, 2, 3, 42, 99, 777, 4242, 31337];
const ALGORITHMS: PlacementAlgorithm[] = ["grid", "radial"];

// Mean absolute angular error (radians) between each edge's declared
// CompassDir and the bearing its endpoints actually describe. This is the
// number the relaxation pass exists to reduce.
function meanDirectionError(map: WorldMap): number {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  let total = 0;
  let count = 0;
  for (const edge of map.edges) {
    const from = byId.get(edge.fromId);
    const to = byId.get(edge.toId);
    if (!from || !to) continue;
    const vx = to.gx - from.gx;
    const vy = to.gy - from.gy;
    if (Math.hypot(vx, vy) < 1e-9) continue;
    const ideal = dirToVector(edge.direction);
    // Angle between the actual edge vector and the declared direction.
    const actualAngle = Math.atan2(vy, vx);
    const idealAngle = Math.atan2(ideal.dy, ideal.dx);
    let diff = Math.abs(actualAngle - idealAngle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    total += diff;
    count++;
  }
  return count === 0 ? 0 : total / count;
}

function crowdedPairCount(map: WorldMap, threshold: number): number {
  let count = 0;
  for (let i = 0; i < map.nodes.length; i++) {
    for (let j = i + 1; j < map.nodes.length; j++) {
      const a = map.nodes[i];
      const b = map.nodes[j];
      if (Math.hypot(a.gx - b.gx, a.gy - b.gy) < threshold) count++;
    }
  }
  return count;
}

function positionsOf(map: WorldMap) {
  return map.nodes.map((n) => ({ gx: n.gx, gy: n.gy }));
}

describe("relaxLayout (via generateMap)", () => {
  it("leaves placement bit-identical when strength is 0", () => {
    for (const placementAlgorithm of ALGORITHMS) {
      for (const seed of SEEDS.slice(0, 4)) {
        const off = generateMap({ ...BASE, placementAlgorithm, seed, layoutRelaxStrength: 0 });
        const alsoOff = generateMap({ ...BASE, placementAlgorithm, seed, layoutRelaxStrength: 0 });
        expect(positionsOf(off)).toEqual(positionsOf(alsoOff));
      }
    }
  });

  it("is deterministic — the same params twice give identical positions", () => {
    for (const placementAlgorithm of ALGORITHMS) {
      const a = generateMap({ ...BASE, placementAlgorithm });
      const b = generateMap({ ...BASE, placementAlgorithm });
      expect(positionsOf(a)).toEqual(positionsOf(b));
    }
  });

  it("actually moves nodes when enabled", () => {
    for (const placementAlgorithm of ALGORITHMS) {
      const off = generateMap({ ...BASE, placementAlgorithm, layoutRelaxStrength: 0 });
      const on = generateMap({ ...BASE, placementAlgorithm });
      expect(positionsOf(on)).not.toEqual(positionsOf(off));
    }
  });

  it("reduces mean direction error across seeds, for both placement algorithms", () => {
    for (const placementAlgorithm of ALGORITHMS) {
      let offTotal = 0;
      let onTotal = 0;
      for (const seed of SEEDS) {
        offTotal += meanDirectionError(generateMap({ ...BASE, placementAlgorithm, seed, layoutRelaxStrength: 0 }));
        onTotal += meanDirectionError(generateMap({ ...BASE, placementAlgorithm, seed }));
      }
      expect(onTotal).toBeLessThan(offTotal);
    }
  });

  it("never increases crowding, and strictly relieves it where it exists", () => {
    // Grid placement is already well spread (nothing under 0.5 apart even
    // unrelaxed), so "strictly fewer crowded pairs" is only a meaningful
    // claim for radial, whose organic growth genuinely stacks nodes up.
    for (const placementAlgorithm of ALGORITHMS) {
      let offTotal = 0;
      let onTotal = 0;
      for (const seed of SEEDS) {
        offTotal += crowdedPairCount(generateMap({ ...BASE, placementAlgorithm, seed, layoutRelaxStrength: 0 }), 0.5);
        onTotal += crowdedPairCount(generateMap({ ...BASE, placementAlgorithm, seed }), 0.5);
      }
      expect(onTotal).toBeLessThanOrEqual(offTotal);
      if (placementAlgorithm === "radial") {
        expect(offTotal).toBeGreaterThan(0); // the problem this pass exists to fix
        expect(onTotal).toBe(0);
      }
    }
  });

  it("enforces the layoutNodeSpacing floor as a hard guarantee", () => {
    // The separation projection runs *after* the magnetic force every
    // iteration precisely so this holds regardless of how hard directions
    // are being chased — run as a rival force instead, spacing loses.
    function minSeparation(map: WorldMap) {
      let min = Infinity;
      for (let i = 0; i < map.nodes.length; i++) {
        for (let j = i + 1; j < map.nodes.length; j++) {
          min = Math.min(min, Math.hypot(map.nodes[i].gx - map.nodes[j].gx, map.nodes[i].gy - map.nodes[j].gy));
        }
      }
      return min;
    }
    for (const placementAlgorithm of ALGORITHMS) {
      for (const directionWeight of [0, 0.5, 1]) {
        for (const seed of SEEDS.slice(0, 4)) {
          const map = generateMap({ ...BASE, placementAlgorithm, seed, layoutDirectionWeight: directionWeight });
          // Small tolerance: bounds/boundary-box clamping can shave a hair
          // off the target for nodes pinned against an edge.
          expect(minSeparation(map)).toBeGreaterThan(BASE.layoutNodeSpacing - 0.05);
        }
      }
    }
  });

  it("keeps every node inside the grid bounds", () => {
    for (const placementAlgorithm of ALGORITHMS) {
      for (const seed of SEEDS) {
        const map = generateMap({ ...BASE, placementAlgorithm, seed, layoutRelaxStrength: 1, layoutNodeSpacing: 2 });
        for (const node of map.nodes) {
          expect(node.gx).toBeGreaterThanOrEqual(0);
          expect(node.gy).toBeGreaterThanOrEqual(0);
          expect(node.gx).toBeLessThanOrEqual(map.params.gridCols - 1);
          expect(node.gy).toBeLessThanOrEqual(map.params.gridRows - 1);
        }
      }
    }
  });

  it("holds every validator invariant across both algorithms and knob extremes", () => {
    // Invariant 4 (boundary placement) is the one node movement can actually
    // break, which is why relaxLayout pushes boundary-marked nodes back out
    // of the forbidden inner band every iteration.
    const extremes: Partial<GenerationParams>[] = [
      { layoutRelaxStrength: 0 },
      { layoutRelaxStrength: 1 },
      { layoutRelaxStrength: 1, layoutNodeSpacing: 0 },
      { layoutRelaxStrength: 1, layoutNodeSpacing: 2 },
      { layoutRelaxStrength: 1, layoutDirectionWeight: 0 },
      { layoutRelaxStrength: 1, layoutDirectionWeight: 1 },
    ];
    for (const placementAlgorithm of ALGORITHMS) {
      for (const override of extremes) {
        for (const seed of SEEDS.slice(0, 5)) {
          const map = generateMap({ ...BASE, placementAlgorithm, seed, ...override });
          expect(validateMap(map)).toEqual([]);
        }
      }
    }
  });

  it("layoutDirectionWeight 1 beats 0 on direction accuracy", () => {
    let spacingOnly = 0;
    let directionOnly = 0;
    for (const seed of SEEDS) {
      spacingOnly += meanDirectionError(generateMap({ ...BASE, seed, layoutDirectionWeight: 0 }));
      directionOnly += meanDirectionError(generateMap({ ...BASE, seed, layoutDirectionWeight: 1 }));
    }
    expect(directionOnly).toBeLessThan(spacingOnly);
  });

  it("larger layoutNodeSpacing spreads nodes further apart", () => {
    function meanNearestNeighbor(map: WorldMap) {
      let total = 0;
      for (const a of map.nodes) {
        let nearest = Infinity;
        for (const b of map.nodes) {
          if (a.id === b.id) continue;
          nearest = Math.min(nearest, Math.hypot(a.gx - b.gx, a.gy - b.gy));
        }
        total += nearest === Infinity ? 0 : nearest;
      }
      return total / Math.max(1, map.nodes.length);
    }
    let tight = 0;
    let loose = 0;
    for (const seed of SEEDS) {
      tight += meanNearestNeighbor(generateMap({ ...BASE, seed, layoutNodeSpacing: 0.3 }));
      loose += meanNearestNeighbor(generateMap({ ...BASE, seed, layoutNodeSpacing: 1.8 }));
    }
    expect(loose).toBeGreaterThan(tight);
  });
});
