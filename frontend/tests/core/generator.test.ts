import { describe, expect, it } from "vitest";
import { generateMap } from "../../src/core/generator";
import { validateMap } from "../../src/core/validator";
import type { GenerationParams, WorldMap } from "../../src/types/map";

const DEFAULT_PARAMS: GenerationParams = {
  seed: 12345,
  targetNodeCount: 49,
  gridCols: 10,
  gridRows: 8,
  nodeTypeBias: { settlement: 0.18, wilderness: 0.45, mountain: 0.22, ruin: 0.15 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  mountainEdgeFraction: 0.7,
};

// Strips fields that are legitimately non-deterministic across runs (uuids,
// timestamps) so "same seed -> same output" can be checked at the structural
// level. Node/edge array order is fully seed-driven, independent of any uuid,
// so positional comparison (rather than id-based) is valid here.
function normalize(map: WorldMap) {
  const indexOf = new Map(map.nodes.map((n, i) => [n.id, i]));
  return {
    nodes: map.nodes.map((n) => ({ label: n.label, type: n.type, gx: n.gx, gy: n.gy })),
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
    expect(map.algorithmVersion).toBe("1.0.0");
  });

  it("never assigns generator-forbidden connection types", () => {
    const map = generateMap(DEFAULT_PARAMS);
    for (const edge of map.edges) {
      expect(edge.connectionType).not.toBe("sea_route");
      expect(edge.connectionType).not.toBe("seasonal");
    }
  });

  it("never sets subtype, factionId, or extension data", () => {
    const map = generateMap(DEFAULT_PARAMS);
    expect(map.extensions).toEqual({});
    for (const node of map.nodes) {
      expect(node.subtype).toBeUndefined();
      expect(node.factionId).toBeUndefined();
    }
    for (const edge of map.edges) {
      expect(edge.travelDays).toBeUndefined();
    }
  });
});
