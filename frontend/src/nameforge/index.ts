import { poiFanciful } from "./themes/poi";
import { ALL_RACE_THEMES } from "./themes/races";
import { regionName } from "./themes/region";
import { settlementMedieval } from "./themes/settlement";
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
  EPITHETS,
  FANTASY_CREATURES,
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
export {
  waterFeature,
  wildernessDesert,
  wildernessForest,
  wildernessJungle,
  wildernessPlains,
  wildernessSwamp,
  wildernessTundra,
} from "./themes/wilderness";
// Race/species place-naming themes (M4.16).
export {
  aasimar,
  ALL_RACE_THEMES,
  beholder,
  draconic,
  drow,
  dwarvish,
  elvish,
  giant,
  gnomish,
  goblin,
  goliath,
  halfling,
  illithid,
  lizardfolk,
  minotaur,
  orcish,
  raceTheme,
  tiefling,
  type RaceThemeSpec,
} from "./themes/races";

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
  ...ALL_RACE_THEMES,
];
