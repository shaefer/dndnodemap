import { COLORS, NARRATIVE_DESCRIPTORS } from "../categories";
import type { Bank, Theme } from "../types";
import { rootSuffixPatterns } from "./_shared";

// Dark/mysterious flavor for ruins, dungeons, lairs, and landmarks.
// Reuses shared narrativeDescriptors/colors categories alongside a
// poi-specific "ominous" one (no "Ashen" here — it's already in COLORS,
// which sits in this same aggregate bank).
const ADJECTIVES: Bank = {
  categories: [
    NARRATIVE_DESCRIPTORS,
    {
      name: "ominous",
      words: [
        "Wraith", "Gloom", "Bone", "Ember", "Blackened", "Ghastly", "Spectral", "Baleful", "Eldritch",
        "Doom", "Withered", "Rotting", "Vile", "Foreboding", "Sinister", "Malevolent", "Accursed", "Dreadful", "Unholy", "Fell",
      ],
    },
    COLORS,
  ],
};

// Stored capitalized (for the two-word form: "Sunken Spire"); a lowercase
// derived copy feeds the compound form ("Gloomgate") without duplicating
// data — see _shared.ts's rootSuffixPatterns.
const NOUNS: Bank = {
  categories: [
    {
      name: "burial",
      words: [
        "Barrow", "Cairn", "Crypt", "Vault", "Maw", "Tomb", "Sepulcher", "Ossuary", "Catacomb", "Grave",
        "Mausoleum", "Reliquary", "Bier", "Charnel", "Undertomb", "Gravemound", "Sarcophagus", "Deadhouse", "Ashpit", "Graveyard",
      ],
    },
    {
      name: "structures",
      words: [
        "Spire", "Gate", "Keep", "Fane", "Throne", "Hold", "Watch", "Sanctum", "Shrine", "Bastion", "Citadel", "Tower",
        "Temple", "Chapel", "Obelisk", "Monument", "Altar", "Colonnade", "Rotunda", "Parapet",
      ],
    },
    {
      name: "landscape",
      words: [
        "Hollow", "Mere", "Reach", "Deep", "Chasm", "Abyss", "Rift", "Pit", "Void", "Trench",
        "Ravine", "Gorge", "Sinkhole", "Crevasse", "Grotto", "Cavern", "Fissure", "Gulf", "Precipice", "Underdepth",
      ],
    },
  ],
};

export const poiFanciful: Theme = {
  id: "poiFanciful",
  patterns: rootSuffixPatterns(ADJECTIVES, NOUNS, { roots: "adjectives", suffixes: "nouns" }),
};
