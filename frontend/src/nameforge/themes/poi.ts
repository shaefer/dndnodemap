import { COLORS, NARRATIVE_DESCRIPTORS } from "../categories";
import type { Bank, Theme } from "../types";
import { rootSuffixPatterns } from "./_shared";

// Dark/mysterious flavor for ruins, dungeons, lairs, and landmarks.
// M4.15: reuses shared narrativeDescriptors/colors categories alongside a
// poi-specific "ominous" one, and both noun categories expanded to 10-12.
const ADJECTIVES: Bank = {
  categories: [
    NARRATIVE_DESCRIPTORS,
    {
      name: "ominous",
      words: ["Wraith", "Gloom", "Ashen", "Bone", "Ember", "Blackened", "Ghastly", "Spectral", "Baleful", "Eldritch"],
    },
    COLORS,
  ],
};

// Stored capitalized (for the two-word form: "Sunken Spire"); a lowercase
// derived copy feeds the compound form ("Gloomgate") without duplicating
// data — see _shared.ts's rootSuffixPatterns.
const NOUNS: Bank = {
  categories: [
    { name: "burial", words: ["Barrow", "Cairn", "Crypt", "Vault", "Maw", "Tomb", "Sepulcher", "Ossuary", "Catacomb", "Grave"] },
    {
      name: "structures",
      words: ["Spire", "Gate", "Keep", "Fane", "Throne", "Hold", "Watch", "Sanctum", "Shrine", "Bastion", "Citadel", "Tower"],
    },
    { name: "landscape", words: ["Hollow", "Mere", "Reach", "Deep", "Chasm", "Abyss", "Rift", "Pit", "Void", "Trench"] },
  ],
};

export const poiFanciful: Theme = {
  id: "poiFanciful",
  patterns: rootSuffixPatterns(ADJECTIVES, NOUNS, { roots: "adjectives", suffixes: "nouns" }),
};
