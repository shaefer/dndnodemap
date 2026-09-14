import type { GenerationParams } from "../types/map";

// Encodes/decodes a GenerationParams object into a short, URL-safe "share
// code" (spec Section 13b) — an encoding, not a hash: it must be decodable
// back into the exact params, which a one-way hash (SHA-256, etc.) cannot do.
// `seed` is already a field of GenerationParams, so there's no separate
// "seed + hash of the rest" — this encodes the whole object, seed included.

export const PARAMS_CODEC_VERSION = 1;

export type DecodeResult =
  | { ok: true; params: GenerationParams }
  | { ok: false; error: string };

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// --- codec v1 ----------------------------------------------------------------
// 15 bytes. See spec Section 13b for the full field-by-field table and the
// reasoning behind exact-integer-percent vs. fixed-point encoding per field.
const V1_LENGTH = 15;

function encodeV1(params: GenerationParams): Uint8Array {
  const bytes = new Uint8Array(V1_LENGTH);
  bytes[0] = PARAMS_CODEC_VERSION;

  const seed = clamp(Math.round(params.seed), 0, 4294967295);
  bytes[1] = (seed >>> 24) & 0xff;
  bytes[2] = (seed >>> 16) & 0xff;
  bytes[3] = (seed >>> 8) & 0xff;
  bytes[4] = seed & 0xff;

  bytes[5] = clamp(Math.round(params.targetNodeCount), 0, 255);
  bytes[6] = (clamp(Math.round(params.gridCols), 0, 15) & 0x0f) | ((clamp(Math.round(params.gridRows), 0, 15) & 0x0f) << 4);

  bytes[7] = clamp(Math.round(params.nodeTypeBias.settlement * 255), 0, 255);
  bytes[8] = clamp(Math.round(params.nodeTypeBias.wilderness * 255), 0, 255);

  bytes[9] = clamp(Math.round(params.edgeDensity * 100), 0, 100);
  bytes[10] = clamp(Math.round(params.checkRequiredFraction * 100), 0, 100);
  bytes[11] = clamp(Math.round(params.boundaryFraction * 100), 0, 100);
  bytes[12] = clamp(Math.round(params.wildernessWaterFraction * 100), 0, 100);
  bytes[13] = clamp(Math.round(params.settlementOutpostFraction * 100), 0, 100);

  bytes[14] = params.generateTerrainZones ? 1 : 0;
  return bytes;
}

function decodeV1(bytes: Uint8Array): DecodeResult {
  if (bytes.length !== V1_LENGTH) {
    return { ok: false, error: `Expected ${V1_LENGTH} bytes for codec v1, got ${bytes.length}.` };
  }

  const seed = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
  const targetNodeCount = bytes[5];
  const gridCols = bytes[6] & 0x0f;
  const gridRows = (bytes[6] >> 4) & 0x0f;

  // nodeTypeBias: poi is derived, then all three are renormalized to sum to
  // exactly 1 — the same floating-point-drift guard rebalanceNodeTypeBias
  // (store/mapStore.ts) already uses, since independent per-field rounding
  // can otherwise leave the triple slightly off 1.0 (or, pathologically,
  // push a derived poi share below 0).
  const rawSettlement = bytes[7] / 255;
  const rawWilderness = bytes[8] / 255;
  const rawPoi = Math.max(0, 1 - rawSettlement - rawWilderness);
  const biasSum = rawSettlement + rawWilderness + rawPoi;
  const nodeTypeBias =
    biasSum > 0
      ? { settlement: rawSettlement / biasSum, wilderness: rawWilderness / biasSum, poi: rawPoi / biasSum }
      : { settlement: 1 / 3, wilderness: 1 / 3, poi: 1 / 3 };

  const params: GenerationParams = {
    seed,
    targetNodeCount,
    gridCols,
    gridRows,
    nodeTypeBias,
    wildernessWaterFraction: bytes[12] / 100,
    settlementOutpostFraction: bytes[13] / 100,
    checkRequiredFraction: bytes[10] / 100,
    edgeDensity: bytes[9] / 100,
    boundaryFraction: bytes[11] / 100,
    generateTerrainZones: (bytes[14] & 1) === 1,
  };
  return { ok: true, params };
}

// Every shipped codec version stays decodable forever — the direct analog of
// ALGORITHM_VERSION's own "never break an old meaning" discipline. Add a new
// entry here (and a new encodeVN) when GenerationParams's shape changes;
// never remove or repurpose an existing one.
const DECODERS: Record<number, (bytes: Uint8Array) => DecodeResult> = {
  1: decodeV1,
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
  return toBase64Url(encodeV1(params));
}

export function decodeParams(code: string): DecodeResult {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length === 0) return { ok: false, error: "Malformed share code." };
  const version = bytes[0];
  const decoder = DECODERS[version];
  if (!decoder) return { ok: false, error: `Unsupported share code version: ${version}.` };
  return decoder(bytes);
}
