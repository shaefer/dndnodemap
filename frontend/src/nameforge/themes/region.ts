import type { Bank, Theme, WordCategory } from "../types";

// Grander, multi-word (or, for the compound pattern, terse single-word)
// names for the map's own name — meant to read as a whole region/kingdom.
//
// Roots and nouns are both *categorized* banks (M4.14): a category is picked
// uniformly first, then a word uniformly within it, so e.g. a 6-word "gems"
// category and a 4-word "materials" category each get an equal ~1/N shot
// regardless of their own size — without this, whichever category happened
// to have the most words would quietly dominate output.
const NARRATIVE_DESCRIPTORS: WordCategory = {
  name: "narrative descriptors",
  words: ["Forsaken", "Lost", "Ancient", "Silent", "Dark", "Old", "Forgotten"],
};

const ROOTS: Bank = {
  categories: [
    { name: "colors", words: ["Ashen", "Silver", "Golden", "Grey", "Verdant", "Crimson"] },
    { name: "gems", words: ["Emerald", "Amber", "Onyx", "Opal", "Jade", "Sapphire"] },
    { name: "materials", words: ["Iron", "Stone", "Ivory", "Bronze"] },
    { name: "landscape descriptors", words: ["Shattered", "Hollow", "Sunken", "Storm", "Wild", "Winter"] },
    NARRATIVE_DESCRIPTORS,
    { name: "directions", words: ["Northern", "Southern", "Eastern", "Western", "Far", "Distant"] },
  ],
};

const NOUNS: Bank = {
  categories: [
    { name: "landform nouns", words: ["Vale", "Moor", "Fen", "Weald", "Downs", "Highlands", "Lowlands"] },
    { name: "political nouns", words: ["Crownlands", "Kingdoms", "Territories", "Dominion", "Realm"] },
    { name: "boundary nouns", words: ["Marches", "Frontier", "Reaches", "Expanse", "Wilds"] },
  ],
};

// A small dedicated bank for the compact-compound pattern's second half —
// distinct from the noun categories above (those are meant to stand alone
// or follow "of", not glue onto a root with no space).
const COMPOUND_SUFFIXES = ["hold", "reach", "moor", "ward", "crown", "spire", "wick", "stead", "mere", "vale"] as const;

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
