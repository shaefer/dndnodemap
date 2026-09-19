import { COLORS, FLORA, MATERIALS } from "../categories";
import type { Bank, Theme } from "../types";
import { rootSuffixTheme } from "./_shared";

// One root+suffix theme per Biome value (M4.15: categories expanded to
// 8-16 words each, reusing shared generic categories — colors/flora/
// materials/landscape — where they fit, alongside biome-specific categories
// that don't generalize). rootSuffixTheme derives the lowercase compound
// form from the capitalized suffix bank automatically.

const FOREST_ROOTS: Bank = {
  categories: [
    FLORA,
    COLORS,
    { name: "forest descriptors", words: ["Thorn", "Shadow", "Feral", "Dappled", "Sylvan", "Primeval", "Quiet", "Deep"] },
  ],
};
const FOREST_SUFFIXES: Bank = {
  categories: [
    { name: "woodland", words: ["Wood", "Glen", "Grove", "Thicket", "Glade", "Copse", "Dell", "Timberland", "Woodland"] },
    { name: "open land", words: ["Vale", "Wilds", "Hollow", "Heath", "Meadow", "Clearing", "Barrens", "Range"] },
  ],
};

const SWAMP_ROOTS: Bank = {
  categories: [
    // Deliberately avoids Bog/Mire/Fen/Slough — those are swamp *place*
    // words, and this theme's suffix bank already owns them; a word on both
    // sides would let the compound pattern render "Bogbog".
    { name: "terrain", words: ["Peat", "Sludge", "Muskeg", "Murk", "Silt", "Quagmire", "Morass", "Backwater"] },
    { name: "swamp flora", words: ["Reed", "Rush", "Cattail", "Cypress", "Duckweed", "Moss", "Lily", "Willow"] },
    COLORS,
    { name: "swamp descriptors", words: ["Rot", "Still", "Dank", "Fetid", "Murky", "Sodden", "Clammy", "Rank"] },
  ],
};
const SWAMP_SUFFIXES: Bank = {
  categories: [
    { name: "wetland", words: ["Marsh", "Fen", "Mire", "Bog", "Bayou", "Slough", "Bottoms", "Sump"] },
    { name: "water and land", words: ["Flats", "Hollow", "Mere", "Reach", "Shallows", "Wallow", "Bottom", "Basin"] },
  ],
};

const DESERT_ROOTS: Bank = {
  categories: [
    { name: "terrain", words: ["Scour", "Barchan", "Dust", "Grit", "Hardpan", "Basalt", "Silt", "Erg"] },
    { name: "elemental", words: ["Sun", "Scorch", "Ember", "Blaze", "Mirage", "Heat", "Solar", "Cinder"] },
    MATERIALS,
  ],
};
const DESERT_SUFFIXES: Bank = {
  categories: [
    { name: "expanse", words: ["Wastes", "Expanse", "Reach", "Barrens", "Emptiness", "Void", "Drift", "Span"] },
    { name: "landform", words: ["Dunes", "Flats", "Sands", "Basin", "Mesa", "Canyon", "Plateau", "Wadi"] },
  ],
};

const TUNDRA_ROOTS: Bank = {
  categories: [
    { name: "ice and cold", words: ["Frost", "Rime", "Snow", "Ice", "Glacier", "Sleet", "Hoarfrost", "Permafrost"] },
    COLORS,
    { name: "tundra descriptors", words: ["Wind", "Stone", "North", "Bleak", "Grim", "Numb", "Bitter", "Stark"] },
  ],
};
const TUNDRA_SUFFIXES: Bank = {
  categories: [
    { name: "landform", words: ["Moor", "Ridge", "Fell", "Hollow", "Tundra", "Barrens", "Steppe", "Plateau"] },
    { name: "expanse", words: ["Waste", "Reach", "Expanse", "Wilderness", "Flatland", "Span", "Drift", "Void"] },
  ],
};

const JUNGLE_ROOTS: Bank = {
  categories: [
    // "Canopy" lives in this theme's suffix bank, so it stays out of the roots.
    { name: "jungle flora", words: ["Vine", "Frond", "Fern", "Liana", "Orchid", "Palm", "Bamboo", "Moss"] },
    { name: "jungle descriptors", words: ["Rampant", "Deep", "Bright", "Lush", "Humid", "Dense", "Sweltering", "Teeming"] },
    COLORS,
  ],
};
const JUNGLE_SUFFIXES: Bank = {
  categories: [
    { name: "dense growth", words: ["Thicket", "Tangle", "Canopy", "Grove", "Undergrowth", "Bramble", "Overgrowth", "Snarl"] },
    { name: "open and other", words: ["Wilds", "Reach", "Hollow", "Basin", "Delta", "Falls", "Springs", "Verge"] },
  ],
};

const PLAINS_ROOTS: Bank = {
  categories: [
    { name: "plains descriptors", words: ["Wide", "Long", "Open", "High", "Far", "Windswept", "Rolling", "Endless"] },
    { name: "colors and light", words: ["Golden", "Sunlit", "Amber", "Fair", "Bright", "Radiant", "Gleaming", "Honeyed"] },
  ],
};
const PLAINS_SUFFIXES: Bank = {
  categories: [
    { name: "open land", words: ["Plain", "Fields", "Veldt", "Prairie", "Grassland", "Steppe", "Savanna", "Range"] },
    { name: "expanse", words: ["Reach", "Expanse", "Run", "Way", "Sweep", "Span", "Vale", "Flatland"] },
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
// needs its own connector, distinct from the plain compound and (M4.15)
// descriptive two-word forms.
const WATER_POSSESSIVE_ROOTS: Bank = {
  categories: [
    {
      name: "occupations",
      words: ["Miller", "Fisher", "Cooper", "Tanner", "Weaver", "Potter", "Mason", "Shepherd", "Falconer", "Piper"],
    },
    { name: "other", words: ["Otter", "Widow", "Hunter", "Wanderer", "Traveler"] },
  ],
};
const WATER_PLAIN_ROOTS: Bank = {
  categories: [
    MATERIALS,
    FLORA,
    { name: "calm descriptors", words: ["Hush", "Still", "Moon", "Quiet", "Calm", "Glimmer", "Placid", "Silent"] },
  ],
};
const WATER_SUFFIXES_CATEGORIES = [
  { name: "water bodies", words: ["Pond", "Mere", "Pool", "Spring", "Lagoon", "Basin", "Cove", "Shallows"] },
  { name: "water crossing", words: ["Ford", "Falls", "Crossing", "Run", "Weir", "Landing", "Passage", "Narrows"] },
];
const WATER_SUFFIXES: Bank = { categories: WATER_SUFFIXES_CATEGORIES };
const WATER_SUFFIXES_LOWER: Bank = {
  categories: WATER_SUFFIXES_CATEGORIES.map((c) => ({ name: c.name, words: c.words.map((w) => w.toLowerCase()) })),
};

export const waterFeature: Theme = {
  id: "waterFeature",
  patterns: [
    // "Miller's Ford" — possessive.
    {
      id: "possessive",
      slots: [
        { type: "bank", bank: WATER_POSSESSIVE_ROOTS, name: "possessive roots" },
        { type: "literal", text: "'s " },
        { type: "bank", bank: WATER_SUFFIXES, name: "suffixes" },
      ],
    },
    // "Glassmere" — compound.
    {
      id: "compound",
      slots: [
        { type: "bank", bank: WATER_PLAIN_ROOTS, name: "roots" },
        { type: "bank", bank: WATER_SUFFIXES_LOWER, name: "suffixes" },
      ],
    },
    // "The Silver Pool" — descriptive two-word (M4.15).
    {
      id: "descriptive",
      slots: [
        { type: "literal", text: "The " },
        { type: "bank", bank: WATER_PLAIN_ROOTS, name: "roots" },
        { type: "literal", text: " " },
        { type: "bank", bank: WATER_SUFFIXES, name: "suffixes" },
      ],
    },
  ],
};
