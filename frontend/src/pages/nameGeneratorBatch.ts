import { generateFromPattern, generateName, type GeneratedName, type Theme } from "../nameforge";
import { makeRng } from "../store/mapStore";

// A sentinel patternId meaning "let generateName pick one at random," rather
// than forcing a specific pattern via generateFromPattern.
export const RANDOM_PATTERN = "__random__";

export interface NameGeneratorResult extends GeneratedName {
  index: number;
  seed: number;
  // Whether patternId was explicitly forced (generateFromPattern) or chosen
  // randomly by generateName from this same seed. This is not cosmetic:
  // generateName's first rng() draw picks the pattern before any slot content
  // is drawn, so reproducing a "random" row later by calling
  // generateFromPattern(patternId, makeRng(seed)) — skipping that draw —
  // produces different slot content even though patternId still matches.
  // reproduceResult (below) is what actually reproduces `text` correctly.
  patternForced: boolean;
  // Flips true once a per-slot reroll has touched this row — the JSON stays
  // honest that `seed` alone no longer reproduces `text` once this is set.
  edited: boolean;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

// The one place that knows how to turn a result's recorded metadata back into
// the exact same GeneratedName — must match generateBatch's own dispatch
// exactly, including which rng() draws happen in which order.
export function reproduceResult(
  theme: Theme,
  result: Pick<NameGeneratorResult, "patternId" | "patternForced" | "seed">
): GeneratedName {
  const rng = makeRng(result.seed);
  return result.patternForced ? generateFromPattern(theme, result.patternId, rng) : generateName(theme, rng);
}

export function generateBatch(theme: Theme, patternId: string, baseSeed: number, count: number): NameGeneratorResult[] {
  const patternForced = patternId !== RANDOM_PATTERN;
  return Array.from({ length: count }, (_, i) => {
    const seed = baseSeed + i;
    const generated = reproduceResult(theme, { patternId, patternForced, seed });
    return { ...generated, index: i, seed, patternForced, edited: false };
  });
}
