import type { Theme } from "../types";

// A demonstration theme built on the syllableChain slot type: start/middle/
// end syllable pools chosen to flow smoothly together, for invented-language
// -style names (elvish, in this case). Not wired into any node/map naming in
// the app yet — there's no "culture/language" concept in the current
// taxonomy that calls for it. Included as a working example of the general
// mechanism, and a reusable primitive for whenever that concept exists.
export const elvishSyllable: Theme = {
  id: "elvishSyllable",
  patterns: [
    {
      id: "chain",
      slots: [
        {
          type: "syllableChain",
          chain: {
            start: ["Ael", "Sil", "Gal", "Lor", "Thal", "Cael", "Eryn", "Fael", "Ithil", "Mira", "Elen", "Val"],
            middle: ["an", "or", "wen", "eth", "ion", "ara", "el", "in", "ael", "yr"],
            end: ["driel", "wyn", "dor", "iel", "ath", "orn", "wen", "and", "ien", "or", "eth"],
            minMiddle: 0,
            maxMiddle: 2,
          },
        },
      ],
    },
  ],
};
