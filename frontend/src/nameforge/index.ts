export type { GeneratedName, Pattern, Rng, Slot, SyllableChain, Theme } from "./types";
export { generateName, regenerate, rerollSlot } from "./generate";
export { rootSuffixPatterns, rootSuffixTheme } from "./themes/_shared";
export { poiFanciful } from "./themes/poi";
export { regionName } from "./themes/region";
export { settlementMedieval } from "./themes/settlement";
export { elvishSyllable } from "./themes/syllable";
export {
  waterFeature,
  wildernessDesert,
  wildernessForest,
  wildernessJungle,
  wildernessPlains,
  wildernessSwamp,
  wildernessTundra,
} from "./themes/wilderness";
