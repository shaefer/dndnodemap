import type { WordCategory } from "../types";

// Generic word categories reused across multiple themes (M4.15). Consolidated
// here instead of hand-duplicated per theme so near-identical lists (every
// theme wanting "some colors," "some materials") stay in sync — and so the
// occasional cross-theme oddity (a desert region drawing the same "verdant"
// flavor a forest would) happens naturally from shared data, not copy-paste
// drift. Each theme still assembles its own Bank from a mix of these and its
// own theme-specific categories (see themes/*.ts) — nothing here is a Theme
// by itself.

export const COLORS: WordCategory = {
  name: "colors",
  words: [
    "Ashen", "Silver", "Golden", "Grey", "Verdant", "Crimson", "Black", "White",
    "Green", "Pale", "Scarlet", "Azure", "Violet", "Ebon", "Russet", "Umber",
  ],
};

export const GEMS: WordCategory = {
  name: "gems",
  words: [
    "Emerald", "Amber", "Onyx", "Opal", "Jade", "Sapphire", "Ruby", "Topaz",
    "Garnet", "Pearl", "Obsidian", "Quartz", "Beryl", "Citrine", "Moonstone", "Turquoise",
  ],
};

export const MATERIALS: WordCategory = {
  name: "materials",
  words: [
    "Iron", "Stone", "Ivory", "Bronze", "Copper", "Steel", "Granite", "Marble",
    "Bone", "Glass", "Clay", "Brass", "Lead", "Flint", "Slate", "Tin",
  ],
};

export const FLORA: WordCategory = {
  name: "flora",
  words: [
    "Oak", "Elm", "Birch", "Willow", "Bramble", "Ash", "Fern", "Moss",
    "Thorn", "Briar", "Cedar", "Pine", "Maple", "Holly", "Ivy", "Reed",
  ],
};

export const FAUNA: WordCategory = {
  name: "fauna",
  words: [
    "Raven", "Wolf", "Otter", "Fox", "Hawk", "Stag", "Bear", "Owl",
    "Falcon", "Lynx", "Boar", "Heron", "Crow", "Badger", "Serpent", "Eagle",
  ],
};

export const DIRECTIONS: WordCategory = {
  name: "directions",
  words: [
    "Northern", "Southern", "Eastern", "Western", "Far", "Distant", "Near", "Upper",
    "Lower", "Inner", "Outer", "High", "Low", "Deep", "Central", "Remote",
  ],
};

export const LANDSCAPE_DESCRIPTORS: WordCategory = {
  name: "landscape descriptors",
  words: [
    "Shattered", "Hollow", "Sunken", "Storm", "Wild", "Winter", "Broken", "Craggy",
    "Rolling", "Windswept", "Misty", "Frozen", "Scorched", "Barren", "Weathered",
  ],
};

export const NARRATIVE_DESCRIPTORS: WordCategory = {
  name: "narrative descriptors",
  words: [
    "Forsaken", "Lost", "Ancient", "Silent", "Dark", "Old", "Forgotten", "Cursed",
    "Haunted", "Weeping", "Whispering", "Grim", "Solemn", "Fabled", "Legendary", "Mournful",
  ],
};

// Western-medieval-flavored personal first names — for a settlement's
// possessive-personal-name pattern ("Devon's Ford") and, later, POI's
// legendary-figure naming (M4.18).
export const PERSONAL_NAMES: WordCategory = {
  name: "personal names",
  words: [
    "Devon", "Edmund", "William", "Robert", "Alice", "Edith", "Godwin", "Aldric",
    "Wulfric", "Beatrice", "Osric", "Leofric", "Mildred", "Cedric", "Harold", "Rowena",
  ],
};
