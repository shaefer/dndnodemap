// Core data model for nameforge. Zero dependencies, zero imports from
// anywhere outside this folder — see README.md.

export type Rng = () => number;

// A chain of syllable pools for invented-language-style names (e.g. elvish):
// one "start" syllable, zero or more "middle" syllables, one "end" syllable,
// concatenated with no separator.
export interface SyllableChain {
  start: readonly string[];
  middle: readonly string[];
  end: readonly string[];
  minMiddle?: number; // default 0
  maxMiddle?: number; // default 1
}

export interface WordCategory {
  name: string;
  words: readonly string[];
}

// A bank is either a flat list (every word equally likely) or a set of named
// categories. For a categorized bank, generation picks a category *uniformly
// first*, then a word uniformly within it — so category count determines a
// category's influence on output, not category size. Without this, a
// 45-word category would swamp an 8-word category even though both are
// meant to be equally plausible flavors.
export type Bank = readonly string[] | { categories: readonly WordCategory[] };

export type Slot =
  // name is optional, purely descriptive (e.g. "roots", "suffixes") — used by
  // inspect.ts's listWordLists to label a bank for review tooling; generation
  // itself never reads it.
  | { type: "bank"; bank: Bank; name?: string }
  | { type: "literal"; text: string }
  | { type: "syllableChain"; chain: SyllableChain };

export interface Pattern {
  id: string;
  slots: Slot[];
  // Relative likelihood this pattern is chosen by generateName, versus the
  // theme's other patterns — default 1. A pattern with weight 0.3 alongside
  // others at 1 shows up roughly 0.3/(sum of all weights) of the time, not
  // 1/patternCount. Lets a theme mark some patterns as deliberately rare/
  // exotic without a separate probability system.
  weight?: number;
}

export interface Theme {
  id: string;
  patterns: readonly Pattern[];
}

export interface GeneratedName {
  themeId: string;
  patternId: string;
  // One rendered string per slot, in pattern order. Kept as an array (not
  // just the joined text) so a caller can reroll a single slot later without
  // needing to re-parse the assembled name.
  parts: string[];
  text: string;
}
