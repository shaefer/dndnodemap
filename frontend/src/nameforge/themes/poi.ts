import type { Bank, Theme } from "../types";
import { rootSuffixPatterns } from "./_shared";

// Dark/mysterious flavor for ruins, dungeons, lairs, and landmarks.
// Both banks are categorized (M4.14) — see themes/region.ts for the full
// rationale on category-weighted picking.
const ADJECTIVES: Bank = {
  categories: [
    { name: "decay", words: ["Sunken", "Broken", "Shattered", "Drowned", "Forgotten", "Forsaken"] },
    { name: "somber", words: ["Silent", "Weeping", "Whispering", "Hollow", "Old"] },
    { name: "ominous", words: ["Wraith", "Gloom", "Cursed"] },
    { name: "elemental", words: ["Ashen", "Bone", "Ember", "Black", "Blackened", "Grey"] },
  ],
};

// Stored capitalized (for the two-word form: "Sunken Spire"); a lowercase
// derived copy feeds the compound form ("Gloomgate") without duplicating
// data — see _shared.ts's rootSuffixPatterns.
const NOUNS: Bank = {
  categories: [
    { name: "burial", words: ["Barrow", "Cairn", "Crypt", "Vault", "Maw"] },
    { name: "structures", words: ["Spire", "Gate", "Keep", "Fane", "Throne", "Hold", "Watch"] },
    { name: "landscape", words: ["Hollow", "Mere", "Reach", "Deep"] },
  ],
};

export const poiFanciful: Theme = {
  id: "poiFanciful",
  patterns: rootSuffixPatterns(ADJECTIVES, NOUNS, { roots: "adjectives", suffixes: "nouns" }),
};
