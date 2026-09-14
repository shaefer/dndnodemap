import type { GenerationParams } from "../types/map";

// A "region" is a curated combination of biome mix + water fraction — a
// UI/store convenience for populating GenerationParams in one action, not a
// generator concept (spec Section 7c). The generator has zero awareness this
// registry exists; it only ever reads params.biomeMix directly, same as
// every other param.

export type RegionPresetId =
  | "temperate_mixed"
  | "magical_forest"
  | "frost"
  | "arid_desert"
  | "swampland"
  | "tropical_jungle";

export interface RegionPreset {
  label: string;
  biomeMix: GenerationParams["biomeMix"];
  wildernessWaterFraction: number;
}

// Each biomeMix sums to exactly 1.0. One dominant biome (~50-60%), the
// thematically-contradictory biome at or near zero, water level varying
// sensibly (desert driest, swamp wettest) — starting values, easy to retune
// since a preset is just data.
export const REGION_PRESETS: Record<RegionPresetId, RegionPreset> = {
  temperate_mixed: {
    label: "Temperate Mixed",
    biomeMix: { forest: 0.3, swamp: 0.15, plains: 0.25, desert: 0.1, tundra: 0.1, jungle: 0.1 },
    wildernessWaterFraction: 0.15,
  },
  magical_forest: {
    label: "Magical Forest",
    biomeMix: { forest: 0.55, swamp: 0.1, plains: 0.15, desert: 0.05, tundra: 0.0, jungle: 0.15 },
    wildernessWaterFraction: 0.25,
  },
  frost: {
    label: "Frost",
    biomeMix: { forest: 0.05, swamp: 0.05, plains: 0.2, desert: 0.1, tundra: 0.6, jungle: 0.0 },
    wildernessWaterFraction: 0.2,
  },
  arid_desert: {
    label: "Arid Desert",
    biomeMix: { forest: 0.05, swamp: 0.05, plains: 0.2, desert: 0.55, tundra: 0.05, jungle: 0.1 },
    wildernessWaterFraction: 0.05,
  },
  swampland: {
    label: "Swampland",
    biomeMix: { forest: 0.2, swamp: 0.5, plains: 0.1, desert: 0.05, tundra: 0.05, jungle: 0.1 },
    wildernessWaterFraction: 0.3,
  },
  tropical_jungle: {
    label: "Tropical Jungle",
    biomeMix: { forest: 0.15, swamp: 0.15, plains: 0.1, desert: 0.05, tundra: 0.0, jungle: 0.55 },
    wildernessWaterFraction: 0.2,
  },
};

export const REGION_PRESET_IDS: RegionPresetId[] = [
  "temperate_mixed",
  "magical_forest",
  "frost",
  "arid_desert",
  "swampland",
  "tropical_jungle",
];
