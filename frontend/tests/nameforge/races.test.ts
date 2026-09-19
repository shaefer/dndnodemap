import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/core/rng";
import { ALL_RACE_THEMES, ALL_THEMES } from "../../src/nameforge";
import { generateFromPattern, generateName } from "../../src/nameforge/generate";
import type { Bank, Slot } from "../../src/nameforge/types";

function bankWords(bank: Bank): readonly string[] {
  return "categories" in bank ? bank.categories.flatMap((c) => c.words) : bank;
}

// The 16 race/species place-naming themes added in M4.16 (human is
// deliberately absent — settlementMedieval's possessive/descriptive patterns
// already cover human-flavored place names).
const EXPECTED_RACES = [
  "aasimar", "beholder", "draconic", "drow", "dwarvish", "elvish", "giant", "gnomish",
  "goblin", "goliath", "halfling", "illithid", "lizardfolk", "minotaur", "orcish", "tiefling",
];

describe("race themes (M4.16)", () => {
  it("registers every expected race", () => {
    expect(ALL_RACE_THEMES.map((t) => t.id).sort()).toEqual([...EXPECTED_RACES].sort());
  });

  it("gives every race the three-cadence template (native / compound / native-of)", () => {
    for (const theme of ALL_RACE_THEMES) {
      const ids = theme.patterns.map((p) => p.id);
      for (const required of ["native", "compound", "native-of"]) {
        expect(ids, `${theme.id} patterns`).toContain(required);
      }
      expect(theme.patterns.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("produces non-empty names from every pattern of every race", () => {
    for (const theme of ALL_RACE_THEMES) {
      for (const pattern of theme.patterns) {
        for (let seed = 0; seed < 10; seed++) {
          const name = generateFromPattern(theme, pattern.id, makeRng(seed));
          expect(name.text.trim().length, `${theme.id}/${pattern.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("is deterministic per seed, like every other theme", () => {
    for (const theme of ALL_RACE_THEMES) {
      expect(generateName(theme, makeRng(7))).toEqual(generateName(theme, makeRng(7)));
    }
  });

  it("never lets two bank slots *in the same pattern* share a word or a stem", () => {
    // A word shared by two bank slots that appear together in one pattern
    // lets that pattern render "Forgeforge" (glued) or "The Wild Wilds"/
    // "Dragon Dragon Hall" (spaced) — either way a repeat, not a name. This
    // is scoped per-pattern (not "roots vs. every other bank in the theme")
    // because M4.16.1 gave several themes more than one root-like/suffix
    // -like bank pair (settlement's plain roots+suffixes vs. its separate
    // beast-adjectives+beast-subjects+suffixes for the "named after a beast"
    // patterns) — those pairs intentionally share source categories
    // (colors, materials...) but never sit in the same pattern together, so
    // a theme-wide check produces false positives there. Syllable-chain
    // slots are skipped: they're rendered by concatenating pool entries
    // directly, not picked-and-compared against a sibling bank slot, so
    // this check doesn't apply to them.
    for (const theme of ALL_THEMES) {
      for (const pattern of theme.patterns) {
        const bankSlots = pattern.slots.filter((s): s is Extract<Slot, { type: "bank" }> => s.type === "bank");
        const collisions: string[] = [];
        for (let i = 0; i < bankSlots.length; i++) {
          for (let j = i + 1; j < bankSlots.length; j++) {
            const wordsA = bankWords(bankSlots[i].bank);
            const wordsB = bankWords(bankSlots[j].bank);
            for (const a of wordsA) {
              for (const b of wordsB) {
                const la = a.toLowerCase();
                const lb = b.toLowerCase();
                if (la === lb || la.startsWith(lb) || lb.startsWith(la)) collisions.push(`${a}+${b}`);
              }
            }
          }
        }
        expect(collisions, `${theme.id}/${pattern.id} bank-slot collisions`).toEqual([]);
      }
    }
  });

  it("never emits a run of 3+ identical letters from a syllable join", () => {
    // "Dill" + "ly" -> "Dillly", "Sess" + "sha" -> "Sesssha". Doubles read as
    // deliberate; triples read as typos, so renderSyllableChain collapses
    // them. Broad sample since these only surface on specific joins.
    for (const theme of ALL_RACE_THEMES) {
      for (let seed = 0; seed < 300; seed++) {
        const text = generateFromPattern(theme, "native", makeRng(seed)).text;
        expect(/(.)\1\1/i.test(text), `${theme.id} produced "${text}"`).toBe(false);
      }
    }
  });

  it("keeps a native name bracketed by its own start and end syllables", () => {
    // The letter-run collapsing must not eat a boundary syllable.
    for (const theme of ALL_RACE_THEMES) {
      const slot = theme.patterns.find((p) => p.id === "native")!.slots[0];
      if (slot.type !== "syllableChain") throw new Error(`${theme.id} native slot is not a syllableChain`);
      const { start, end } = slot.chain;
      for (let seed = 0; seed < 50; seed++) {
        const text = generateFromPattern(theme, "native", makeRng(seed)).text;
        const startsOk = start.some((s) => text.startsWith(s.slice(0, 2)));
        const endsOk = end.some((e) => text.endsWith(e.slice(-2)));
        expect(startsOk && endsOk, `${theme.id} produced "${text}"`).toBe(true);
      }
    }
  });

  it("gives goliath hyphenated deed-names and tiefling a virtue pattern", () => {
    const goliath = ALL_RACE_THEMES.find((t) => t.id === "goliath")!;
    for (let seed = 0; seed < 10; seed++) {
      expect(generateFromPattern(goliath, "compound", makeRng(seed)).text).toContain("-");
    }
    const tiefling = ALL_RACE_THEMES.find((t) => t.id === "tiefling")!;
    expect(tiefling.patterns.map((p) => p.id)).toContain("virtue");
    expect(generateFromPattern(tiefling, "virtue", makeRng(1)).text.startsWith("The ")).toBe(true);
  });
});
