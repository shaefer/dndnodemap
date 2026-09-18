import type { Theme } from "../types";

// Dark/mysterious flavor for ruins, dungeons, lairs, and landmarks.
const ADJECTIVES = [
  "Sunken", "Wraith", "Gloom", "Ashen", "Bone", "Silent", "Broken", "Blackened",
  "Weeping", "Whispering", "Shattered", "Forsaken", "Drowned", "Ember", "Cursed",
  "Forgotten", "Old", "Black", "Grey", "Hollow",
] as const;

// Stored capitalized (for the two-word form: "Sunken Spire"); a lowercase
// derived copy feeds the compound form ("Gloomgate") without duplicating data.
const NOUNS = [
  "Hollow", "Spire", "Gate", "Mere", "Barrow", "Keep", "Fane", "Cairn", "Crypt",
  "Throne", "Vault", "Watch", "Reach", "Hold", "Maw", "Deep",
] as const;
const NOUNS_LOWER = NOUNS.map((n) => n.toLowerCase());

export const poiFanciful: Theme = {
  id: "poiFanciful",
  patterns: [
    { id: "compound", slots: [{ type: "bank", bank: ADJECTIVES }, { type: "bank", bank: NOUNS_LOWER }] },
    {
      id: "two-word",
      slots: [{ type: "bank", bank: ADJECTIVES }, { type: "literal", text: " " }, { type: "bank", bank: NOUNS }],
    },
    {
      id: "the-two-word",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: ADJECTIVES },
        { type: "literal", text: " " },
        { type: "bank", bank: NOUNS },
      ],
    },
  ],
};
