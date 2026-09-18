import type { Theme } from "../types";

// Grander, multi-word patterns for the map's own name — meant to read as a
// whole region/kingdom, not a single settlement.
const ROOTS = [
  "Ashen", "Silver", "Golden", "Shattered", "Forgotten", "Emerald", "Hollow", "Storm",
  "Winter", "Amber", "Crimson", "Wild", "Iron", "Verdant", "Grey", "Sunken",
] as const;

const REACH_NOUNS = ["Reaches", "Marches", "Territories", "Expanse", "Lowlands", "Highlands", "Wilds", "Frontier"] as const;
const VALE_NOUNS = ["Vale", "Moor", "Crownlands", "Downs", "Hollow", "Fen", "Weald"] as const;

export const regionName: Theme = {
  id: "regionName",
  patterns: [
    {
      id: "the-root-reach",
      slots: [{ type: "literal", text: "The " }, { type: "bank", bank: ROOTS }, { type: "literal", text: " " }, { type: "bank", bank: REACH_NOUNS }],
    },
    {
      id: "root-vale",
      slots: [{ type: "bank", bank: ROOTS }, { type: "literal", text: " " }, { type: "bank", bank: VALE_NOUNS }],
    },
    {
      id: "kingdoms-of-the",
      slots: [{ type: "literal", text: "Kingdoms of the " }, { type: "bank", bank: ROOTS }, { type: "literal", text: " " }, { type: "bank", bank: VALE_NOUNS }],
    },
  ],
};
