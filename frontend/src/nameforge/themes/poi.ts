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

// Stored capitalized — the two-word form's only shape since M4.16.4
// dropped the glued "compound" pattern (see _shared.ts's
// rootSuffixPatterns for why).
const NOUNS: Bank = {
  categories: [
    {
      // No "Bier" (M4.16.3) — obscure, "a stand a corpse/coffin rests on."
      name: "burial",
      words: [
        "Barrow", "Cairn", "Crypt", "Vault", "Maw", "Tomb", "Sepulcher", "Ossuary", "Catacomb", "Grave",
        "Mausoleum", "Reliquary", "Charnel", "Undertomb", "Gravemound", "Sarcophagus", "Deadhouse", "Ashpit", "Graveyard",
      ],
    },
    {
      // No "Fane" (M4.16.3) — archaic word for "temple," obscure standalone.
      name: "structures",
      words: [
        "Spire", "Gate", "Keep", "Throne", "Hold", "Watch", "Sanctum", "Shrine", "Bastion", "Citadel", "Tower",
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
