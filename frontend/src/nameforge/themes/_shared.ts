import type { Bank, Pattern, Theme } from "../types";

// Lowercases every word in a bank, preserving its category structure (if
// any) — used to derive a compound-form suffix bank from a capitalized
// two-word-form one without hand-duplicating category data.
function lowerBank(bank: Bank): Bank {
  if ("categories" in bank) {
    return { categories: bank.categories.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })) };
  }
  return bank.map((w) => w.toLowerCase());
}

export interface RootSuffixLabels {
  roots?: string; // default "roots"
  suffixes?: string; // default "suffixes"
}

// Shared by the settlement/poi/wilderness themes: a standard three-pattern
// shape built from one capitalized root bank + one capitalized suffix bank
// (a lowercase copy of the suffix bank is derived automatically for the
// compound form) — "Ashford" (compound), "Ash Ford" (two-word), "The Ash
// Ford" (the-prefixed). Not every theme uses all three patterns, but this
// keeps them from being hand-retyped per theme. Both banks may be flat
// arrays or categorized (M4.14) — category-weighted picking is handled by
// generate.ts, transparently to this helper. `labels` lets a theme whose
// two halves aren't literally "roots"/"suffixes" (e.g. poiFanciful's
// adjectives/nouns) give them more accurate review-UI names.
export function rootSuffixPatterns(roots: Bank, suffixesCapitalized: Bank, labels: RootSuffixLabels = {}): Pattern[] {
  const rootsName = labels.roots ?? "roots";
  const suffixesName = labels.suffixes ?? "suffixes";
  const suffixesLower = lowerBank(suffixesCapitalized);
  return [
    {
      id: "compound",
      slots: [
        { type: "bank", bank: roots, name: rootsName },
        { type: "bank", bank: suffixesLower, name: suffixesName },
      ],
    },
    {
      id: "two-word",
      slots: [
        { type: "bank", bank: roots, name: rootsName },
        { type: "literal", text: " " },
        { type: "bank", bank: suffixesCapitalized, name: suffixesName },
      ],
    },
    {
      id: "the-two-word",
      slots: [
        { type: "literal", text: "The " },
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
