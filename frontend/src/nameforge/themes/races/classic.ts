import { MATERIALS } from "../../categories";
import type { Theme } from "../../types";
import { cats, raceTheme } from "./_shared";

// The four classic fantasy peoples. Each gets the standard three-cadence
// race template (see _shared.ts) — a native-tongue invented word, a
// common-tongue compound, and a blend of the two.

// Dwarvish: hard consonants, doubled sounds, kh/z/th/g — stone, forge, depth.
export const dwarvish: Theme = raceTheme({
  id: "dwarvish",
  chain: {
    start: ["Khaz", "Dur", "Bar", "Thrain", "Grim", "Bal", "Kaz", "Mor", "Tor", "Nal", "Brok", "Dwal"],
    middle: ["az", "ur", "um", "ok", "ar", "in", "dum", "gar", "rok"],
    end: ["dum", "rim", "grim", "mund", "nar", "heim", "dor", "ruk", "mar", "din", "bek", "thal"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    { name: "forge", words: ["Iron", "Molten", "Ingot", "Hammer", "Ember", "Coal", "Bellows", "Cinder", "Smelt", "Quench"] },
    { name: "depths", words: ["Sunless", "Under", "Warren", "Vein", "Lode", "Gloom", "Echo", "Ore", "Hollow", "Root"] },
    MATERIALS,
  ),
  suffixes: cats(
    { name: "strongholds", words: ["Hold", "Delve", "Forge", "Deep", "Hall", "Vault", "Gate", "Hearth", "Bastion", "Keep"] },
    { name: "workings", words: ["Mine", "Shaft", "Seam", "Barrow", "Foundry", "Anvil", "Kiln", "Crucible"] },
  ),
});

// Elvish: flowing vowels, soft liquids — starlight, song, woodland grace.
// (Rebuilt from M4.12's `elvishSyllable` demonstration theme, which had only
// the one syllable-chain pattern.)
export const elvish: Theme = raceTheme({
  id: "elvish",
  chain: {
    start: ["Ael", "Sil", "Gal", "Lor", "Thal", "Cael", "Eryn", "Fael", "Ithil", "Mira", "Elen", "Val"],
    middle: ["an", "or", "wen", "eth", "ion", "ara", "el", "in", "ael", "yr"],
    end: ["driel", "wyn", "dor", "iel", "ath", "orn", "wen", "and", "ien", "or", "eth", "las"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    { name: "celestial", words: ["Star", "Moon", "Dawn", "Twilight", "Dusk", "Evening", "Gleam", "Shimmer", "Radiance", "Halo"] },
    { name: "woodland", words: ["Leaf", "Willow", "Canopy", "Fern", "Blossom", "Thicket", "Meadow", "Vine", "Petal", "Grove"] },
    { name: "grace", words: ["Lyric", "Silver", "Mist", "Grace", "Whisper", "Echo", "Silk", "Dream", "Rill", "Lament"] },
  ),
  suffixes: cats(
    { name: "elvish places", words: ["Glade", "Wood", "Spire", "Haven", "Vale", "Bough", "Refuge", "Court", "Arbor", "Bower"] },
    { name: "elvish works", words: ["Song", "Reach", "Watch", "Rest", "Crown", "Weave", "Veil", "Light"] },
  ),
});

// Halfling: warm, homely, soft consonants — hearth, harvest, comfortable hills.
export const halfling: Theme = raceTheme({
  id: "halfling",
  chain: {
    start: ["Tuck", "Bram", "Mer", "Pip", "Hob", "Dill", "Wil", "Ban", "Pod", "Rum"],
    middle: ["ber", "ly", "en", "ow", "in", "der"],
    end: ["borough", "bottom", "buck", "foot", "wise", "toes", "kins", "ly", "worth", "shanks"],
    minMiddle: 0,
    maxMiddle: 1,
  },
  roots: cats(
    { name: "harvest", words: ["Honey", "Apple", "Barley", "Clover", "Butter", "Pumpkin", "Cider", "Plum", "Wheat", "Berry"] },
    { name: "comfort", words: ["Hearth", "Cozy", "Quiet", "Snug", "Merry", "Kindly", "Gentle", "Warm", "Peaceful", "Homely"] },
    { name: "hills", words: ["Sunny", "Hazel", "Mossy", "Bramble", "Willow", "Pebble", "Brook", "Bracken", "Thistle", "Fern"] },
  ),
  suffixes: cats(
    { name: "halfling homes", words: ["Bottom", "Hollow", "Burrow", "Shire", "Hill", "Dell", "Croft", "Warren", "Den", "Nook"] },
    { name: "halfling commons", words: ["Meadow", "Orchard", "Garden", "Green", "Crossing", "Mill", "Market", "Rest"] },
  ),
});

// Gnomish: bouncy, clicky, diminutive — tinkering, sparks, clockwork.
export const gnomish: Theme = raceTheme({
  id: "gnomish",
  chain: {
    start: ["Fizz", "Wick", "Nim", "Bop", "Zan", "Tink", "Glim", "Bix", "Dazz", "Fen", "Ziggle", "Whir"],
    middle: ["le", "er", "a", "ick", "en", "ozz"],
    end: ["wick", "widdle", "sprocket", "gadget", "bolt", "whistle", "top", "gleam", "zap", "nook", "fizzle", "spring"],
    minMiddle: 0,
    maxMiddle: 1,
  },
  roots: cats(
    { name: "tinkering", words: ["Gear", "Flywheel", "Spring", "Bolt", "Clock", "Piston", "Lever", "Ratchet", "Gadget", "Widget"] },
    { name: "spark", words: ["Spark", "Glimmer", "Lantern", "Ember", "Flash", "Gleam", "Fizz", "Whirl", "Buzz", "Crackle"] },
    { name: "gnomish metals", words: ["Copper", "Brass", "Tin", "Solder", "Alloy", "Filament", "Wire", "Pewter"] },
  ),
  suffixes: cats(
    { name: "gnomish places", words: ["Nook", "Warren", "Burrow", "Workshop", "Hollow", "Den", "Hall", "Mound", "Vault", "Loft"] },
    { name: "gnomish works", words: ["Cogs", "Spire", "Works", "Forge", "Bench", "Foundry", "Lab", "Yard"] },
  ),
});
