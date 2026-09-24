import type { Bank, Pattern, Theme } from "../types";

export interface RootSuffixLabels {
  roots?: string; // default "roots"
  suffixes?: string; // default "suffixes"
}

// Shared by the poi/wilderness themes: a standard one-pattern shape built
// from one capitalized root bank + one capitalized suffix bank — "Ash Ford"
// or "The Ash Ford" (a coin-flip "The" prefix — M4.16.4 merged what used to
// be two separate patterns, "two-word" and "the-two-word", into one; a
// reviewer pointed out that "with or without a leading 'The'" isn't a
// genuinely different pattern shape any more than a direction word and a
// color word filling the same slot is a different pattern (the M4.14
// lesson), so having two Pattern entries for it was double-counting the
// same idea. The merge needed no new engine capability — the leading
// "The " is just another bank pick, a 2-entry array of `["", "The "]`,
// reusing the exact same uniform bank-choice machinery every other slot
// already uses).
//
// This also used to include a third, glued "compound" pattern ("Ashford")
// — removed in M4.16.4 after review: unlike settlement's suffixes (real
// bound English place-name suffixes like "-ford"/"-mere", which glue onto
// an adjective and read as an actual town name), poi's and wilderness's
// "suffixes" (Gate, Rift, Meadow, Grove, Precipice) are full standalone
// nouns, not bound morphemes — gluing a full noun onto an adjective with no
// separator doesn't mimic any real naming convention, it just produces an
// unwieldy run-on word ("Forsakenunderdepth"). Settlement's own compound
// pattern is unaffected — it's hand-written directly in settlement.ts, not
// built from this helper, precisely because its suffix vocabulary is
// genuinely glue-shaped and the others' isn't.
//
// Both banks may be flat arrays or categorized (M4.14) — category-weighted
// picking is handled by generate.ts, transparently to this helper. `labels`
// lets a theme whose two halves aren't literally "roots"/"suffixes" (e.g.
// poiFanciful's adjectives/nouns) give them more accurate review-UI names.
export function rootSuffixPatterns(roots: Bank, suffixesCapitalized: Bank, labels: RootSuffixLabels = {}): Pattern[] {
  const rootsName = labels.roots ?? "roots";
  const suffixesName = labels.suffixes ?? "suffixes";
  return [
    {
      id: "two-word",
      slots: [
        { type: "bank", bank: ["", "The "], name: "the (optional)" },
        { type: "bank", bank: roots, name: rootsName },
        { type: "literal", text: " " },
        { type: "bank", bank: suffixesCapitalized, name: suffixesName },
      ],
    },
  ];
}

export function rootSuffixTheme(id: string, roots: Bank, suffixesCapitalized: Bank, labels: RootSuffixLabels = {}): Theme {
  return { id, patterns: rootSuffixPatterns(roots, suffixesCapitalized, labels) };
}
