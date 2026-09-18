import type { Theme } from "../types";

// Classic medieval root+suffix compounding ("Ash" + "ford" = "Ashford").
// ~22 roots x ~20 suffixes is several hundred combinations from a two-slot
// pattern alone — real variance from a small, easy-to-extend word list.
const ROOTS = [
  "Ash", "Mill", "Thorn", "Dusk", "Briar", "Crest", "Iron", "Fen", "Cold", "Salt",
  "Green", "Stone", "Raven", "Wolf", "Old", "High", "Black", "White", "Silver", "Storm",
  "Oak", "Elm", "Bramble", "Hollow", "Marsh", "Wynd", "Grey", "Long", "Amber", "Hazel",
] as const;

const SUFFIXES = [
  "ford", "haven", "wall", "gate", "hollow", "moor", "mere", "wick", "burg", "ton",
  "shire", "stead", "reach", "crest", "watch", "hold", "march", "dale", "brook", "worth",
] as const;

export const settlementMedieval: Theme = {
  id: "settlementMedieval",
  patterns: [
    {
      id: "root-suffix",
      slots: [
        { type: "bank", bank: ROOTS, name: "roots" },
        { type: "bank", bank: SUFFIXES, name: "suffixes" },
      ],
    },
  ],
};
