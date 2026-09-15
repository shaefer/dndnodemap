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
  placementAlgorithm: "grid",
  targetNodeCount: 49,
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
      // 18x18 exceeds v1/v2's 4-bit-nibble range (max 15) — this is exactly
      // what recommendedGridDimensions(80) recommends (M4.7.3), and the
      // reason v3 gave gridCols/gridRows their own full byte each.
      { ...DEFAULT_PARAMS, seed: 4294967295, targetNodeCount: 80, gridCols: 18, gridRows: 18 },
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
    expect(code.length).toBeLessThanOrEqual(52);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("embeds the current PARAMS_CODEC_VERSION as the first byte", () => {
    // Indirect check: decoding should succeed under the version this build
    // knows about, and PARAMS_CODEC_VERSION itself should be a small,
    // stable, forward-compatible integer.
    expect(PARAMS_CODEC_VERSION).toBe(5);
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

  it("a v2 (pre-full-byte-grid) share code still decodes (regression)", () => {
    // Hand-construct a v2-shaped (20-byte) payload — what encodeParams used
    // to produce before M4.7.3 gave gridCols/gridRows their own full byte.
    // encodeV2 itself is gone now that encodeParams always emits v3, so this
    // is decodeV2's only remaining exercise — it must keep working per the
    // "never break an old link" rule, same as decodeV1.
    const v2Bytes = new Uint8Array(20);
    v2Bytes[0] = 2;
    v2Bytes[1] = 0;
    v2Bytes[2] = 0;
    v2Bytes[3] = 0x30;
    v2Bytes[4] = 0x39; // seed = 12345
    v2Bytes[5] = 49; // targetNodeCount
    v2Bytes[6] = (10 & 0x0f) | ((8 & 0x0f) << 4); // gridCols=10, gridRows=8 (nibble-packed, v1/v2's max)
    v2Bytes[7] = Math.round(0.2 * 255);
    v2Bytes[8] = Math.round(0.55 * 255);
    v2Bytes[9] = 50; // edgeDensity
    v2Bytes[10] = 25; // checkRequiredFraction
    v2Bytes[11] = 70; // boundaryFraction
    v2Bytes[12] = 15; // wildernessWaterFraction
    v2Bytes[13] = 25; // settlementOutpostFraction
    v2Bytes[14] = 0; // generateTerrainZones = false
    v2Bytes[15] = Math.round(0.3 * 255); // biomeMix.forest
    v2Bytes[16] = Math.round(0.15 * 255); // biomeMix.swamp
    v2Bytes[17] = Math.round(0.25 * 255); // biomeMix.plains
    v2Bytes[18] = Math.round(0.1 * 255); // biomeMix.desert
    v2Bytes[19] = Math.round(0.1 * 255); // biomeMix.tundra

    let binary = "";
    for (const b of v2Bytes) binary += String.fromCharCode(b);
    const code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const result = decodeParams(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.seed).toBe(12345);
    expect(result.params.gridCols).toBe(10);
    expect(result.params.gridRows).toBe(8);
    expect(result.params.biomeMix.forest).toBeCloseTo(0.3, 2);
    expect(() => generateMap(result.params)).not.toThrow();
  });

  it("a v3 (pre-radial) share code still decodes with grid defaults for the new fields (regression)", () => {
    // Hand-construct a v3-shaped (21-byte) payload — what encodeParams used
    // to produce before M4.8 added placementAlgorithm/the radial params.
    // encodeV3 itself is gone from encodeParams's call path (superseded by
    // encodeV4) but is still called internally by encodeV4, so build the
    // bytes directly here instead, mirroring the v1/v2 regression tests.
    const v3Bytes = new Uint8Array(21);
    v3Bytes[0] = 3;
    v3Bytes[3] = 0x30;
    v3Bytes[4] = 0x39; // seed = 12345
    v3Bytes[5] = 49; // targetNodeCount
    v3Bytes[6] = 14; // gridCols
    v3Bytes[7] = 14; // gridRows
    v3Bytes[8] = Math.round(0.2 * 255);
    v3Bytes[9] = Math.round(0.55 * 255);
    v3Bytes[10] = 50; // edgeDensity
    v3Bytes[11] = 25; // checkRequiredFraction
    v3Bytes[12] = 70; // boundaryFraction
    v3Bytes[13] = 15; // wildernessWaterFraction
    v3Bytes[14] = 25; // settlementOutpostFraction
    v3Bytes[15] = 0; // generateTerrainZones = false
    v3Bytes[16] = Math.round(0.3 * 255); // biomeMix.forest
    v3Bytes[17] = Math.round(0.15 * 255); // biomeMix.swamp
    v3Bytes[18] = Math.round(0.25 * 255); // biomeMix.plains
    v3Bytes[19] = Math.round(0.1 * 255); // biomeMix.desert
    v3Bytes[20] = Math.round(0.1 * 255); // biomeMix.tundra

    let binary = "";
    for (const b of v3Bytes) binary += String.fromCharCode(b);
    const code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const result = decodeParams(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.seed).toBe(12345);
    expect(result.params.gridCols).toBe(14);
    // A pre-radial link was necessarily a "grid" map — this default is
    // exact, not a guess, unlike biomeMix's "closest reasonable default" for
    // pre-M4.7.2 links.
    expect(result.params.placementAlgorithm).toBe("grid");
    expect(result.params.radialSpokeCount).toBe(6);
    expect(() => generateMap(result.params)).not.toThrow();
  });

  it("round-trips placementAlgorithm and the radial params", () => {
    const radialParams: GenerationParams = {
      ...DEFAULT_PARAMS,
      placementAlgorithm: "radial",
      radialSpokeCount: 5,
      radialCoreInterconnectivity: 0.73,
      radialBranchChance: 0.22,
      radialClusterChance: 0.18,
      radialDeadEndPoiBias: 0.9,
      radialConvergenceRadius: 2.3,
    };
    const result = decodeParams(encodeParams(radialParams));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.placementAlgorithm).toBe("radial");
    expect(result.params.radialSpokeCount).toBe(5);
    expect(result.params.radialCoreInterconnectivity).toBeCloseTo(0.73, 2);
    expect(result.params.radialBranchChance).toBeCloseTo(0.22, 2);
    expect(result.params.radialClusterChance).toBeCloseTo(0.18, 2);
    expect(result.params.radialDeadEndPoiBias).toBeCloseTo(0.9, 2);
    expect(result.params.radialConvergenceRadius).toBeCloseTo(2.3, 1);
  });

  it("a v4 (pre-fine-tuning) share code still decodes with the previously-hardcoded values (regression)", () => {
    // Hand-construct a v4-shaped (28-byte) payload — what encodeParams
    // produced before M4.9 made the fine-tuning constants tunable. Each
    // backfilled default must be exactly the value that behavior was
    // hardcoded to, so an old link regenerates its original map.
    const v4Bytes = new Uint8Array(28);
    v4Bytes[0] = 4;
    v4Bytes[3] = 0x30;
    v4Bytes[4] = 0x39; // seed = 12345
    v4Bytes[5] = 49; // targetNodeCount
    v4Bytes[6] = 14; // gridCols
    v4Bytes[7] = 14; // gridRows
    v4Bytes[8] = Math.round(0.2 * 255);
    v4Bytes[9] = Math.round(0.55 * 255);
    v4Bytes[10] = 50; // edgeDensity
    v4Bytes[11] = 25; // checkRequiredFraction
    v4Bytes[12] = 70; // boundaryFraction
    v4Bytes[13] = 15; // wildernessWaterFraction
    v4Bytes[14] = 25; // settlementOutpostFraction
    v4Bytes[15] = 0; // generateTerrainZones = false
    v4Bytes[16] = Math.round(0.3 * 255);
    v4Bytes[17] = Math.round(0.15 * 255);
    v4Bytes[18] = Math.round(0.25 * 255);
    v4Bytes[19] = Math.round(0.1 * 255);
    v4Bytes[20] = Math.round(0.1 * 255);
    v4Bytes[21] = 1; // placementAlgorithm = radial
    v4Bytes[22] = 6; // radialSpokeCount
    v4Bytes[23] = Math.round(0.5 * 255);
    v4Bytes[24] = Math.round(0.15 * 255);
    v4Bytes[25] = Math.round(0.1 * 255);
    v4Bytes[26] = Math.round(0.6 * 255);
    v4Bytes[27] = 15; // radialConvergenceRadius = 1.5

    let binary = "";
    for (const b of v4Bytes) binary += String.fromCharCode(b);
    const code = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const result = decodeParams(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.placementAlgorithm).toBe("radial");
    expect(result.params.radialInwardWeight).toBeCloseTo(0.15, 5);
    expect(result.params.radialFalloffExponent).toBe(1);
    expect(result.params.radialJitter).toBeCloseTo(0.3, 5);
    expect(result.params.radialRimFraction).toBeCloseTo(0.85, 5);
    expect(result.params.radialClusterMaxSize).toBe(3);
    expect(result.params.radialClusterSpread).toBeCloseTo(0.35, 5);
    expect(result.params.maxLargeSettlements).toBe(2);
    expect(result.params.roadFraction).toBeCloseTo(0.5, 5);
    expect(result.params.coastalChance).toBeCloseTo(0.05, 5);
    expect(result.params.interiorBoundaryDamping).toBeCloseTo(0.15, 5);
    expect(result.params.wildernessCheckMultiplier).toBeCloseTo(0.2, 5);
    expect(() => generateMap(result.params)).not.toThrow();
  });

  it("round-trips the fine-tuning params", () => {
    const tuned: GenerationParams = {
      ...DEFAULT_PARAMS,
      radialInwardWeight: 0.42,
      radialFalloffExponent: 2.5,
      radialJitter: 0.7,
      radialRimFraction: 0.6,
      radialClusterMaxSize: 5,
      radialClusterSpread: 0.9,
      maxLargeSettlements: 5,
      roadFraction: 0.8,
      coastalChance: 0.3,
      interiorBoundaryDamping: 0.65,
      wildernessCheckMultiplier: 0.45,
    };
    const result = decodeParams(encodeParams(tuned));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.radialInwardWeight).toBeCloseTo(0.42, 2);
    expect(result.params.radialFalloffExponent).toBeCloseTo(2.5, 1);
    expect(result.params.radialJitter).toBeCloseTo(0.7, 2);
    expect(result.params.radialRimFraction).toBeCloseTo(0.6, 2);
    expect(result.params.radialClusterMaxSize).toBe(5);
    expect(result.params.radialClusterSpread).toBeCloseTo(0.9, 2);
    expect(result.params.maxLargeSettlements).toBe(5);
    expect(result.params.roadFraction).toBeCloseTo(0.8, 2);
    expect(result.params.coastalChance).toBeCloseTo(0.3, 2);
    expect(result.params.interiorBoundaryDamping).toBeCloseTo(0.65, 2);
    expect(result.params.wildernessCheckMultiplier).toBeCloseTo(0.45, 2);
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
