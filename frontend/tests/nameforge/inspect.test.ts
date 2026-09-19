import { describe, expect, it } from "vitest";
import { ALL_THEMES } from "../../src/nameforge";
import { COLORS } from "../../src/nameforge/categories";
import { describePattern, describeSlot, listWordLists } from "../../src/nameforge/inspect";
import { poiFanciful } from "../../src/nameforge/themes/poi";
import { regionName } from "../../src/nameforge/themes/region";
import { settlementMedieval } from "../../src/nameforge/themes/settlement";
import { elvish } from "../../src/nameforge/themes/races/classic";
import { waterFeature, wildernessForest } from "../../src/nameforge/themes/wilderness";
import type { Slot } from "../../src/nameforge/types";

describe("describeSlot", () => {
  it("describes a bank slot with its word count", () => {
    const slot: Slot = { type: "bank", bank: ["a", "b", "c"] };
    expect(describeSlot(slot)).toBe("bank(3 words)");
  });

  it("describes a literal slot with its exact text, quoted", () => {
    const slot: Slot = { type: "literal", text: "The " };
    expect(describeSlot(slot)).toBe('literal("The ")');
  });

  it("describes a syllableChain slot with each pool's size", () => {
    const slot: Slot = {
      type: "syllableChain",
      chain: { start: ["a", "b"], middle: ["c"], end: ["d", "e", "f"] },
    };
    expect(describeSlot(slot)).toBe("syllableChain(start:2, middle:1, end:3)");
  });
});

describe("describePattern", () => {
  it("joins every slot's description with ' + '", () => {
    const pattern = settlementMedieval.patterns[0];
    const description = describePattern(pattern);
    expect(description).toContain(" + ");
    expect(description.split(" + ").length).toBe(pattern.slots.length);
  });

  it("produces a non-empty description for every pattern in every theme", () => {
    for (const theme of [settlementMedieval, poiFanciful, elvish]) {
      for (const pattern of theme.patterns) {
        expect(describePattern(pattern).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("listWordLists", () => {
  it("returns an aggregate entry for a categorized bank, containing every category's words", () => {
    const lists = listWordLists(settlementMedieval);
    const roots = lists.find((l) => l.name === "roots" && l.parent === undefined)!;
    expect(roots).toBeDefined();
    expect(roots.words.length).toBeGreaterThan(0);
    expect(roots.words).toContain("Ash");
  });

  it("also returns each of a categorized bank's sub-categories, parented to the aggregate", () => {
    const lists = listWordLists(settlementMedieval);
    const flora = lists.find((l) => l.name === "flora")!;
    expect(flora).toBeDefined();
    expect(flora.parent).toBe("roots");
    expect(flora.words).toContain("Oak");
    // The aggregate must contain every word from every one of its categories.
    const roots = lists.find((l) => l.name === "roots" && l.parent === undefined)!;
    for (const word of flora.words) expect(roots.words).toContain(word);
  });

  it("dedupes a bank reused (even under a differently-cased derived copy) across multiple patterns by name", () => {
    // poiFanciful's "nouns" bank is drawn from in all three patterns, and the
    // compound pattern uses a separately-derived lowercase copy of it — both
    // are the same category to a human reviewer, so listWordLists must not
    // report the "nouns" aggregate twice, nor any of its sub-categories twice.
    const lists = listWordLists(poiFanciful);
    const nounAggregates = lists.filter((l) => l.name === "nouns" && l.parent === undefined);
    expect(nounAggregates.length).toBe(1);
    const burialEntries = lists.filter((l) => l.name === "burial");
    expect(burialEntries.length).toBe(1);
  });

  it("gives the water feature theme's two distinct root banks distinct aggregate names", () => {
    const lists = listWordLists(waterFeature);
    const topLevel = lists.filter((l) => l.parent === undefined).map((l) => l.name);
    expect(topLevel.sort()).toEqual(["possessive roots", "roots", "suffixes"]);
  });

  it("exposes a syllableChain's start/middle/end pools as separate named lists", () => {
    // elvish is a full race theme since M4.16 — syllable pools *and* the
    // root/suffix banks its compound pattern uses — so assert the chain
    // pools are present rather than that they're the only entries.
    const names = listWordLists(elvish).map((l) => l.name);
    for (const pool of ["start", "middle", "end"]) expect(names).toContain(pool);
    for (const l of listWordLists(elvish)) expect(l.words.length).toBeGreaterThan(0);
  });

  it("produces at least one non-empty word list for every registered theme", () => {
    for (const theme of ALL_THEMES) {
      const lists = listWordLists(theme);
      expect(lists.length).toBeGreaterThan(0);
      for (const l of lists) expect(l.words.length).toBeGreaterThan(0);
    }
  });

  it("wildernessForest's roots/suffixes reflect its own word set, not another biome's", () => {
    const lists = listWordLists(wildernessForest);
    const roots = lists.find((l) => l.name === "roots" && l.parent === undefined)!;
    expect(roots.words).toContain("Oak");
  });

  it("a shared category reports identical contents wherever it's reused (M4.15)", () => {
    // COLORS is the same object in settlementMedieval's and regionName's
    // root banks — the whole point of the shared category library is that
    // these can't silently drift apart into near-duplicate lists.
    const settlementColors = listWordLists(settlementMedieval).find((l) => l.name === "colors")!;
    const regionColors = listWordLists(regionName).find((l) => l.name === "colors")!;
    expect(settlementColors.words).toEqual(COLORS.words);
    expect(regionColors.words).toEqual(COLORS.words);
  });

  it("every category in every theme now has real depth (M4.15)", () => {
    for (const theme of ALL_THEMES) {
      for (const list of listWordLists(theme)) {
        // Sub-categories should be meaningfully sized; aggregates are larger
        // by construction. A handful of deliberately-small theme-specific
        // categories (e.g. settlement "structures") sit at 5+.
        expect(list.words.length, `${theme.id} / ${list.name}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe("pattern counts (M4.15)", () => {
  it("every theme has at least 3 patterns — no exceptions", () => {
    // elvish was the one holdout through M4.15 (a single-pattern
    // syllable-chain demonstration); M4.16 rebuilt it as a full race theme,
    // so the rule now holds universally.
    for (const theme of ALL_THEMES) {
      expect(theme.patterns.length, `${theme.id} pattern count`).toBeGreaterThanOrEqual(3);
    }
  });
});
