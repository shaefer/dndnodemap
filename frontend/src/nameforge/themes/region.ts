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

const NOUNS: Bank = {
  categories: [
    {
      name: "landform nouns",
      // No "Hollow" — it's in the shared LANDSCAPE_DESCRIPTORS these names
      // draw their roots from, which would yield "The Hollow Hollow".
      words: ["Vale", "Moor", "Fen", "Weald", "Downs", "Uplands", "Bottomlands", "Dell", "Basin", "Plateau", "Heath"],
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
// or follow "of", not glue onto a root with no space).
const COMPOUND_SUFFIXES = [
  "hold", "reach", "moor", "ward", "crown", "spire", "wick", "stead", "mere", "vale", "gate", "haven", "fell", "keep",
] as const;

export const regionName: Theme = {
  id: "regionName",
  patterns: [
    // "Amberhold" — terse, single compound word.
    {
      id: "compound",
      slots: [
        { type: "bank", bank: ROOTS, name: "roots" },
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
    // descriptor deliberately draws from NARRATIVE_DESCRIPTORS directly
    // (not the full ROOTS aggregate) — it's the specific mood this
    // construction wants, and avoids two independent draws from the same
    // full aggregate landing in one name.
    {
      id: "nested-of",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: NOUNS, name: "nouns" },
        { type: "literal", text: " of " },
        { type: "bank", bank: NARRATIVE_DESCRIPTORS.words, name: "narrative descriptors" },
        { type: "literal", text: " " },
        { type: "bank", bank: ROOTS, name: "roots" },
        { type: "bank", bank: COMPOUND_SUFFIXES, name: "compound suffixes" },
      ],
    },
  ],
};
