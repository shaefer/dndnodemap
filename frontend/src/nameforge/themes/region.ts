import { COLORS, DIRECTIONS, GEMS, LANDSCAPE_DESCRIPTORS, MATERIALS, NARRATIVE_DESCRIPTORS } from "../categories";
import type { Bank, Theme } from "../types";

// Grander, multi-word (or, for the compound pattern, terse single-word)
// names for the map's own name — meant to read as a whole region/kingdom.
//
// Roots are entirely shared generic categories (M4.15) — region was the
// original proving ground for category-weighted picking (M4.14), and now
// reuses the same colors/gems/materials/landscape/narrative/directions
// categories every other theme draws from, rather than its own near-copies.
const ROOTS: Bank = {
  categories: [COLORS, GEMS, MATERIALS, LANDSCAPE_DESCRIPTORS, NARRATIVE_DESCRIPTORS, DIRECTIONS],
};

// For the "compound" pattern only (M4.16.4) — excludes DIRECTIONS, mirroring
// settlementMedieval's M4.16.2 fix. A multi-syllable modifier like
// "Northeastern" reads fine before a space-separated noun (ROOTS is used
// that way in "the-root-noun" below) but not glued onto a suffix with no
// separator ("Northeasternrun") — sampled review output caught exactly this
// once the same fix was validated on settlement.
const COMPOUND_ROOTS: Bank = { categories: [COLORS, GEMS, MATERIALS, LANDSCAPE_DESCRIPTORS, NARRATIVE_DESCRIPTORS] };

const NOUNS: Bank = {
  categories: [
    {
      name: "landform nouns",
      // No "Hollow" — it's in the shared LANDSCAPE_DESCRIPTORS these names
      // draw their roots from, which would yield "The Hollow Hollow".
      // No "Weald" (M4.16.3) — obscure archaic word for wooded upland.
      words: ["Vale", "Moor", "Fen", "Downs", "Uplands", "Bottomlands", "Dell", "Basin", "Plateau", "Heath"],
    },
    {
      name: "political nouns",
      words: ["Crownlands", "Kingdoms", "Territories", "Dominion", "Realm", "Duchy", "Province", "Domain", "Empire", "Holdings"],
    },
    {
      name: "boundary nouns",
      words: ["Marches", "Frontier", "Reaches", "Expanse", "Verges", "Borderlands", "Fringes", "Outlands", "Hinterlands", "Edgelands"],
    },
  ],
};

// A small dedicated bank for the compact-compound pattern's second half —
// distinct from the noun categories above (those are meant to stand alone
// or follow "of", not glue onto a root with no space). No "moor"/"vale"/
// "reach" here — NOUNS already has "Moor"/"Vale"/"Reaches", and both banks
// sit together in "the-root-noun"/"nested-of", so an overlap there would
// read as "The Vale of ... Ambervale."
// Also no "hollow" (LANDSCAPE_DESCRIPTORS' "Hollow"), no "crown"/"hold"
// (NOUNS' "Crownlands"/"Holdings" stem-match them), and no "dell" (NOUNS'
// "Dell" exactly matches).
// No "rest" — NARRATIVE_DESCRIPTORS' "Restless" stem-matches it in the
// "compound" pattern, which draws from the full ROOTS aggregate.
const COMPOUND_SUFFIXES = [
  "ward", "spire", "wick", "stead", "mere", "gate", "haven", "fell", "keep", "run", "crest", "watch", "throne", "vault",
] as const;

// For the embedded compound name in "nested-of" only — excludes
// NARRATIVE_DESCRIPTORS, which that same pattern also uses directly for its
// leading descriptor slot, so the two can never coincidentally draw the
// identical word ("The Moor of Dark Darkhold"). Also excludes DIRECTIONS
// (M4.16.4) for the same gluing reason as COMPOUND_ROOTS above — this slot
// glues directly onto COMPOUND_SUFFIXES with no separator too.
const EMBEDDED_ROOTS: Bank = { categories: [COLORS, GEMS, MATERIALS, LANDSCAPE_DESCRIPTORS] };

export const regionName: Theme = {
  id: "regionName",
  patterns: [
    // "Amberhold" — terse, single compound word.
    {
      id: "compound",
      slots: [
        { type: "bank", bank: COMPOUND_ROOTS, name: "roots" },
        { type: "bank", bank: COMPOUND_SUFFIXES, name: "compound suffixes" },
      ],
    },
    // "The Ashen Reaches" — the descriptive two-word phrase.
    {
      id: "the-root-noun",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: ROOTS, name: "roots" },
        { type: "literal", text: " " },
        { type: "bank", bank: NOUNS, name: "nouns" },
      ],
    },
    // "The Moors of Dark Ravenholt" — nested genitive: a landform/political
    // noun, "of", then a narrative descriptor plus an embedded compound name
    // (reusing the same compact-compound shape as the first pattern). The
    // descriptor deliberately draws from NARRATIVE_DESCRIPTORS directly, and
    // the embedded root deliberately draws from EMBEDDED_ROOTS (which
    // excludes narrative descriptors) rather than the full ROOTS — both
    // choices exist so the two slots can never land on the identical word
    // ("The Moor of Dark Darkhold").
    {
      id: "nested-of",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: NOUNS, name: "nouns" },
        { type: "literal", text: " of " },
        { type: "bank", bank: NARRATIVE_DESCRIPTORS.words, name: "narrative descriptors" },
        { type: "literal", text: " " },
        { type: "bank", bank: EMBEDDED_ROOTS, name: "embedded roots" },
        { type: "bank", bank: COMPOUND_SUFFIXES, name: "compound suffixes" },
      ],
    },
  ],
};
