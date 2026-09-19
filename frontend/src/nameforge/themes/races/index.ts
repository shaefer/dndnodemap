import type { Theme } from "../../types";
import { dwarvish, elvish, gnomish, halfling } from "./classic";
import { aasimar, draconic, drow, goliath, tiefling } from "./exotic";
import { beholder, giant, goblin, illithid, lizardfolk, minotaur, orcish } from "./monstrous";

export { dwarvish, elvish, gnomish, halfling } from "./classic";
export { aasimar, draconic, drow, goliath, tiefling } from "./exotic";
export { beholder, giant, goblin, illithid, lizardfolk, minotaur, orcish } from "./monstrous";
export { raceTheme, type RaceThemeSpec } from "./_shared";

// Every race/species place-naming theme (M4.16). Human isn't here on
// purpose: human-flavored place naming is what settlementMedieval's
// possessive/descriptive patterns already produce ("Devon's Ford",
// "Northern Bridge"), so a separate "human" theme would just duplicate it.
export const ALL_RACE_THEMES: readonly Theme[] = [
  dwarvish,
  elvish,
  halfling,
  gnomish,
  aasimar,
  draconic,
  goliath,
  tiefling,
  drow,
  orcish,
  goblin,
  minotaur,
  lizardfolk,
  giant,
  illithid,
  beholder,
];
