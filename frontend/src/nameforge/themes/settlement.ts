import { COLORS, DIRECTIONS, FAUNA, FLORA, LANDSCAPE_DESCRIPTORS, MATERIALS, PERSONAL_NAMES } from "../categories";
import type { Bank, Theme, WordCategory } from "../types";

// Classic medieval root+suffix compounding ("Ash" + "ford" = "Ashford"),
// plus (M4.15) a human-regional possessive pattern ("Devon's Ford") and a
// plain descriptive two-word pattern ("Northern Bridge") — real cadence
// variety beyond "every settlement is a fantasy compound."
//
// Roots mix shared generic categories (M4.15 — colors/materials/flora/fauna/
// directions/landscape are reused across many themes, not hand-duplicated)
// with one settlement-specific category (structures) that doesn't generalize.
const STRUCTURES: WordCategory = { name: "structures", words: ["Mill", "Wynd", "Bridge", "Hall", "Barrow", "Croft"] };

const ROOTS: Bank = {
  categories: [COLORS, MATERIALS, FLORA, FAUNA, DIRECTIONS, LANDSCAPE_DESCRIPTORS, STRUCTURES],
};

// Stored capitalized (for the possessive pattern: "Devon's Ford"); a
// lowercased derived copy feeds the compound form ("Ashford") — same
// approach as _shared.ts's rootSuffixPatterns.
const SUFFIXES_CATEGORIES: WordCategory[] = [
  { name: "water features", words: ["Ford", "Mere", "Brook", "Reach", "Ferry", "Weir", "Spring", "Bourne"] },
  {
    name: "fortification",
    words: ["Wall", "Burg", "Hold", "Watch", "March", "Keep", "Bastion", "Garrison", "Rampart"],
  },
  // No "Hollow" here on purpose — it's already in the shared
  // LANDSCAPE_DESCRIPTORS category these names draw their roots from, and a
  // word on both sides lets the compound pattern render "Hollowhollow".
  { name: "landform", words: ["Hurst", "Moor", "Crest", "Dale", "Ridge", "Hill", "Glen", "Combe"] },
  {
    name: "settlement type",
    words: ["Haven", "Gate", "Wick", "Ton", "Shire", "Stead", "Worth", "Bury", "Ham", "Thorpe", "Don", "Holm"],
  },
];
const SUFFIXES: Bank = { categories: SUFFIXES_CATEGORIES };
const SUFFIXES_LOWER: Bank = {
  categories: SUFFIXES_CATEGORIES.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })),
};

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
  ],
};
