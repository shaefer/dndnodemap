import type { Pattern, Theme } from "../types";

// Shared by the settlement/poi/wilderness themes: a standard three-pattern
// shape built from one capitalized root bank + one capitalized suffix bank
// (a lowercase copy of the suffix bank is derived automatically for the
// compound form) — "Ashford" (compound), "Ash Ford" (two-word), "The Ash
// Ford" (the-prefixed). Not every theme uses all three patterns, but this
// keeps them from being hand-retyped per theme.
export function rootSuffixPatterns(roots: readonly string[], suffixesCapitalized: readonly string[]): Pattern[] {
  const suffixesLower = suffixesCapitalized.map((s) => s.toLowerCase());
  return [
    {
      id: "compound",
      slots: [
        { type: "bank", bank: roots, name: "roots" },
        { type: "bank", bank: suffixesLower, name: "suffixes" },
      ],
    },
    {
      id: "two-word",
      slots: [
        { type: "bank", bank: roots, name: "roots" },
        { type: "literal", text: " " },
        { type: "bank", bank: suffixesCapitalized, name: "suffixes" },
      ],
    },
    {
      id: "the-two-word",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: roots, name: "roots" },
        { type: "literal", text: " " },
        { type: "bank", bank: suffixesCapitalized, name: "suffixes" },
      ],
    },
  ];
}

export function rootSuffixTheme(id: string, roots: readonly string[], suffixesCapitalized: readonly string[]): Theme {
  return { id, patterns: rootSuffixPatterns(roots, suffixesCapitalized) };
}
