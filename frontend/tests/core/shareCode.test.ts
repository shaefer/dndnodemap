import { describe, expect, it } from "vitest";
import { generateMap } from "../../src/core/generator";
import { REGION_PRESETS } from "../../src/core/regionPresets";
import { decodeParams, encodeParams, PARAMS_CODEC_VERSION } from "../../src/core/shareCode";
import type { GenerationParams, WorldMap } from "../../src/types/map";

// Strips fields that are legitimately non-deterministic across runs (uuids,
// timestamps) — mirrors generator.test.ts's normalize() helper.
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

const DEFAULT_PARAMS: GenerationParams = {
  seed: 123456789,
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

describe("encodeParams / decodeParams", () => {
  it("round-trips exactly for fields with exact encodings", () => {
    const code = encodeParams(DEFAULT_PARAMS);
    const result = decodeParams(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.seed).toBe(DEFAULT_PARAMS.seed);
    expect(result.params.targetNodeCount).toBe(DEFAULT_PARAMS.targetNodeCount);
    expect(result.params.gridCols).toBe(DEFAULT_PARAMS.gridCols);
    expect(result.params.gridRows).toBe(DEFAULT_PARAMS.gridRows);
    expect(result.params.generateTerrainZones).toBe(DEFAULT_PARAMS.generateTerrainZones);
  });

  it("round-trips the five single-slider fractions exactly, given integer-percent inputs", () => {
    // These values are exactly what GeneratePanel's sliders produce (v/100
    // for integer v) — the codec must reproduce them with zero loss.
    const params: GenerationParams = {
      ...DEFAULT_PARAMS,
      edgeDensity: 37 / 100,
      checkRequiredFraction: 8 / 100,
      boundaryFraction: 100 / 100,
      wildernessWaterFraction: 0 / 100,
      settlementOutpostFraction: 63 / 100,
    };
    const result = decodeParams(encodeParams(params));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.edgeDensity).toBe(params.edgeDensity);
    expect(result.params.checkRequiredFraction).toBe(params.checkRequiredFraction);
    expect(result.params.boundaryFraction).toBe(params.boundaryFraction);
    expect(result.params.wildernessWaterFraction).toBe(params.wildernessWaterFraction);
    expect(result.params.settlementOutpostFraction).toBe(params.settlementOutpostFraction);
  });

  it("reproduces nodeTypeBias within a small epsilon and always summing to exactly 1", () => {
    const params: GenerationParams = {
      ...DEFAULT_PARAMS,
      nodeTypeBias: { settlement: 0.37, wilderness: 0.41, poi: 0.22 },
    };
    const result = decodeParams(encodeParams(params));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { settlement, wilderness, poi } = result.params.nodeTypeBias;
    expect(settlement).toBeCloseTo(params.nodeTypeBias.settlement, 2);
    expect(wilderness).toBeCloseTo(params.nodeTypeBias.wilderness, 2);
    expect(poi).toBeCloseTo(params.nodeTypeBias.poi, 2);
    expect(settlement + wilderness + poi).toBeCloseTo(1, 10);
  });

  it("reproduces biomeMix within a small epsilon and always summing to exactly 1", () => {
    const params: GenerationParams = {
      ...DEFAULT_PARAMS,
      biomeMix: { forest: 0.2, swamp: 0.05, plains: 0.3, desert: 0.15, tundra: 0.1, jungle: 0.2 },
    };
    const result = decodeParams(encodeParams(params));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { forest, swamp, plains, desert, tundra, jungle } = result.params.biomeMix;
    expect(forest).toBeCloseTo(params.biomeMix.forest, 2);
    expect(jungle).toBeCloseTo(params.biomeMix.jungle, 2);
    expect(forest + swamp + plains + desert + tundra + jungle).toBeCloseTo(1, 10);
  });

  it("handles extreme values at each field's min/max without error", () => {
    const extremes: GenerationParams[] = [
      { ...DEFAULT_PARAMS, seed: 0, targetNodeCount: 20, gridCols: 6, gridRows: 5 },
      { ...DEFAULT_PARAMS, seed: 4294967295, targetNodeCount: 80, gridCols: 14, gridRows: 12 },
      {
        ...DEFAULT_PARAMS,
        nodeTypeBias: { settlement: 1, wilderness: 0, poi: 0 },
        biomeMix: { forest: 1, swamp: 0, plains: 0, desert: 0, tundra: 0, jungle: 0 },
        edgeDensity: 0,
        checkRequiredFraction: 1,
        boundaryFraction: 0,
        wildernessWaterFraction: 1,
        settlementOutpostFraction: 0,
        generateTerrainZones: true,
      },
    ];
    for (const params of extremes) {
      const result = decodeParams(encodeParams(params));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.params.seed).toBe(params.seed);
      expect(result.params.targetNodeCount).toBe(params.targetNodeCount);
      expect(result.params.gridCols).toBe(params.gridCols);
      expect(result.params.gridRows).toBe(params.gridRows);
    }
  });

  it("produces a short, URL-safe code", () => {
    const code = encodeParams(DEFAULT_PARAMS);
    expect(code.length).toBeLessThanOrEqual(28);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("embeds the current PARAMS_CODEC_VERSION as the first byte", () => {
    // Indirect check: decoding should succeed under the version this build
    // knows about, and PARAMS_CODEC_VERSION itself should be a small,
    // stable, forward-compatible integer.
    expect(PARAMS_CODEC_VERSION).toBe(2);
    const result = decodeParams(encodeParams(DEFAULT_PARAMS));
    expect(result.ok).toBe(true);
  });

  it("a v1 (pre-biomeMix) share code still decodes, filling a sensible default biomeMix (regression)", () => {
    // Hand-construct a v1-shaped (15-byte) payload — what encodeParams used
    // to produce before M4.7.2 added biomeMix. decodeV1 must keep working
    // and must never be left behind when the type it constructs changes.
    const v1Bytes = new Uint8Array(15);
    v1Bytes[0] = 1;
    v1Bytes[1] = 0;
    v1Bytes[2] = 0;
    v1Bytes[3] = 0x30;
    v1Bytes[4] = 0x39; // seed = 12345
    v1Bytes[5] = 49; // targetNodeCount
    v1Bytes[6] = (10 & 0x0f) | ((8 & 0x0f) << 4); // gridCols=10, gridRows=8
    v1Bytes[7] = Math.round(0.2 * 255);
    v1Bytes[8] = Math.round(0.55 * 255);
    v1Bytes[9] = 50; // edgeDensity
    v1Bytes[10] = 25; // checkRequiredFraction
    v1Bytes[11] = 70; // boundaryFraction
    v1Bytes[12] = 15; // wildernessWaterFraction
    v1Bytes[13] = 25; // settlementOutpostFraction
    v1Bytes[14] = 0; // generateTerrainZones = false

    let binary = "";
    for (const b of v1Bytes) binary += String.fromCharCode(b);
    const code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const result = decodeParams(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.seed).toBe(12345);
    expect(result.params.biomeMix).toEqual(REGION_PRESETS.temperate_mixed.biomeMix);
    // still a valid, generatable GenerationParams
    expect(() => generateMap(result.params)).not.toThrow();
  });

  it("rejects an unsupported version without throwing", () => {
    // Hand-construct a code whose version byte (99) has no registered decoder.
    const bytes = new Uint8Array(15);
    bytes[0] = 99;
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result = decodeParams(code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unsupported");
  });

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", "not valid base64url!!!", "----", "%%%"]) {
      expect(() => decodeParams(bad)).not.toThrow();
      const result = decodeParams(bad);
      expect(result.ok).toBe(false);
    }
  });

  it("a decoded share code regenerates the identical map — the actual end-to-end promise of this feature", () => {
    for (const seed of [1, 42, 999, 7777777]) {
      const params: GenerationParams = { ...DEFAULT_PARAMS, seed };
      const original = generateMap(params);

      const decoded = decodeParams(encodeParams(params));
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) continue;
      const reconstructed = generateMap(decoded.params);

      expect(normalize(reconstructed)).toEqual(normalize(original));
    }
  });
});
