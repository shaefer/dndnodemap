import type { WordCategory } from "../types";

// Generic word categories reused across multiple themes (M4.15). Consolidated
// here instead of hand-duplicated per theme so near-identical lists (every
// theme wanting "some colors," "some materials") stay in sync — and so the
// occasional cross-theme oddity (a desert region drawing the same "verdant"
// flavor a forest would) happens naturally from shared data, not copy-paste
// drift. Each theme still assembles its own Bank from a mix of these and its
// own theme-specific categories (see themes/*.ts) — nothing here is a Theme
// by itself.
//
// M4.16.1: every category here targets 20-25 entries (the project's general
// "don't let a small list repeat" rule) except where noted — see each
// category's own comment for why one falls short.

export const COLORS: WordCategory = {
  name: "colors",
  words: [
    "Ashen", "Golden", "Grey", "Verdant", "Crimson", "Black", "White",
    "Green", "Pale", "Scarlet", "Azure", "Violet", "Ebon", "Russet", "Umber",
    "Amber", "Cerulean", "Vermilion", "Indigo", "Saffron", "Sable", "Argent",
  ],
};

export const GEMS: WordCategory = {
  name: "gems",
  words: [
    "Emerald", "Onyx", "Opal", "Jade", "Sapphire", "Ruby", "Topaz",
    "Garnet", "Pearl", "Obsidian", "Quartz", "Beryl", "Citrine", "Moonstone", "Turquoise",
    "Crystal", "Amethyst", "Diamond", "Malachite", "Peridot", "Lapis", "Agate",
  ],
};

export const MATERIALS: WordCategory = {
  name: "materials",
  words: [
    // No "Chalk" (M4.16.2) — read as too plain/off-tone next to its siblings.
    "Iron", "Stone", "Bronze", "Copper", "Steel", "Granite", "Marble",
    "Bone", "Glass", "Clay", "Brass", "Lead", "Flint", "Slate", "Tin",
    "Silver", "Gold", "Basalt", "Alabaster", "Rust", "Ivory",
  ],
};

export const FLORA: WordCategory = {
  name: "flora",
  words: [
    "Oak", "Elm", "Birch", "Willow", "Bramble", "Ash", "Fern", "Moss",
    "Thorn", "Briar", "Cedar", "Pine", "Maple", "Holly", "Ivy", "Reed",
    // No "Heather" — it stem-collides with wildernessForest's "Heath" suffix
    // ("Heatherheath") once FLORA is used as that theme's root bank.
    // No "Larch"/"Sorrel" (M4.16.2) — flagged as too obscure/off-tone.
    "Hazel", "Yew", "Alder", "Rowan", "Nettle", "Clover",
  ],
};

// Real-world creatures (contrast with FANTASY_CREATURES below, which is
// mythological/D&D-monster flavored).
export const FAUNA: WordCategory = {
  name: "fauna",
  words: [
    // No "Kite"/"Vixen"/"Ermine" (M4.16.2) — flagged as too obscure/off-tone.
    "Raven", "Wolf", "Otter", "Fox", "Hawk", "Stag", "Bear", "Owl",
    "Falcon", "Lynx", "Boar", "Heron", "Crow", "Badger", "Serpent", "Eagle",
    "Elk", "Bison", "Vole", "Weasel", "Marten", "Osprey", "Adder",
    "Grouse", "Ferret", "Kestrel", "Viper",
  ],
};

// Mythological and core-D&D monster flavor — greek myth plus the classic
// bestiary — for the settlement "named after a beast" patterns (M4.16.1) and
// anything later that wants a creature slot with real weight next to flora/
// fauna. Deliberately monsters/beasts, not humanoid races — those already
// have their own themes (themes/races/).
export const FANTASY_CREATURES: WordCategory = {
  name: "fantasy creatures",
  words: [
    "Dragon", "Wyvern", "Griffon", "Hydra", "Basilisk", "Chimera", "Manticore", "Minotaur",
    "Harpy", "Phoenix", "Cockatrice", "Wyrm", "Gorgon", "Sphinx", "Kraken", "Roc",
    "Pegasus", "Cerberus", "Salamander", "Wraith", "Banshee", "Cyclops", "Behemoth", "Leviathan",
    "Hippogriff", "Wendigo",
  ],
};

export const DIRECTIONS: WordCategory = {
  name: "directions",
  words: [
    "Northern", "Southern", "Eastern", "Western", "Far", "Distant", "Near", "Upper",
    "Lower", "Inner", "Outer", "High", "Low", "Deep", "Central", "Remote",
    "Northeastern", "Northwestern", "Southeastern", "Southwestern", "Farthest", "Windward",
  ],
};

export const LANDSCAPE_DESCRIPTORS: WordCategory = {
  name: "landscape descriptors",
  words: [
    // No hyphenated entries — this category feeds compound patterns that
    // glue a root directly onto a suffix with no separator ("Wind-carved"
    // used to render as "Wind-carvedford"). "Windworn" replaces the old
    // hyphenated "Wind-carved" (M4.16.2).
    "Shattered", "Hollow", "Sunken", "Storm", "Wild", "Winter", "Broken", "Craggy",
    "Rolling", "Windswept", "Misty", "Frozen", "Scorched", "Barren", "Weathered",
    "Jagged", "Sheer", "Overgrown", "Sodden", "Sunlit", "Windworn", "Stony",
  ],
};

export const NARRATIVE_DESCRIPTORS: WordCategory = {
  name: "narrative descriptors",
  words: [
    "Forsaken", "Lost", "Ancient", "Silent", "Dark", "Old", "Forgotten", "Cursed",
    "Haunted", "Weeping", "Whispering", "Grim", "Solemn", "Fabled", "Legendary", "Mournful",
    "Sacred", "Forbidden", "Sorrowful", "Unquiet", "Nameless", "Restless",
  ],
};

// Character-flavor adjectives for a person or a named figure — "Bold" in
// "Daniel the Bold" — distinct from NARRATIVE_DESCRIPTORS (which describes a
// *place's* mood, not a person's reputation).
export const EPITHETS: WordCategory = {
  name: "epithets",
  words: [
    "Bold", "Wise", "Cruel", "Swift", "Grim", "Fierce", "Mighty", "Just",
    "Merciless", "Relentless", "Radiant", "Savage", "Cunning", "Valiant", "Patient", "Ruthless",
    "Noble", "Vengeful", "Steadfast", "Weary", "Undying", "Wrathful", "Silent", "Tireless",
  ],
};

// Western-medieval-flavored personal first names — for a settlement's
// possessive-personal-name pattern ("Devon's Ford") and, later, POI's
// legendary-figure naming (M4.18). Widened to 50 (M4.16.1) specifically so
// this bank doesn't repeat noticeably faster than the others it sits next to.
export const PERSONAL_NAMES: WordCategory = {
  name: "personal names",
  words: [
    "Devon", "Edmund", "William", "Robert", "Alice", "Edith", "Godwin", "Aldric",
    "Wulfric", "Beatrice", "Osric", "Leofric", "Mildred", "Cedric", "Harold", "Rowena",
    "Alfred", "Matilda", "Godfrey", "Eleanor", "Baldwin", "Isolde", "Reynard", "Adelaide",
    "Wystan", "Cordelia", "Aelfric", "Guinevere", "Bertram", "Rosalind", "Dunstan", "Winifred",
    "Everard", "Constance", "Hereward", "Emmeline", "Thurstan", "Millicent", "Aldous", "Genevieve",
    "Wilfred", "Cicely", "Randolph", "Marguerite", "Ansel", "Idony", "Fulk", "Avelina",
    "Osbert", "Bertha",
  ],
};
