import { REGION_PRESETS } from "./regionPresets";
import type { GenerationParams } from "../types/map";

// Encodes/decodes a GenerationParams object into a short, URL-safe "share
// code" (spec Section 13b) — an encoding, not a hash: it must be decodable
// back into the exact params, which a one-way hash (SHA-256, etc.) cannot do.
// `seed` is already a field of GenerationParams, so there's no separate
// "seed + hash of the rest" — this encodes the whole object, seed included.

// The current codec version encodeParams() emits. Bump whenever
// GenerationParams's shape changes in a way the byte layout must reflect —
// see DECODERS below for the "never break an old link" discipline this
// enables.
export const PARAMS_CODEC_VERSION = 4;

export type DecodeResult =
  | { ok: true; params: GenerationParams }
  | { ok: false; error: string };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function encodeSeed(bytes: Uint8Array, offset: number, params: GenerationParams): void {
  const seed = clamp(Math.round(params.seed), 0, 4294967295);
  bytes[offset] = (seed >>> 24) & 0xff;
  bytes[offset + 1] = (seed >>> 16) & 0xff;
  bytes[offset + 2] = (seed >>> 8) & 0xff;
  bytes[offset + 3] = seed & 0xff;
}

function decodeSeed(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

// nodeTypeBias: poi is derived, then all three are renormalized to sum to
// exactly 1 — the same floating-point-drift guard rebalanceShares
// (store/mapStore.ts) already uses, since independent per-field rounding can
// otherwise leave the triple slightly off 1.0 (or, pathologically, push a
// derived share below 0). biomeMix (codec v2+) uses the identical pattern
// one dimension up: 5 of 6 values stored, the 6th derived the same way.
function renormalizeTriple(a: number, b: number, c: number): [number, number, number] {
  const clampedC = Math.max(0, c);
  const sum = a + b + clampedC;
  return sum > 0 ? [a / sum, b / sum, clampedC / sum] : [1 / 3, 1 / 3, 1 / 3];
}

// --- codec v1 ------------------------------------------------------------------
// 15 bytes. Predates biomeMix (M4.7.2) — decodeV1 fills a sensible default
// (Temperate Mixed's mix) so old links stay decodable under the current
// GenerationParams shape. See spec Section 13b for the full field table.
// encodeV1 itself is gone (encodeParams has moved on to encodeV3) — only the
// decoder needs to live forever, per the "never break an old link" rule.
const V1_LENGTH = 15;

function decodeV1(bytes: Uint8Array): DecodeResult {
  if (bytes.length !== V1_LENGTH) {
    return { ok: false, error: `Expected ${V1_LENGTH} bytes for codec v1, got ${bytes.length}.` };
  }

  const [settlement, wilderness, poi] = renormalizeTriple(
    bytes[7] / 255,
    bytes[8] / 255,
    1 - bytes[7] / 255 - bytes[8] / 255
  );

  const params: GenerationParams = {
    seed: decodeSeed(bytes, 1),
    targetNodeCount: bytes[5],
    gridCols: bytes[6] & 0x0f,
    gridRows: (bytes[6] >> 4) & 0x0f,
    nodeTypeBias: { settlement, wilderness, poi },
    wildernessWaterFraction: bytes[12] / 100,
    settlementOutpostFraction: bytes[13] / 100,
    checkRequiredFraction: bytes[10] / 100,
    edgeDensity: bytes[9] / 100,
    boundaryFraction: bytes[11] / 100,
    generateTerrainZones: (bytes[14] & 1) === 1,
    // Predates biomeMix (M4.7.2) — a link from before region presets existed
    // gets the same baseline a fresh app load without one would have used.
    biomeMix: { ...REGION_PRESETS.temperate_mixed.biomeMix },
    // Predates placementAlgorithm/the radial params (M4.8) — every pre-v4
    // link was necessarily a "grid" map, so that default is exact, not a
    // guess; the radial-only fields get the same defaults a fresh app load
    // would use (DEFAULT_GENERATION_PARAMS, store/mapStore.ts) since they're
    // inert under "grid" anyway.
    placementAlgorithm: "grid",
    radialSpokeCount: 6,
    radialCoreInterconnectivity: 0.5,
    radialBranchChance: 0.15,
    radialClusterChance: 0.1,
    radialDeadEndPoiBias: 0.6,
    radialConvergenceRadius: 1.5,
  };
  return { ok: true, params };
}

// --- codec v2 ------------------------------------------------------------------
// 20 bytes = v1's 15 + 5 for biomeMix (M4.7.2). See spec Section 13b.
// encodeV2 itself is gone (superseded by encodeV3) — only the decoder needs
// to live forever, per the "never break an old link" rule.
const V2_LENGTH = 20;

function decodeV2(bytes: Uint8Array): DecodeResult {
  if (bytes.length !== V2_LENGTH) {
    return { ok: false, error: `Expected ${V2_LENGTH} bytes for codec v2, got ${bytes.length}.` };
  }
  const v1Result = decodeV1(bytes.subarray(0, V1_LENGTH));
  if (!v1Result.ok) return v1Result;

  const forest = bytes[15] / 255;
  const swamp = bytes[16] / 255;
  const plains = bytes[17] / 255;
  const desert = bytes[18] / 255;
  const tundra = bytes[19] / 255;
  const rawJungle = Math.max(0, 1 - forest - swamp - plains - desert - tundra);
  const sum = forest + swamp + plains + desert + tundra + rawJungle;
  const biomeMix =
    sum > 0
      ? {
          forest: forest / sum,
          swamp: swamp / sum,
          plains: plains / sum,
          desert: desert / sum,
          tundra: tundra / sum,
          jungle: rawJungle / sum,
        }
      : { forest: 1 / 6, swamp: 1 / 6, plains: 1 / 6, desert: 1 / 6, tundra: 1 / 6, jungle: 1 / 6 };

  return { ok: true, params: { ...v1Result.params, biomeMix } };
}

// --- codec v3 ------------------------------------------------------------------
// 21 bytes. M4.7.3's grid-sizing-scaled-to-node-count change raised
// gridCols/gridRows' practical range above 15 (recommendedGridDimensions(80)
// = 18) — v1/v2's single byte with a 4-bit nibble per field (max 15) can no
// longer represent that, so v3 gives each its own full byte instead. Every
// other field keeps v2's exact encoding, just shifted to make room.
const V3_LENGTH = 21;

function encodeV3(params: GenerationParams): Uint8Array {
  const bytes = new Uint8Array(V3_LENGTH);
  bytes[0] = 3;
  encodeSeed(bytes, 1, params);
  bytes[5] = clamp(Math.round(params.targetNodeCount), 0, 255);
  bytes[6] = clamp(Math.round(params.gridCols), 0, 255);
  bytes[7] = clamp(Math.round(params.gridRows), 0, 255);
  bytes[8] = clamp(Math.round(params.nodeTypeBias.settlement * 255), 0, 255);
  bytes[9] = clamp(Math.round(params.nodeTypeBias.wilderness * 255), 0, 255);
  bytes[10] = clamp(Math.round(params.edgeDensity * 100), 0, 100);
  bytes[11] = clamp(Math.round(params.checkRequiredFraction * 100), 0, 100);
  bytes[12] = clamp(Math.round(params.boundaryFraction * 100), 0, 100);
  bytes[13] = clamp(Math.round(params.wildernessWaterFraction * 100), 0, 100);
  bytes[14] = clamp(Math.round(params.settlementOutpostFraction * 100), 0, 100);
  bytes[15] = params.generateTerrainZones ? 1 : 0;
  bytes[16] = clamp(Math.round(params.biomeMix.forest * 255), 0, 255);
  bytes[17] = clamp(Math.round(params.biomeMix.swamp * 255), 0, 255);
  bytes[18] = clamp(Math.round(params.biomeMix.plains * 255), 0, 255);
  bytes[19] = clamp(Math.round(params.biomeMix.desert * 255), 0, 255);
  bytes[20] = clamp(Math.round(params.biomeMix.tundra * 255), 0, 255);
  return bytes;
}

function decodeV3(bytes: Uint8Array): DecodeResult {
  if (bytes.length !== V3_LENGTH) {
    return { ok: false, error: `Expected ${V3_LENGTH} bytes for codec v3, got ${bytes.length}.` };
  }

  const [settlement, wilderness, poi] = renormalizeTriple(
    bytes[8] / 255,
    bytes[9] / 255,
    1 - bytes[8] / 255 - bytes[9] / 255
  );

  const forest = bytes[16] / 255;
  const swamp = bytes[17] / 255;
  const plains = bytes[18] / 255;
  const desert = bytes[19] / 255;
  const tundra = bytes[20] / 255;
  const rawJungle = Math.max(0, 1 - forest - swamp - plains - desert - tundra);
  const sum = forest + swamp + plains + desert + tundra + rawJungle;
  const biomeMix =
    sum > 0
      ? {
          forest: forest / sum,
          swamp: swamp / sum,
          plains: plains / sum,
          desert: desert / sum,
          tundra: tundra / sum,
          jungle: rawJungle / sum,
        }
      : { forest: 1 / 6, swamp: 1 / 6, plains: 1 / 6, desert: 1 / 6, tundra: 1 / 6, jungle: 1 / 6 };

  const params: GenerationParams = {
    seed: decodeSeed(bytes, 1),
    targetNodeCount: bytes[5],
    gridCols: bytes[6],
    gridRows: bytes[7],
    nodeTypeBias: { settlement, wilderness, poi },
    wildernessWaterFraction: bytes[13] / 100,
    settlementOutpostFraction: bytes[14] / 100,
    checkRequiredFraction: bytes[11] / 100,
    edgeDensity: bytes[10] / 100,
    boundaryFraction: bytes[12] / 100,
    generateTerrainZones: (bytes[15] & 1) === 1,
    biomeMix,
    // Predates placementAlgorithm/the radial params (M4.8) — see decodeV1's
    // identical comment; every pre-v4 link was necessarily a "grid" map.
    placementAlgorithm: "grid",
    radialSpokeCount: 6,
    radialCoreInterconnectivity: 0.5,
    radialBranchChance: 0.15,
    radialClusterChance: 0.1,
    radialDeadEndPoiBias: 0.6,
    radialConvergenceRadius: 1.5,
  };
  return { ok: true, params };
}

// --- codec v4 ------------------------------------------------------------------
// 28 bytes = v3's 21 + 1 for placementAlgorithm + 6 for the radial-only
// params (spec Section 7e — the new "radial" core-out placement algorithm).
// Every other field keeps v3's exact encoding, just extended.
const V4_LENGTH = 28;

function encodeV4(params: GenerationParams): Uint8Array {
  const bytes = new Uint8Array(V4_LENGTH);
  bytes.set(encodeV3(params).subarray(1), 1); // reuse v3's byte-1-through-20 layout verbatim
  bytes[0] = 4;
  bytes[21] = params.placementAlgorithm === "radial" ? 1 : 0;
  bytes[22] = clamp(Math.round(params.radialSpokeCount), 0, 255);
  bytes[23] = clamp(Math.round(params.radialCoreInterconnectivity * 255), 0, 255);
  bytes[24] = clamp(Math.round(params.radialBranchChance * 255), 0, 255);
  bytes[25] = clamp(Math.round(params.radialClusterChance * 255), 0, 255);
  bytes[26] = clamp(Math.round(params.radialDeadEndPoiBias * 255), 0, 255);
  bytes[27] = clamp(Math.round(params.radialConvergenceRadius * 10), 0, 255);
  return bytes;
}

function decodeV4(bytes: Uint8Array): DecodeResult {
  if (bytes.length !== V4_LENGTH) {
    return { ok: false, error: `Expected ${V4_LENGTH} bytes for codec v4, got ${bytes.length}.` };
  }
  const v3Result = decodeV3(bytes.subarray(0, V3_LENGTH));
  if (!v3Result.ok) return v3Result;

  const params: GenerationParams = {
    ...v3Result.params,
    placementAlgorithm: (bytes[21] & 1) === 1 ? "radial" : "grid",
    radialSpokeCount: bytes[22],
    radialCoreInterconnectivity: bytes[23] / 255,
    radialBranchChance: bytes[24] / 255,
    radialClusterChance: bytes[25] / 255,
    radialDeadEndPoiBias: bytes[26] / 255,
    radialConvergenceRadius: bytes[27] / 10,
  };
  return { ok: true, params };
}

// Every shipped codec version stays decodable forever — the direct analog of
// ALGORITHM_VERSION's own "never break an old meaning" discipline. Add a new
// entry here (and a new encodeVN) when GenerationParams's shape changes;
// never remove or repurpose an existing one.
const DECODERS: Record<number, (bytes: Uint8Array) => DecodeResult> = {
  1: decodeV1,
  2: decodeV2,
  3: decodeV3,
  4: decodeV4,
};

// --- base64url + public API ---------------------------------------------------
// btoa/atob run identically in modern Node (18+) and every current browser —
// the same cross-runtime assumption core/generator.ts's crypto.randomUUID()
// already relies on.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): Uint8Array | null {
  try {
    const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function encodeParams(params: GenerationParams): string {
  return toBase64Url(encodeV4(params));
}

export function decodeParams(code: string): DecodeResult {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length === 0) return { ok: false, error: "Malformed share code." };
  const version = bytes[0];
  const decoder = DECODERS[version];
  if (!decoder) return { ok: false, error: `Unsupported share code version: ${version}.` };
  return decoder(bytes);
}
