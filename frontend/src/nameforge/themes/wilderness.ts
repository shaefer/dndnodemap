import type { Theme } from "../types";
import { rootSuffixTheme } from "./_shared";

// One root+suffix theme per Biome value, each with its own thematic word set.
// Roots and suffixes are both plain nouns/adjectives here — rootSuffixTheme
// handles deriving the lowercase compound form from the capitalized one.

const FOREST_ROOTS = [
  "Green", "Thorn", "Oak", "Elm", "Shadow", "Silver", "Moss", "Fern", "Birch", "Wild",
  "Ash", "Willow", "Bramble", "Amber", "Grey",
] as const;
const FOREST_SUFFIXES = ["Wood", "Vale", "Glen", "Wilds", "Glade", "Hollow", "Thicket", "Grove", "Heath"] as const;

const SWAMP_ROOTS = [
  "Bog", "Mire", "Fen", "Reed", "Murk", "Rot", "Still", "Grey", "Black", "Rush",
] as const;
const SWAMP_SUFFIXES = ["Marsh", "Fen", "Mire", "Flats", "Bog", "Hollow", "Mere", "Reach"] as const;

const DESERT_ROOTS = [
  "Sun", "Dust", "Sand", "Scorch", "Dune", "Amber", "Bone", "Glass", "Ember", "Copper",
] as const;
const DESERT_SUFFIXES = ["Dunes", "Wastes", "Flats", "Expanse", "Reach", "Sands", "Basin"] as const;

const TUNDRA_ROOTS = [
  "Frost", "Rime", "Snow", "Wind", "Pale", "Grey", "Ice", "Stone", "White", "North",
] as const;
const TUNDRA_SUFFIXES = ["Moor", "Waste", "Reach", "Expanse", "Hollow", "Ridge", "Fell"] as const;

const JUNGLE_ROOTS = [
  "Vine", "Canopy", "Emerald", "Verdant", "Fern", "Wild", "Bright", "Deep", "Green", "Moss",
] as const;
const JUNGLE_SUFFIXES = ["Thicket", "Tangle", "Wilds", "Grove", "Reach", "Canopy", "Hollow"] as const;

const PLAINS_ROOTS = [
  "Wide", "Long", "Open", "Golden", "Sunlit", "High", "Far", "Amber", "Windswept", "Fair",
] as const;
const PLAINS_SUFFIXES = ["Plain", "Reach", "Expanse", "Fields", "Run", "Way", "Veldt"] as const;

export const wildernessForest: Theme = rootSuffixTheme("wildernessForest", FOREST_ROOTS, FOREST_SUFFIXES);
export const wildernessSwamp: Theme = rootSuffixTheme("wildernessSwamp", SWAMP_ROOTS, SWAMP_SUFFIXES);
export const wildernessDesert: Theme = rootSuffixTheme("wildernessDesert", DESERT_ROOTS, DESERT_SUFFIXES);
export const wildernessTundra: Theme = rootSuffixTheme("wildernessTundra", TUNDRA_ROOTS, TUNDRA_SUFFIXES);
export const wildernessJungle: Theme = rootSuffixTheme("wildernessJungle", JUNGLE_ROOTS, JUNGLE_SUFFIXES);
export const wildernessPlains: Theme = rootSuffixTheme("wildernessPlains", PLAINS_ROOTS, PLAINS_SUFFIXES);

// For the wilderness water fork (pond/lake/river_crossing/hot_spring/
// waterfall/delta) — inspired by the old core/names.ts WATER_FEATURE_NAMES
// pool (Miller's Ford, Glasswater Pond style), rebuilt as a composable theme.
// Bespoke (not rootSuffixTheme) since the possessive form ("Miller's Ford")
// needs its own connector, distinct from the plain compound form.
const WATER_POSSESSIVE_ROOTS = ["Miller", "Otter", "Widow", "Fisher", "Cooper", "Tanner", "Weaver"] as const;
const WATER_PLAIN_ROOTS = ["Glass", "Thistle", "Hush", "Cinder", "Still", "Silver", "Willow", "Moon", "Stone", "Reed"] as const;
const WATER_SUFFIXES = ["Ford", "Pond", "Mere", "Falls", "Spring", "Crossing", "Pool", "Run"] as const;
const WATER_SUFFIXES_LOWER = WATER_SUFFIXES.map((s) => s.toLowerCase());

export const waterFeature: Theme = {
  id: "waterFeature",
  patterns: [
    {
      id: "possessive",
      slots: [
        { type: "bank", bank: WATER_POSSESSIVE_ROOTS, name: "possessive roots" },
        { type: "literal", text: "'s " },
        { type: "bank", bank: WATER_SUFFIXES, name: "suffixes" },
      ],
    },
    {
      id: "compound",
      slots: [
        { type: "bank", bank: WATER_PLAIN_ROOTS, name: "roots" },
        { type: "bank", bank: WATER_SUFFIXES_LOWER, name: "suffixes" },
      ],
    },
  ],
};
