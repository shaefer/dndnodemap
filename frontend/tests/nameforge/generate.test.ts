import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/core/rng";
import { generateFromPattern, generateName, regenerate, rerollSlot } from "../../src/nameforge/generate";
import { listWordLists } from "../../src/nameforge/inspect";
import { poiFanciful } from "../../src/nameforge/themes/poi";
import { regionName } from "../../src/nameforge/themes/region";
import { settlementMedieval } from "../../src/nameforge/themes/settlement";
import { elvish } from "../../src/nameforge/themes/races/classic";
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
  elvish,
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

describe("pattern weighting (M4.15)", () => {
  it("picks a low-weight pattern proportionally less often than a default-weight one", () => {
    const theme: Theme = {
      id: "testWeighted",
      patterns: [
        { id: "common", weight: 1, slots: [{ type: "literal", text: "common" }] },
        { id: "rare", weight: 0.2, slots: [{ type: "literal", text: "rare" }] },
      ],
    };
    const rng = makeRng(1);
    const N = 5000;
    let commonCount = 0;
    let rareCount = 0;
    for (let i = 0; i < N; i++) {
      const id = generateName(theme, rng).patternId;
      if (id === "common") commonCount++;
      else rareCount++;
    }
    // Expected share: common 1/1.2 ≈ 0.833, rare 0.2/1.2 ≈ 0.167 — assert
    // observed shares land close to that, not the 50/50 a uniform pick
    // would give.
    const rareShare = rareCount / N;
    expect(rareShare).toBeGreaterThan(0.1);
    expect(rareShare).toBeLessThan(0.24);
    expect(commonCount).toBeGreaterThan(rareCount * 3);
  });

  it("patterns with no weight set behave exactly as before (uniform)", () => {
    const theme: Theme = {
      id: "testUnweighted",
      patterns: [
        { id: "a", slots: [{ type: "literal", text: "a" }] },
        { id: "b", slots: [{ type: "literal", text: "b" }] },
      ],
    };
    const rng = makeRng(2);
    const N = 4000;
    let aCount = 0;
    for (let i = 0; i < N; i++) {
      if (generateName(theme, rng).patternId === "a") aCount++;
    }
    const share = aCount / N;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });
});

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

describe("category-weighted bank picking (M4.14)", () => {
  it("gives every category roughly equal representation, independent of its own word count", () => {
    // settlementMedieval's "roots" bank has categories ranging from 2 words
    // ("fauna") to 7 words ("flora"). Without category-weighting, "flora"
    // would appear ~3.5x as often as "fauna" just from its size; with it,
    // both should land close to 1/7 of draws (7 categories total).
    const categories = listWordLists(settlementMedieval).filter((l) => l.parent === "roots");
    expect(categories.length).toBeGreaterThan(1);

    const counts = new Map<string, number>(categories.map((c) => [c.name, 0]));
    const rng = makeRng(1);
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const root = generateFromPattern(settlementMedieval, "compound", rng).parts[0];
      const category = categories.find((c) => c.words.includes(root));
      expect(category).toBeDefined();
      counts.set(category!.name, counts.get(category!.name)! + 1);
    }

    const expectedShare = 1 / categories.length;
    for (const [name, count] of counts) {
      const share = count / N;
      expect(share, `category "${name}" share ${share} vs expected ~${expectedShare}`).toBeGreaterThan(expectedShare * 0.6);
      expect(share, `category "${name}" share ${share} vs expected ~${expectedShare}`).toBeLessThan(expectedShare * 1.4);
    }
  });

  it("a small category is not swamped by a much larger category in the same bank", () => {
    // settlementMedieval's "roots" bank mixes shared 15-16-word categories
    // (colors, materials, flora, fauna, directions, landscape descriptors)
    // with one small theme-specific category ("structures", 6 words) — a
    // real, current size disparity to prove the property against.
    const categories = listWordLists(settlementMedieval).filter((l) => l.parent === "roots");
    const structures = categories.find((c) => c.name === "structures")!;
    const colors = categories.find((c) => c.name === "colors")!;
    expect(structures.words.length).toBeLessThan(colors.words.length / 2);

    let structuresCount = 0;
    let colorsCount = 0;
    const rng = makeRng(2);
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const root = generateFromPattern(settlementMedieval, "compound", rng).parts[0];
      if (structures.words.includes(root)) structuresCount++;
      if (colors.words.includes(root)) colorsCount++;
    }
    // Proportional-to-size would give colors ~2.5x+ structures's count;
    // category weighting should keep them within a much smaller ratio.
    const ratio = colorsCount / structuresCount;
    expect(ratio).toBeLessThan(2);
  });
});

describe("generateFromPattern", () => {
  it("always uses the requested pattern, never a random one", () => {
    for (const theme of ALL_THEMES) {
      for (const pattern of theme.patterns) {
        for (let seed = 0; seed < 5; seed++) {
          const name = generateFromPattern(theme, pattern.id, fixedRng(seed));
          expect(name.patternId).toBe(pattern.id);
          expect(name.parts.length).toBe(pattern.slots.length);
        }
      }
    }
  });

  it("is deterministic for the same rng sequence", () => {
    const a = generateFromPattern(settlementMedieval, "compound", fixedRng(11));
    const b = generateFromPattern(settlementMedieval, "compound", fixedRng(11));
    expect(a).toEqual(b);
  });

  it("throws for an unknown pattern id", () => {
    expect(() => generateFromPattern(settlementMedieval, "not-a-real-pattern", fixedRng(1))).toThrow();
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

describe("syllableChain slots (elvish)", () => {
  it("respects minMiddle/maxMiddle bounds across many draws", () => {
    const chain = elvish.patterns[0].slots[0];
    if (chain.type !== "syllableChain") throw new Error("expected a syllableChain slot");
    const { start, end } = chain.chain;
    for (let seed = 0; seed < 100; seed++) {
      // Specifically the "native" pattern — since M4.16 gave elvish the
      // full three-cadence race template, generateName would also roll its
      // compound and native-of patterns, which aren't pure syllable chains.
      const name = generateFromPattern(elvish, "native", fixedRng(seed));
      // Every generated name must start with one of the start syllables and
      // end with one of the end syllables (middles are variable-length, so
      // this is the checkable invariant rather than an exact length).
      expect(start.some((s) => name.text.startsWith(s))).toBe(true);
      expect(end.some((e) => name.text.endsWith(e))).toBe(true);
    }
  });
});

describe("regionName's 3 distinct patterns (M4.14)", () => {
  it("has exactly 3 patterns", () => {
    expect(regionName.patterns.map((p) => p.id).sort()).toEqual(["compound", "nested-of", "the-root-noun"]);
  });

  it("compound produces a single glued word with no spaces", () => {
    for (let seed = 0; seed < 20; seed++) {
      const name = generateFromPattern(regionName, "compound", makeRng(seed));
      expect(name.parts.length).toBe(2);
      expect(name.text).not.toContain(" ");
    }
  });

  it('the-root-noun produces "The [root] [noun]" with no nested "of"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const name = generateFromPattern(regionName, "the-root-noun", makeRng(seed));
      expect(name.text.startsWith("The ")).toBe(true);
      expect(name.text).not.toContain(" of ");
      expect(name.text.split(" ").length).toBe(3); // "The", root, noun
    }
  });

  it('nested-of produces "The [noun] of [descriptor] [compound]" with the compound half unspaced', () => {
    for (let seed = 0; seed < 20; seed++) {
      const name = generateFromPattern(regionName, "nested-of", makeRng(seed));
      expect(name.text.startsWith("The ")).toBe(true);
      expect(name.text).toContain(" of ");
      // "The <noun> of <descriptor> <compound>" — exactly one more space than
      // "of" alone would require, since the trailing compound is one glued word.
      const afterOf = name.text.split(" of ")[1];
      expect(afterOf.split(" ").length).toBe(2);
    }
  });

  it("the 3 patterns produce visibly different cadences for the same seed", () => {
    const seed = 7;
    const compound = generateFromPattern(regionName, "compound", makeRng(seed)).text;
    const phrase = generateFromPattern(regionName, "the-root-noun", makeRng(seed)).text;
    const nested = generateFromPattern(regionName, "nested-of", makeRng(seed)).text;
    expect(new Set([compound, phrase, nested]).size).toBe(3);
  });
});
