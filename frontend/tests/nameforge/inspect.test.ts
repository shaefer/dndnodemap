import { describe, expect, it } from "vitest";
import { ALL_THEMES } from "../../src/nameforge";
import { describePattern, describeSlot, listWordLists } from "../../src/nameforge/inspect";
import { poiFanciful } from "../../src/nameforge/themes/poi";
import { settlementMedieval } from "../../src/nameforge/themes/settlement";
import { elvishSyllable } from "../../src/nameforge/themes/syllable";
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
    for (const theme of [settlementMedieval, poiFanciful, elvishSyllable]) {
      for (const pattern of theme.patterns) {
        expect(describePattern(pattern).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("listWordLists", () => {
  it("returns one entry per named bank, with its full word list", () => {
    const lists = listWordLists(settlementMedieval);
    expect(lists.map((l) => l.name).sort()).toEqual(["roots", "suffixes"]);
    const roots = lists.find((l) => l.name === "roots")!;
    expect(roots.words.length).toBeGreaterThan(0);
    expect(roots.words).toContain("Ash");
  });

  it("dedupes a bank reused (even under a differently-cased derived copy) across multiple patterns by name", () => {
    // poiFanciful's "nouns" bank is drawn from in all three patterns, and the
    // compound pattern uses a separately-derived lowercase copy of it — both
    // are the same category to a human reviewer, so listWordLists must not
    // report "nouns" twice.
    const lists = listWordLists(poiFanciful);
    const nounEntries = lists.filter((l) => l.name === "nouns");
    expect(nounEntries.length).toBe(1);
    expect(lists.map((l) => l.name).sort()).toEqual(["adjectives", "nouns"]);
  });

  it("gives the water feature theme's two distinct root banks distinct names", () => {
    const lists = listWordLists(waterFeature);
    expect(lists.map((l) => l.name).sort()).toEqual(["possessive roots", "roots", "suffixes"]);
  });

  it("exposes a syllableChain's start/middle/end pools as separate named lists", () => {
    const lists = listWordLists(elvishSyllable);
    expect(lists.map((l) => l.name).sort()).toEqual(["end", "middle", "start"]);
    for (const l of lists) expect(l.words.length).toBeGreaterThan(0);
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
    const roots = lists.find((l) => l.name === "roots")!;
    expect(roots.words).toContain("Oak");
  });
});
