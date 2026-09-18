import type { Bank, Theme } from "../types";
import { rootSuffixTheme } from "./_shared";

// One root+suffix theme per Biome value, each with its own thematic word
// set. Both banks are categorized (M4.14) — see themes/region.ts for the
// full rationale on category-weighted picking. rootSuffixTheme handles
// deriving the lowercase compound form from the capitalized suffix bank.

const FOREST_ROOTS: Bank = {
  categories: [
    { name: "flora", words: ["Oak", "Elm", "Birch", "Willow", "Bramble", "Ash", "Fern", "Moss"] },
    { name: "colors", words: ["Green", "Silver", "Amber", "Grey"] },
    { name: "descriptors", words: ["Thorn", "Shadow", "Wild"] },
  ],
};
const FOREST_SUFFIXES: Bank = {
  categories: [
    { name: "woodland", words: ["Wood", "Glen", "Grove", "Thicket", "Glade"] },
    { name: "open land", words: ["Vale", "Wilds", "Hollow", "Heath"] },
  ],
};

const SWAMP_ROOTS: Bank = {
  categories: [
    { name: "terrain", words: ["Bog", "Mire", "Fen", "Murk"] },
    { name: "flora", words: ["Reed", "Rush"] },
    { name: "descriptors", words: ["Rot", "Still", "Grey", "Black"] },
  ],
};
const SWAMP_SUFFIXES: Bank = {
  categories: [
    { name: "wetland", words: ["Marsh", "Fen", "Mire", "Bog"] },
    { name: "water and land", words: ["Flats", "Hollow", "Mere", "Reach"] },
  ],
};

const DESERT_ROOTS: Bank = {
  categories: [
    { name: "terrain", words: ["Sand", "Dune", "Dust"] },
    { name: "elemental", words: ["Sun", "Scorch", "Ember"] },
    { name: "materials", words: ["Amber", "Bone", "Glass", "Copper"] },
  ],
};
const DESERT_SUFFIXES: Bank = {
  categories: [
    { name: "expanse", words: ["Wastes", "Expanse", "Reach"] },
    { name: "landform", words: ["Dunes", "Flats", "Sands", "Basin"] },
  ],
};

const TUNDRA_ROOTS: Bank = {
  categories: [
    { name: "ice and cold", words: ["Frost", "Rime", "Snow", "Ice"] },
    { name: "colors", words: ["Pale", "Grey", "White"] },
    { name: "descriptors", words: ["Wind", "Stone", "North"] },
  ],
};
const TUNDRA_SUFFIXES: Bank = {
  categories: [
    { name: "landform", words: ["Moor", "Ridge", "Fell", "Hollow"] },
    { name: "expanse", words: ["Waste", "Reach", "Expanse"] },
  ],
};

const JUNGLE_ROOTS: Bank = {
  categories: [
    { name: "flora", words: ["Vine", "Canopy", "Fern", "Moss"] },
    { name: "colors", words: ["Emerald", "Verdant", "Green", "Bright"] },
    { name: "descriptors", words: ["Wild", "Deep"] },
  ],
};
const JUNGLE_SUFFIXES: Bank = {
  categories: [
    { name: "dense growth", words: ["Thicket", "Tangle", "Canopy", "Grove"] },
    { name: "open and other", words: ["Wilds", "Reach", "Hollow"] },
  ],
};

const PLAINS_ROOTS: Bank = {
  categories: [
    { name: "descriptors", words: ["Wide", "Long", "Open", "High", "Far", "Windswept"] },
    { name: "colors and light", words: ["Golden", "Sunlit", "Amber", "Fair"] },
  ],
};
const PLAINS_SUFFIXES: Bank = {
  categories: [
    { name: "open land", words: ["Plain", "Fields", "Veldt"] },
    { name: "expanse", words: ["Reach", "Expanse", "Run", "Way"] },
  ],
};

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
const WATER_POSSESSIVE_ROOTS: Bank = {
  categories: [
    { name: "occupations", words: ["Miller", "Fisher", "Cooper", "Tanner", "Weaver"] },
    { name: "other", words: ["Otter", "Widow"] },
  ],
};
const WATER_PLAIN_ROOTS: Bank = {
  categories: [
    { name: "materials", words: ["Glass", "Silver", "Stone", "Cinder"] },
    { name: "flora", words: ["Thistle", "Willow", "Reed"] },
    { name: "descriptors", words: ["Hush", "Still", "Moon"] },
  ],
};
const WATER_SUFFIXES: Bank = {
  categories: [
    { name: "water bodies", words: ["Pond", "Mere", "Pool", "Spring"] },
    { name: "water crossing", words: ["Ford", "Falls", "Crossing", "Run"] },
  ],
};
// Lowercased once here (a flat categorized-bank helper isn't warranted for
// just this one pattern) — mirrors _shared.ts's lowerBank approach.
const WATER_SUFFIXES_LOWER: Bank = {
  categories: WATER_SUFFIXES.categories.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })),
};

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
