import { COLORS, FLORA, MATERIALS } from "../categories";
import type { Bank, Theme } from "../types";
import { rootSuffixTheme } from "./_shared";

// One root+suffix theme per Biome value (M4.15/M4.16.1: categories reuse
// shared generic categories — colors/flora/materials — where they fit,
// alongside biome-specific categories that don't generalize, all targeting
// 16-20 entries per category). rootSuffixTheme derives the lowercase
// compound form from the capitalized suffix bank automatically.

const FOREST_ROOTS: Bank = {
  categories: [
    FLORA,
    COLORS,
    {
      name: "forest descriptors",
      words: [
        "Thorn", "Shadow", "Feral", "Dappled", "Sylvan", "Primeval", "Quiet", "Deep",
        "Tangled", "Verdurous", "Ancient", "Hushed", "Timeless", "Untamed", "Secluded", "Gloomy",
      ],
    },
  ],
};
const FOREST_SUFFIXES: Bank = {
  categories: [
    {
      // M4.16.3: removed Coppice/Spinney/Boscage/Weald/Holt/Chase/Frith —
      // obscure forestry/regional-dialect terms almost nobody would
      // recognize as meaning "a wood."
      name: "woodland",
      words: ["Wood", "Glen", "Grove", "Thicket", "Glade", "Copse", "Dell", "Timberland", "Woodland", "Bower", "Underwood"],
    },
    {
      // M4.16.3: removed Lea/Croft/Glebe/Sward — obscure poetic/dialectal
      // words for "meadow"/"field."
      name: "open land",
      words: ["Vale", "Wilds", "Hollow", "Heath", "Meadow", "Clearing", "Barrens", "Range", "Common", "Down", "Fallow", "Pasture"],
    },
  ],
};

const SWAMP_ROOTS: Bank = {
  categories: [
    // Deliberately avoids Bog/Mire/Fen/Slough — those are swamp *place*
    // words, and this theme's suffix bank already owns them; a word on both
    // sides would let the compound pattern render "Bogbog".
    {
      name: "terrain",
      words: [
        "Peat", "Sludge", "Muskeg", "Murk", "Silt", "Quagmire", "Morass", "Backwater",
        "Ooze", "Muck", "Squelch", "Miasma", "Loam", "Bracken", "Tussock", "Hummock",
      ],
    },
    {
      name: "swamp flora",
      words: [
        "Reed", "Rush", "Cattail", "Cypress", "Duckweed", "Moss", "Lily", "Willow",
        "Sedge", "Fern", "Papyrus", "Mangrove", "Sphagnum", "Bulrush", "Algae", "Waterweed",
      ],
    },
    COLORS,
    {
      name: "swamp descriptors",
      words: [
        "Rot", "Still", "Dank", "Fetid", "Murky", "Sodden", "Clammy", "Rank",
        "Brackish", "Miry", "Turbid", "Stagnant", "Reeking", "Slimy", "Waterlogged", "Humid",
      ],
    },
  ],
};
const SWAMP_SUFFIXES: Bank = {
  categories: [
    {
      // M4.16.3: removed Slough/Sump/Swale/Carr/Fosse/Holm — obscure
      // technical-ecology/dialect/military terms.
      name: "wetland",
      words: ["Marsh", "Fen", "Mire", "Bog", "Bayou", "Bottoms", "Wash", "Bottomland", "Weir", "Sink"],
    },
    {
      name: "water and land",
      words: [
        "Flats", "Hollow", "Mere", "Reach", "Shallows", "Wallow", "Bottom", "Basin",
        "Lowland", "Wetland", "Waterside", "Margin", "Verge", "Brink", "Shoal", "Bank",
      ],
    },
  ],
};

const DESERT_ROOTS: Bank = {
  categories: [
    {
      // M4.16.3: removed Barchan/Hardpan/Erg/Alluvium/Loess/Talus — pure
      // geology-textbook jargon most readers won't recognize at all.
      name: "terrain",
      words: ["Scour", "Dust", "Grit", "Basalt", "Silt", "Rubble", "Gravel", "Shale", "Caldera", "Redrock"],
    },
    {
      name: "elemental",
      words: [
        "Sun", "Scorch", "Ember", "Blaze", "Mirage", "Heat", "Solar", "Cinder",
        "Swelter", "Glare", "Shimmer", "Bleach", "Furnace", "Smolder", "Torrid", "Withering",
      ],
    },
    MATERIALS,
  ],
};
const DESERT_SUFFIXES: Bank = {
  categories: [
    {
      name: "expanse",
      words: [
        "Wastes", "Expanse", "Reach", "Barrens", "Emptiness", "Void", "Drift", "Span",
        "Sprawl", "Stretch", "Waste", "Flatland", "Nothing", "Immensity", "Vastness", "Openness",
      ],
    },
    {
      // M4.16.3: removed Wadi/Playa — Arabic/Spanish geology loanwords,
      // obscure outside a desert-game context specifically.
      name: "landform",
      words: ["Dunes", "Flats", "Sands", "Basin", "Mesa", "Canyon", "Plateau", "Butte", "Escarpment", "Badlands", "Oasis", "Ridge", "Outcrop", "Gulch"],
    },
  ],
};

const TUNDRA_ROOTS: Bank = {
  categories: [
    {
      name: "ice and cold",
      words: [
        "Frost", "Rime", "Snow", "Ice", "Glacier", "Sleet", "Hoarfrost", "Permafrost",
        "Blizzard", "Icicle", "Frostbite", "Snowdrift", "Whiteout", "Glaze", "Hail", "Chill",
      ],
    },
    COLORS,
    {
      name: "tundra descriptors",
      words: [
        "Wind", "Stone", "North", "Bleak", "Grim", "Numb", "Bitter", "Stark",
        "Desolate", "Forlorn", "Unforgiving", "Windswept", "Harsh", "Austere", "Gaunt", "Withered",
      ],
    },
  ],
};
const TUNDRA_SUFFIXES: Bank = {
  categories: [
    {
      // M4.16.3: removed Moraine/Cirque/Col — glacial-geology/mountaineering
      // jargon.
      name: "landform",
      words: ["Moor", "Ridge", "Fell", "Hollow", "Tundra", "Barrens", "Steppe", "Plateau", "Highland", "Crag", "Bluff", "Escarpment", "Saddle"],
    },
    {
      name: "expanse",
      words: [
        "Waste", "Reach", "Expanse", "Wilderness", "Flatland", "Span", "Drift", "Void",
        "Desolation", "Emptiness", "Stretch", "Barren", "Openness", "Vastness", "Sweep", "Range",
      ],
    },
  ],
};

const JUNGLE_ROOTS: Bank = {
  categories: [
    // "Canopy" lives in this theme's suffix bank, so it stays out of the roots.
    {
      name: "jungle flora",
      words: [
        "Vine", "Frond", "Fern", "Liana", "Orchid", "Palm", "Bamboo", "Moss",
        "Fig", "Banyan", "Mangrove", "Rattan", "Creeper", "Bromeliad", "Fungus", "Blossom",
      ],
    },
    {
      name: "jungle descriptors",
      words: [
        "Rampant", "Deep", "Bright", "Lush", "Humid", "Dense", "Sweltering", "Teeming",
        "Verdant", "Overgrown", "Thriving", "Vibrant", "Steamy", "Fecund", "Untouched", "Primal",
      ],
    },
    COLORS,
  ],
};
const JUNGLE_SUFFIXES: Bank = {
  categories: [
    {
      // No "Thickset" (M4.16.3) — normally describes a person's build, not
      // a place; odd fit as a suffix.
      name: "dense growth",
      words: [
        "Thicket", "Tangle", "Canopy", "Grove", "Undergrowth", "Bramble", "Overgrowth", "Snarl",
        "Jungle", "Wilderness", "Brush", "Copse", "Bower", "Understory", "Bracken",
      ],
    },
    {
      name: "open and other",
      words: [
        "Wilds", "Reach", "Hollow", "Basin", "Delta", "Falls", "Springs", "Verge",
        "Clearing", "Crossing", "Valley", "Lowland", "Watershed", "Confluence", "Grotto", "Cascade",
      ],
    },
  ],
};

const PLAINS_ROOTS: Bank = {
  categories: [
    {
      name: "plains descriptors",
      words: [
        "Wide", "Long", "Open", "High", "Far", "Windswept", "Rolling", "Endless",
        "Boundless", "Untrodden", "Level", "Vast", "Gentle", "Grassy", "Sunlit", "Unbroken",
      ],
    },
    {
      name: "colors and light",
      words: [
        "Golden", "Sunlit", "Amber", "Fair", "Bright", "Radiant", "Gleaming", "Honeyed",
        "Tawny", "Straw", "Wheaten", "Sunny", "Luminous", "Warm", "Glowing", "Dappled",
      ],
    },
  ],
};
const PLAINS_SUFFIXES: Bank = {
  categories: [
    {
      // No "Furlong"/"Croft" (M4.16.3) — an archaic unit of measurement and
      // an obscure dialect word don't fit as a place suffix as cleanly as
      // "Veldt"/"Acreage," which were kept.
      name: "open land",
      words: [
        "Plain", "Fields", "Veldt", "Prairie", "Grassland", "Steppe", "Savanna", "Range",
        "Meadowland", "Pasture", "Downs", "Flatland", "Common", "Acreage",
      ],
    },
    {
      name: "expanse",
      words: [
        "Reach", "Expanse", "Run", "Way", "Sweep", "Span", "Vale", "Flatland",
        "Stretch", "Sprawl", "Horizon", "Distance", "Breadth", "Territory", "Domain", "Country",
      ],
    },
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
// needs its own connector, distinct from the plain compound and descriptive
// two-word forms.
const WATER_POSSESSIVE_ROOTS: Bank = {
  categories: [
    {
      name: "occupations",
      words: [
        "Miller", "Fisher", "Cooper", "Tanner", "Weaver", "Potter", "Mason", "Shepherd", "Falconer", "Piper",
        "Smith", "Carter", "Brewer", "Baker", "Thatcher", "Sawyer", "Fowler", "Ferryman", "Cobbler", "Chandler",
      ],
    },
    // Deliberately capped smaller (M4.16.1) — a broad "not-an-occupation"
    // catch-all category doesn't have as large a natural vocabulary without
    // padding with words that don't fit the "old miller/fisher/widow" tone.
    { name: "other", words: ["Otter", "Widow", "Hunter", "Wanderer", "Traveler", "Herder", "Elder"] },
  ],
};
const WATER_PLAIN_ROOTS: Bank = {
  categories: [
    MATERIALS,
    FLORA,
    {
      name: "calm descriptors",
      words: [
        "Hush", "Still", "Moon", "Quiet", "Calm", "Glimmer", "Placid", "Silent",
        "Serene", "Tranquil", "Gentle", "Mirror", "Peaceful", "Dreamy", "Drowsy", "Languid",
      ],
    },
  ],
};
const WATER_SUFFIXES_CATEGORIES = [
  {
    // M4.16.3: removed Lochan (obscure Gaelic loanword), Slough (unclear how
    // to even pronounce), and Puddle (not obscure, just tonally too small).
    name: "water bodies",
    words: ["Pond", "Mere", "Pool", "Spring", "Lagoon", "Basin", "Cove", "Shallows", "Tarn", "Backwater", "Millpond", "Fen", "Eddy"],
  },
  {
    // No "Cataract" (M4.16.3) — homograph risk (reads as the eye condition
    // before "waterfall").
    name: "water crossing",
    words: [
      "Ford", "Falls", "Crossing", "Run", "Weir", "Landing", "Passage", "Narrows",
      "Rapids", "Channel", "Causeway", "Bridge", "Wharf", "Jetty", "Quay",
    ],
  },
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
    // "The Silver Pool" — descriptive two-word.
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
