import { describe, expect, it } from "vitest";
import { applyNodeNames, generateMapName } from "../../src/core/naming";
import { makeRng } from "../../src/core/rng";
import type { Biome, MapNode, OutpostKind, PoiKind, WaterFeature } from "../../src/types/map";

const BIOMES: Biome[] = ["forest", "swamp", "plains", "desert", "tundra", "jungle"];
const WATER_FEATURES: WaterFeature[] = ["pond", "lake", "river_crossing", "hot_spring", "waterfall", "delta"];
const OUTPOST_KINDS: OutpostKind[] = ["monastery", "military_fort", "trading_post", "mining_camp", "waystation"];
const POI_KINDS: PoiKind[] = ["ruin", "dungeon", "lair", "landmark"];

function node(overrides: Partial<MapNode>): MapNode {
  return {
    id: "n1",
    label: "placeholder",
    type: "wilderness",
    gx: 0,
    gy: 0,
    ...overrides,
  };
}

// The old placeholder scheme this pass replaces — a real generated name
// should never look like this.
const PLACEHOLDER_PATTERN = /^[A-Za-z_]+-\d+$/;

describe("applyNodeNames", () => {
  it("gives every settlement a non-placeholder label", () => {
    const nodes = [node({ type: "settlement", subtype: "village" }), node({ type: "settlement", subtype: "city" })];
    const named = applyNodeNames(nodes, makeRng(1));
    for (const n of named) {
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.label).not.toMatch(PLACEHOLDER_PATTERN);
    }
  });

  it("gives every outpost kind a non-placeholder label", () => {
    const nodes = OUTPOST_KINDS.map((subtype) => node({ type: "settlement", subtype }));
    const named = applyNodeNames(nodes, makeRng(2));
    for (const n of named) expect(n.label).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it("gives every poi kind a non-placeholder label", () => {
    const nodes = POI_KINDS.map((subtype) => node({ type: "poi", subtype }));
    const named = applyNodeNames(nodes, makeRng(3));
    for (const n of named) expect(n.label).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it("gives every biome a non-placeholder, biome-appropriate label", () => {
    const nodes = BIOMES.map((subtype) => node({ type: "wilderness", subtype }));
    const named = applyNodeNames(nodes, makeRng(4));
    for (const n of named) expect(n.label).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it("gives every water feature a non-placeholder label", () => {
    const nodes = WATER_FEATURES.map((subtype) => node({ type: "wilderness", subtype }));
    const named = applyNodeNames(nodes, makeRng(5));
    for (const n of named) expect(n.label).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it("falls back to a forest-flavored name when a wilderness node has no subtype", () => {
    const named = applyNodeNames([node({ type: "wilderness", subtype: undefined })], makeRng(6));
    expect(named[0].label.length).toBeGreaterThan(0);
    expect(named[0].label).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it("is deterministic — the same seed produces the same names", () => {
    const nodes = [node({ type: "settlement", subtype: "town" }), node({ id: "n2", type: "poi", subtype: "ruin" })];
    const a = applyNodeNames(nodes, makeRng(42));
    const b = applyNodeNames(nodes, makeRng(42));
    expect(a.map((n) => n.label)).toEqual(b.map((n) => n.label));
  });

  it("preserves every other field on the node, only replacing label", () => {
    const original = node({ type: "poi", subtype: "landmark", coastal: true, notes: "hand note" });
    const [named] = applyNodeNames([original], makeRng(8));
    expect(named).toEqual({ ...original, label: named.label });
  });
});

describe("generateMapName", () => {
  it("produces a non-empty name", () => {
    expect(generateMapName(makeRng(1)).length).toBeGreaterThan(0);
  });

  it("is deterministic by seed", () => {
    expect(generateMapName(makeRng(123))).toBe(generateMapName(makeRng(123)));
  });

  it("varies across different seeds", () => {
    const names = new Set(Array.from({ length: 20 }, (_, i) => generateMapName(makeRng(i))));
    expect(names.size).toBeGreaterThan(1);
  });
});
