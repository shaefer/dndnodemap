import { poiFanciful } from "./themes/poi";
import { regionName } from "./themes/region";
import { settlementMedieval } from "./themes/settlement";
import { elvishSyllable } from "./themes/syllable";
import {
  waterFeature,
  wildernessDesert,
  wildernessForest,
  wildernessJungle,
  wildernessPlains,
  wildernessSwamp,
  wildernessTundra,
} from "./themes/wilderness";
import type { Theme } from "./types";

export type { Bank, GeneratedName, Pattern, Rng, Slot, SyllableChain, Theme, WordCategory } from "./types";
export {
  COLORS,
  DIRECTIONS,
  FAUNA,
  FLORA,
  GEMS,
  LANDSCAPE_DESCRIPTORS,
  MATERIALS,
  NARRATIVE_DESCRIPTORS,
  PERSONAL_NAMES,
} from "./categories";
export { generateFromPattern, generateName, regenerate, rerollSlot } from "./generate";
export { describePattern, describeSlot, listWordLists, type NamedWordList } from "./inspect";
export { rootSuffixPatterns, rootSuffixTheme, type RootSuffixLabels } from "./themes/_shared";
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

// Every registered theme, for tooling that wants to enumerate them (e.g. a
// theme-picker UI) without hand-maintaining a duplicate list.
export const ALL_THEMES: readonly Theme[] = [
  settlementMedieval,
  poiFanciful,
  wildernessForest,
  wildernessSwamp,
  wildernessDesert,
  wildernessTundra,
  wildernessJungle,
  wildernessPlains,
  waterFeature,
  regionName,
  elvishSyllable,
];
