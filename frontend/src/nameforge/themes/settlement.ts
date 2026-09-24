import {
  COLORS,
  DIRECTIONS,
  FANTASY_CREATURES,
  FAUNA,
  FLORA,
  GEMS,
  LANDSCAPE_DESCRIPTORS,
  MATERIALS,
  PERSONAL_NAMES,
} from "../categories";
import type { Bank, Theme, WordCategory } from "../types";

// Classic medieval root+suffix compounding ("Ash" + "ford" = "Ashford"),
// a human-regional possessive pattern ("Devon's Ford"), a plain descriptive
// two-word pattern ("Northern Bridge"), and (M4.16.1) two "named after a
// beast" patterns ("Red Dragon Hall", "Crystal Griffon's Barrow") — real
// cadence variety beyond "every settlement is a fantasy compound."
//
// Roots mix shared generic categories (M4.15 — colors/materials/flora/fauna/
// landscape are reused across many themes, not hand-duplicated) with one
// settlement-specific category (structures) that doesn't generalize.
const STRUCTURES: WordCategory = {
  name: "structures",
  // No "Dovecote" (M4.16.4) — it's itself already a compound word
  // ("dove"+"cote"), so gluing another suffix onto it in the `compound`
  // pattern produced ambiguous results like "Dovecotespring" (Dovecote+
  // spring, or Dove+cotespring?). Replaced with "Rectory," a single
  // morpheme.
  words: [
    "Mill", "Wynd", "Bridge", "Hall", "Barrow", "Croft", "Tower", "Chapel",
    "Market", "Forge", "Granary", "Stable", "Tavern", "Smithy", "Wharf", "Manor",
    "Priory", "Guildhall", "Almonry", "Rectory",
  ],
};

// Deliberately excludes DIRECTIONS (M4.16.2) — a multi-syllable modifier
// word like "Northeastern"/"Windward" is meant to precede a noun with a
// space ("Northern Bridge," the descriptive pattern below), not glue onto a
// suffix with none ("Northeasternford"). That mismatch was the single
// biggest source of the compound pattern producing names that "don't really
// work" — most of the other categories here glue fine (real English
// toponyms compound colors/materials/flora/fauna/landscape words onto place
// suffixes all the time; directions don't).
const ROOTS: Bank = {
  categories: [COLORS, MATERIALS, FLORA, FAUNA, LANDSCAPE_DESCRIPTORS, STRUCTURES],
};

// Stored capitalized (for the possessive pattern: "Devon's Ford"); a
// lowercased derived copy feeds the compound form ("Ashford"). Settlement's
// own suffixes are genuine bound English place-name suffixes (-ford, -mere,
// -bury), unlike poi's/wilderness's full-noun suffixes — which is exactly
// why settlement keeps its glued compound pattern hand-written here while
// _shared.ts's rootSuffixPatterns dropped its own compound form in M4.16.4.
const SUFFIXES_CATEGORIES: WordCategory[] = [
  {
    name: "water features",
    // M4.16.3: removed the archaic-dialect/homograph-risk entries flagged in
    // the human curation pass (Bourne, Rill, Beck, Firth, Lade, Sluice,
    // Fleet, Race, Sound) — a smaller, all-recognizable list beats a larger
    // one full of words nobody would guess mean "a water feature."
    words: ["Ford", "Mere", "Brook", "Reach", "Ferry", "Weir", "Spring", "Wash", "Burn", "Strand", "Tarn"],
  },
  {
    name: "fortification",
    // M4.16.3: removed Redoubt/Barbican/Motte/Bailey (obscure
    // military-architecture jargon) and March (homograph risk with the
    // month/verb).
    words: [
      "Wall", "Burg", "Hold", "Watch", "Keep", "Bastion", "Garrison", "Rampart",
      "Bulwark", "Citadel", "Stockade", "Palisade", "Turret", "Fortress", "Battlement",
    ],
  },
  // No "Hollow" here on purpose — it's already in the shared
  // LANDSCAPE_DESCRIPTORS category these names draw their roots from, and a
  // word on both sides lets the compound pattern render "Hollowhollow".
  {
    name: "landform",
    // No "Scar" (collides with COLORS' "Scarlet") and no "Crag" (collides
    // with LANDSCAPE_DESCRIPTORS' "Craggy") — both roots this bank sits next
    // to in the compound pattern. M4.16.3: removed Hurst/Combe/Cleeve/Brae/
    // Holt/Weald/Cwm (obscure regional-dialect/foreign-loanword terms).
    words: ["Moor", "Crest", "Dale", "Ridge", "Hill", "Glen", "Fell", "Knoll", "Bluff", "Tor", "Vale", "Dell", "Heath"],
  },
  {
    name: "settlement type",
    // No "Ham"/"Toft"/"Stow"/"Ness" (M4.16.2), no "Don"/"By"/"Thwaite"/
    // "Garth"/"Holm" (M4.16.3) — all flagged as too obscure next to the more
    // recognizable Old-English-toponym suffixes this category otherwise
    // favors; "Village"/"Town" (M4.16.2) are the plainly-readable anchors.
    // No "Worth" (M4.16.4) — homograph risk with the common word "worth"
    // (value); no "Chester" — already reads as a complete, real place name
    // on its own (the English city), so using it as a suffix (or after a
    // possessive) reads oddly rather than as a settlement-type word.
    words: [
      "Haven", "Gate", "Wick", "Ton", "Shire", "Stead", "Bury", "Thorpe",
      "Field", "Well", "Cross", "Wood", "Minster", "Village", "Town",
    ],
  },
];
const SUFFIXES: Bank = { categories: SUFFIXES_CATEGORIES };
const SUFFIXES_LOWER: Bank = {
  categories: SUFFIXES_CATEGORIES.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })),
};

// For the two "named after a beast" patterns (M4.16.1). The adjective slot
// deliberately uses only genuinely adjective-flavored shared categories
// (color/gem/material/landscape) — not the full ROOTS aggregate, which also
// mixes in flora/fauna/structures that don't read naturally as adjectives
// ("Oak Dragon Hall"). The creature slot gives flora/fauna/fantasy-creatures
// one category each, so — per the established category-weighting rule — a
// name is about equally likely to reference a plant, a real animal, or a
// monster, regardless of how many words happen to be in each list.
// A locally-filtered copy of COLORS excluding "Ashen" — it stem-collides
// with FLORA's "Ash" ("Ashen Ash Hall") once both sit in this pattern. The
// shared COLORS export itself is untouched; this filtering is specific to
// this one bank pairing.
const BEAST_COLORS: WordCategory = { name: "colors", words: COLORS.words.filter((w) => w !== "Ashen") };
const BEAST_ADJECTIVES: Bank = { categories: [BEAST_COLORS, GEMS, MATERIALS, LANDSCAPE_DESCRIPTORS] };
const BEAST_SUBJECTS: Bank = { categories: [FLORA, FAUNA, FANTASY_CREATURES] };

export const settlementMedieval: Theme = {
  id: "settlementMedieval",
  patterns: [
    // "Ashford" — the fantasy compound.
    {
      id: "compound",
      slots: [
        { type: "bank", bank: ROOTS, name: "roots" },
        { type: "bank", bank: SUFFIXES_LOWER, name: "suffixes" },
      ],
    },
    // "Devon's Ford" — human-regional, a person's name possessing a place.
    {
      id: "possessive",
      slots: [
        { type: "bank", bank: PERSONAL_NAMES.words, name: "personal names" },
        { type: "literal", text: "'s " },
        { type: "bank", bank: SUFFIXES, name: "suffixes" },
      ],
    },
    // "Northern Bridge" — a plain descriptive two-word name, not glued.
    {
      id: "descriptive",
      slots: [
        { type: "bank", bank: DIRECTIONS.words, name: "directions" },
        { type: "literal", text: " " },
        { type: "bank", bank: STRUCTURES.words, name: "structures" },
      ],
    },
    // "Red Dragon Hall" — named after a beast (M4.16.1).
    {
      id: "beast-descriptive",
      slots: [
        { type: "bank", bank: BEAST_ADJECTIVES, name: "beast adjectives" },
        { type: "literal", text: " " },
        { type: "bank", bank: BEAST_SUBJECTS, name: "beast subjects" },
        { type: "literal", text: " " },
        { type: "bank", bank: SUFFIXES, name: "suffixes" },
      ],
    },
    // "Crystal Griffon's Barrow" — the possessive variant of the above.
    {
      id: "beast-possessive",
      slots: [
        { type: "bank", bank: BEAST_ADJECTIVES, name: "beast adjectives" },
        { type: "literal", text: " " },
        { type: "bank", bank: BEAST_SUBJECTS, name: "beast subjects" },
        { type: "literal", text: "'s " },
        { type: "bank", bank: SUFFIXES, name: "suffixes" },
      ],
    },
  ],
};
