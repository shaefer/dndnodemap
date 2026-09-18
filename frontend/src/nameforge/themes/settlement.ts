import type { Bank, Theme } from "../types";

// Classic medieval root+suffix compounding ("Ash" + "ford" = "Ashford").
// Both banks are categorized (M4.14): a category is picked uniformly first,
// then a word within it, so a small category (e.g. "fauna", 2 words) still
// gets an equal shot against a larger one (e.g. "flora", 7 words).
const ROOTS: Bank = {
  categories: [
    { name: "materials", words: ["Iron", "Stone", "Silver", "Amber"] },
    { name: "colors", words: ["Black", "White", "Grey", "Green"] },
    { name: "flora", words: ["Ash", "Oak", "Elm", "Bramble", "Hazel", "Thorn", "Briar"] },
    { name: "fauna", words: ["Raven", "Wolf"] },
    { name: "landscape", words: ["Fen", "Marsh", "Hollow", "Crest"] },
    { name: "structures", words: ["Mill", "Wynd"] },
    { name: "descriptors", words: ["Dusk", "Old", "High", "Long", "Cold", "Storm", "Salt"] },
  ],
};

const SUFFIXES: Bank = {
  categories: [
    { name: "water features", words: ["ford", "mere", "brook", "reach"] },
    { name: "fortification", words: ["wall", "burg", "hold", "watch", "march"] },
    { name: "landform", words: ["hollow", "moor", "crest", "dale"] },
    { name: "settlement type", words: ["haven", "gate", "wick", "ton", "shire", "stead", "worth"] },
  ],
};

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
