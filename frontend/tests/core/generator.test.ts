import { describe, expect, it } from "vitest";
import { generateMap } from "../../src/core/generator";
import { validateMap } from "../../src/core/validator";
import type { GenerationParams, WorldMap } from "../../src/types/map";

const DEFAULT_PARAMS: GenerationParams = {
  seed: 12345,
  targetNodeCount: 49,
  gridCols: 10,
  gridRows: 8,
  nodeTypeBias: { settlement: 0.2, wilderness: 0.55, poi: 0.25 },
  wildernessWaterFraction: 0.15,
  settlementOutpostFraction: 0.25,
  biomeMix: { forest: 0.3, swamp: 0.15, plains: 0.25, desert: 0.1, tundra: 0.1, jungle: 0.1 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  boundaryFraction: 0.7,
  generateTerrainZones: false,
};

// Strips fields that are legitimately non-deterministic across runs (uuids,
// timestamps) so "same seed -> same output" can be checked at the structural
// level. Node/edge array order is fully seed-driven, independent of any uuid,
// so positional comparison (rather than id-based) is valid here.
function normalize(map: WorldMap) {
  const indexOf = new Map(map.nodes.map((n, i) => [n.id, i]));
  return {
    nodes: map.nodes.map((n) => ({
      label: n.label,
      type: n.type,
      subtype: n.subtype,
      boundary: n.boundary,
      coastal: n.coastal,
      gx: n.gx,
      gy: n.gy,
    })),
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

describe("generateMap", () => {
  it("produces identical structural output for the same seed and params (run 3 times)", () => {
    const a = normalize(generateMap(DEFAULT_PARAMS));
    const b = normalize(generateMap({ ...DEFAULT_PARAMS }));
    const c = normalize(generateMap({ ...DEFAULT_PARAMS }));
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  it("produces a node count within targetNodeCount ± 2", () => {
    const map = generateMap(DEFAULT_PARAMS);
    expect(map.nodes.length).toBeGreaterThanOrEqual(DEFAULT_PARAMS.targetNodeCount - 2);
    expect(map.nodes.length).toBeLessThanOrEqual(DEFAULT_PARAMS.targetNodeCount + 2);
  });

  it("passes all validator invariants for the default params", () => {
    const map = generateMap(DEFAULT_PARAMS);
    expect(validateMap(map)).toEqual([]);
  });

  it("passes all validator invariants across a range of seeds and densities", () => {
    const seeds = [1, 2, 3, 42, 999, 123456, 7777777];
    for (const seed of seeds) {
      for (const edgeDensity of [0, 0.5, 1]) {
        const map = generateMap({ ...DEFAULT_PARAMS, seed, edgeDensity });
        expect(validateMap(map)).toEqual([]);
      }
    }
  });

  it("produces a different map when only the seed changes", () => {
    const a = normalize(generateMap(DEFAULT_PARAMS));
    const b = normalize(generateMap({ ...DEFAULT_PARAMS, seed: DEFAULT_PARAMS.seed + 1 }));
    expect(a).not.toEqual(b);
  });

  it("sets the current algorithm version", () => {
    const map = generateMap(DEFAULT_PARAMS);
    expect(map.algorithmVersion).toBe("2.1.1");
  });

  it("never assigns seasonal — that stays a manual, DM-authored call (Section 3c)", () => {
    const map = generateMap(DEFAULT_PARAMS);
    for (const edge of map.edges) {
      expect(edge.connectionType).not.toBe("seasonal");
    }
  });

  it("assigns a Tier 2 subtype to every wilderness/settlement/poi node, but never factionId or extension data beyond terrainZones", () => {
    const map = generateMap(DEFAULT_PARAMS);
    for (const node of map.nodes) {
      expect(node.subtype).toBeDefined();
      expect(node.factionId).toBeUndefined();
    }
    for (const edge of map.edges) {
      expect(edge.travelDays).toBeUndefined();
    }
    expect(map.extensions.factions).toBeUndefined();
    expect(map.extensions.edgeTerrainTags).toBeUndefined();
  });

  it("places boundary markers with real reason variety, all valid", () => {
    const VALID_REASONS = ["coastline", "mountain_range", "canyon_void", "magical_barrier"];
    const map = generateMap(DEFAULT_PARAMS);
    const markedNodes = map.nodes.filter((n) => n.boundary);
    expect(markedNodes.length).toBeGreaterThan(0);
    for (const node of markedNodes) {
      expect(VALID_REASONS).toContain(node.boundary?.reason);
    }
  });

  it("never assigns sea_route unless both endpoints are coastal", () => {
    const seeds = [1, 2, 3, 42, 999];
    for (const seed of seeds) {
      const map = generateMap({ ...DEFAULT_PARAMS, seed });
      const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
      for (const edge of map.edges) {
        if (edge.connectionType !== "sea_route") continue;
        expect(nodeById.get(edge.fromId)?.coastal).toBe(true);
        expect(nodeById.get(edge.toId)?.coastal).toBe(true);
      }
    }
  });

  it("leaves extensions empty when generateTerrainZones is false", () => {
    const map = generateMap(DEFAULT_PARAMS);
    expect(map.extensions).toEqual({});
  });

  it("populates valid terrainZones when generateTerrainZones is true", () => {
    const map = generateMap({ ...DEFAULT_PARAMS, generateTerrainZones: true });
    expect(validateMap(map)).toEqual([]); // includes the extension-node-ref / faction-membership-unique checks
    expect(map.extensions.factions).toBeUndefined();
    if (map.extensions.terrainZones) {
      const nodeIds = new Set(map.nodes.map((n) => n.id));
      for (const zone of map.extensions.terrainZones) {
        expect(zone.nodeIds.length).toBeGreaterThan(0);
        for (const id of zone.nodeIds) expect(nodeIds.has(id)).toBe(true);
      }
    }
  });

  it("clusters terrainZones by spatial proximity, not just matching biome (regression)", () => {
    // Grouping every same-biome node map-wide (no distance limit) produces
    // one hull per biome spanning nearly the whole grid — a real bug caught
    // by visual inspection, not by any test at the time. A zone's members
    // should sit close together; the grid's own diagonal (gridCols x
    // gridRows) is a generous upper bound that a map-spanning blob would blow
    // past, while a genuine regional cluster stays well under it.
    const map = generateMap({ ...DEFAULT_PARAMS, generateTerrainZones: true });
    const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
    const gridDiagonal = Math.hypot(DEFAULT_PARAMS.gridCols, DEFAULT_PARAMS.gridRows);
    for (const zone of map.extensions.terrainZones ?? []) {
      const members = zone.nodeIds.map((id) => nodeById.get(id)!);
      let maxPairwiseDist = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const d = Math.hypot(members[i].gx - members[j].gx, members[i].gy - members[j].gy);
          maxPairwiseDist = Math.max(maxPairwiseDist, d);
        }
      }
      expect(maxPairwiseDist).toBeLessThan(gridDiagonal * 0.6);
    }
  });

  it("weights biome selection by biomeMix — a zero-weight biome never appears (M4.7.2)", () => {
    const frostLike: GenerationParams["biomeMix"] = {
      forest: 0.05,
      swamp: 0.05,
      plains: 0.2,
      desert: 0.1,
      tundra: 0.6,
      jungle: 0, // must never appear
    };
    for (const seed of [1, 2, 3, 42, 999, 123456]) {
      const map = generateMap({ ...DEFAULT_PARAMS, seed, biomeMix: frostLike, targetNodeCount: 80 });
      expect(map.nodes.some((n) => n.subtype === "jungle")).toBe(false);
      expect(map.nodes.some((n) => n.subtype === "tundra")).toBe(true); // dominant biome should show up
    }
  });

  it("repairConnectivity merges nearest component pairs, not just '2nd-biggest into biggest' (regression)", () => {
    // Real user-reported case: this exact seed+params, on a sparse 14x12
    // grid with only 37 nodes, used to produce a ~10.6-unit bridge edge
    // (River_crossing-1 -> Swamp-8) because the old strategy always attached
    // whichever component wasn't currently largest directly to the largest
    // one, even when a much closer small pocket was available. No normal
    // buildEdges edge can exceed CANDIDATE_RADIUS (1.6); a repair edge more
    // than a few times that is a sign the merge order picked a bad pair.
    const params: GenerationParams = {
      seed: 1077081874,
      targetNodeCount: 37,
      gridCols: 14,
      gridRows: 12,
      nodeTypeBias: { settlement: 0.15294117647058825, wilderness: 0.6588235294117647, poi: 0.18823529411764706 },
      wildernessWaterFraction: 0.3,
      settlementOutpostFraction: 0.25,
      biomeMix: {
        forest: 0.2,
        swamp: 0.5019607843137255,
        plains: 0.10196078431372549,
        desert: 0.050980392156862744,
        tundra: 0.050980392156862744,
        jungle: 0.09411764705882357,
      },
      checkRequiredFraction: 0.25,
      edgeDensity: 0.5,
      boundaryFraction: 0.7,
      generateTerrainZones: false,
    };
    const map = generateMap(params);
    const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
    for (const edge of map.edges) {
      const from = nodeById.get(edge.fromId)!;
      const to = nodeById.get(edge.toId)!;
      const d = Math.hypot(from.gx - to.gx, from.gy - to.gy);
      expect(d).toBeLessThan(5); // was ~10.6 before the fix; every other edge on this map is under ~2
    }
  });

  it("repair edges generally stay short across seeds and grid shapes, not just the one reported case", () => {
    for (const [gridCols, gridRows, targetNodeCount] of [
      [14, 12, 37],
      [10, 8, 25],
      [14, 12, 20],
    ] as const) {
      for (const seed of [1, 2, 3, 42, 999]) {
        const map = generateMap({ ...DEFAULT_PARAMS, seed, gridCols, gridRows, targetNodeCount });
        const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
        for (const edge of map.edges) {
          const from = nodeById.get(edge.fromId)!;
          const to = nodeById.get(edge.toId)!;
          const d = Math.hypot(from.gx - to.gx, from.gy - to.gy);
          expect(d).toBeLessThan(6);
        }
      }
    }
  });
});
