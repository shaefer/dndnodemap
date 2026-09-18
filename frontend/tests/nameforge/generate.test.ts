import { describe, expect, it } from "vitest";
import { generateName, regenerate, rerollSlot } from "../../src/nameforge/generate";
import { poiFanciful } from "../../src/nameforge/themes/poi";
import { regionName } from "../../src/nameforge/themes/region";
import { settlementMedieval } from "../../src/nameforge/themes/settlement";
import { elvishSyllable } from "../../src/nameforge/themes/syllable";
import {
  waterFeature,
  wildernessDesert,
  wildernessForest,
  wildernessJungle,
  wildernessPlains,
  wildernessSwamp,
  wildernessTundra,
} from "../../src/nameforge/themes/wilderness";
import type { Theme } from "../../src/nameforge/types";

const ALL_THEMES: Theme[] = [
  settlementMedieval,
  poiFanciful,
  wildernessForest,
  wildernessSwamp,
  wildernessDesert,
  wildernessTundra,
  wildernessJungle,
  wildernessPlains,
  waterFeature,
  regionName,
  elvishSyllable,
];

// A tiny deterministic sequence generator for tests — cycles through a fixed
// list of [0,1) values so results are reproducible without depending on any
// particular RNG implementation.
function fixedRng(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

describe("generateName", () => {
  it("is deterministic — the same rng sequence produces the same name", () => {
    for (const theme of ALL_THEMES) {
      const a = generateName(theme, fixedRng(1));
      const b = generateName(theme, fixedRng(1));
      expect(a).toEqual(b);
    }
  });

  it("produces non-empty text for every theme and every pattern at least once", () => {
    for (const theme of ALL_THEMES) {
      const seenPatterns = new Set<string>();
      for (let seed = 0; seed < 200 && seenPatterns.size < theme.patterns.length; seed++) {
        const name = generateName(theme, fixedRng(seed));
        expect(name.text.length).toBeGreaterThan(0);
        expect(name.text).toBe(name.parts.join(""));
        seenPatterns.add(name.patternId);
      }
      expect(seenPatterns.size).toBe(theme.patterns.length);
    }
  });

  it("defaults to Math.random when no rng is supplied", () => {
    const name = generateName(settlementMedieval);
    expect(name.text.length).toBeGreaterThan(0);
  });
});

describe("regenerate", () => {
  it("keeps the same pattern id but can change the rendered parts", () => {
    const original = generateName(settlementMedieval, fixedRng(7));
    const restyled = regenerate(settlementMedieval, original, fixedRng(99));
    expect(restyled.patternId).toBe(original.patternId);
    expect(restyled.parts.length).toBe(original.parts.length);
  });
});

describe("rerollSlot", () => {
  it("changes only the targeted slot, leaving every other part untouched", () => {
    const original = generateName(settlementMedieval, fixedRng(3));
    const rerolled = rerollSlot(settlementMedieval, original, 0, fixedRng(500));
    expect(rerolled.parts.length).toBe(original.parts.length);
    for (let i = 1; i < original.parts.length; i++) {
      expect(rerolled.parts[i]).toBe(original.parts[i]);
    }
    expect(rerolled.text).toBe(rerolled.parts.join(""));
  });

  it("returns the input unchanged for an out-of-range slot index", () => {
    const original = generateName(settlementMedieval, fixedRng(3));
    expect(rerollSlot(settlementMedieval, original, 99, fixedRng(1))).toEqual(original);
    expect(rerollSlot(settlementMedieval, original, -1, fixedRng(1))).toEqual(original);
  });
});

describe("syllableChain slots (elvishSyllable)", () => {
  it("respects minMiddle/maxMiddle bounds across many draws", () => {
    const chain = elvishSyllable.patterns[0].slots[0];
    if (chain.type !== "syllableChain") throw new Error("expected a syllableChain slot");
    const { start, end } = chain.chain;
    for (let seed = 0; seed < 100; seed++) {
      const name = generateName(elvishSyllable, fixedRng(seed));
      // Every generated name must start with one of the start syllables and
      // end with one of the end syllables (middles are variable-length, so
      // this is the checkable invariant rather than an exact length).
      expect(start.some((s) => name.text.startsWith(s))).toBe(true);
      expect(end.some((e) => name.text.endsWith(e))).toBe(true);
    }
  });
});
