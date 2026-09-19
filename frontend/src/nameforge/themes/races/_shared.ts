import type { Bank, Pattern, SyllableChain, Theme, WordCategory } from "../../types";

// Shared shape for every race/species place-naming theme (M4.16).
//
// These themes name *places in a culture's style* — a dwarvish stronghold, an
// orcish camp — not individual people. (Person naming arrives with M4.18's
// legendary-figure generator.) Each race gets the same three-cadence
// template, so the variety between races comes from their word content and
// phonetics rather than from each file inventing its own structure:
//
//   native     a pure invented word in that race's tongue   "Khazrundum"
//   compound   a common-tongue compound place name          "Ironforge"
//   native-of  the two blended into a phrase                "The Deeps of Khazrun"
//
// A race can pass extra patterns for a flavor its culture specifically calls
// for (goliath's hyphenated deed-names, for instance).

export interface RaceThemeSpec {
  id: string;
  // The race's native tongue — start/middle/end syllable pools tuned to
  // sound right in sequence.
  chain: SyllableChain;
  // Common-tongue descriptor roots (capitalized), and place-word suffixes
  // (capitalized; a lowercase copy is derived for the compound form).
  roots: Bank;
  suffixes: Bank;
  // Joins root and suffix in the compound pattern — "" glues them into one
  // word ("Ironforge"); "-" gives goliath-style deed-names ("Stone-Breaker").
  compoundSeparator?: string;
  extraPatterns?: Pattern[];
}

function lowerBank(bank: Bank): Bank {
  if ("categories" in bank) {
    return { categories: bank.categories.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })) };
  }
  return bank.map((w) => w.toLowerCase());
}

export function raceTheme(spec: RaceThemeSpec): Theme {
  const separator = spec.compoundSeparator ?? "";
  // A hyphenated/spaced compound keeps both halves capitalized; a glued one
  // needs the suffix lowercased so it reads as one word.
  const compoundSuffixes = separator === "" ? lowerBank(spec.suffixes) : spec.suffixes;

  const compoundSlots: Pattern["slots"] = [{ type: "bank", bank: spec.roots, name: "roots" }];
  if (separator !== "") compoundSlots.push({ type: "literal", text: separator });
  compoundSlots.push({ type: "bank", bank: compoundSuffixes, name: "suffixes" });

  return {
    id: spec.id,
    patterns: [
      { id: "native", slots: [{ type: "syllableChain", chain: spec.chain }] },
      { id: "compound", slots: compoundSlots },
      {
        id: "native-of",
        slots: [
          { type: "literal", text: "The " },
          { type: "bank", bank: spec.suffixes, name: "suffixes" },
          { type: "literal", text: " of " },
          { type: "syllableChain", chain: spec.chain },
        ],
      },
      ...(spec.extraPatterns ?? []),
    ],
  };
}

// Convenience for the common "two or three flavor categories" root/suffix
// shape every race file uses.
export function cats(...categories: WordCategory[]): Bank {
  return { categories };
}
