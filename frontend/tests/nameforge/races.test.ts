import { describe, expect, it } from "vitest";
import { makeRng } from "../../src/core/rng";
import { ALL_RACE_THEMES, ALL_THEMES } from "../../src/nameforge";
import { generateFromPattern, generateName } from "../../src/nameforge/generate";
import { listWordLists } from "../../src/nameforge/inspect";

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

  it("never lets a root and a suffix share a word or a stem, in ANY theme", () => {
    // A word in both banks lets the compound pattern render "Forgeforge";
    // a shared *stem* gives the subtler "Barrenbarrens" / "The Wild Wilds" /
    // "Sandsands". Both were widespread on the first pass (13 of 16 races
    // plus several wilderness/region themes), so this guards every theme,
    // not just the race ones.
    for (const theme of ALL_THEMES) {
      const tops = listWordLists(theme).filter((l) => l.parent === undefined);
      const roots = tops.find((l) => l.name === "roots");
      if (!roots) continue;
      // Compare roots against every other bank in the theme — the second
      // half of a compound goes by different names across themes
      // ("suffixes", "nouns", "compound suffixes"), and all of them can end
      // up glued to a root.
      const collisions: string[] = [];
      // Syllable pools are excluded: they belong to the "native" pattern and
      // are never glued to a root, so an overlap there is harmless (and in
      // fact desirable — it's what makes a race's two naming styles sound
      // like the same language).
      const SYLLABLE_POOLS = ["start", "middle", "end"];
      for (const other of tops) {
        if (other.name === "roots" || SYLLABLE_POOLS.includes(other.name)) continue;
        for (const r of roots.words) {
          for (const s of other.words) {
            const a = r.toLowerCase();
            const b = s.toLowerCase();
            if (a === b || a.startsWith(b) || b.startsWith(a)) collisions.push(`${r}+${s}`);
          }
        }
      }
      expect(collisions, `${theme.id} root/suffix collisions`).toEqual([]);
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
