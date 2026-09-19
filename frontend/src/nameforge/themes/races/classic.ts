import { MATERIALS } from "../../categories";
import type { Theme } from "../../types";
import { cats, raceTheme } from "./_shared";

// The four classic fantasy peoples. Each gets the standard four-cadence
// race template (see _shared.ts) — a native-tongue invented word, a
// common-tongue compound, and two blends of the two.

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
    {
      name: "forge",
      words: [
        "Iron", "Molten", "Ingot", "Hammer", "Ember", "Coal", "Bellows", "Cinder", "Smelt", "Quench",
        "Slag", "Furnace", "Rivet", "Tongs", "Firelight", "Sear", "Blacksteel", "Charcoal",
      ],
    },
    {
      name: "depths",
      words: [
        "Sunless", "Under", "Warren", "Vein", "Lode", "Gloom", "Echo", "Ore", "Hollow", "Root",
        "Cavern", "Abyssal", "Bedrock", "Underdark", "Chasm", "Fissure", "Crevice", "Subterranean",
      ],
    },
    MATERIALS,
  ),
  suffixes: cats(
    {
      name: "strongholds",
      words: [
        "Hold", "Delve", "Forge", "Deep", "Hall", "Vault", "Gate", "Hearth", "Bastion", "Keep",
        "Bulwark", "Fortress", "Sanctum", "Enclave", "Chamber", "Refuge", "Sanctuary", "Rampart",
      ],
    },
    {
      name: "workings",
      words: [
        "Mine", "Shaft", "Seam", "Barrow", "Foundry", "Anvil", "Kiln", "Crucible",
        "Quarry", "Smithy", "Workshop", "Digging", "Excavation", "Drift", "Gallery", "Adit",
      ],
    },
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
    {
      name: "celestial",
      words: [
        "Star", "Moon", "Dawn", "Twilight", "Dusk", "Evening", "Gleam", "Shimmer", "Radiance", "Halo",
        "Starlight", "Nightfall", "Daybreak", "Stardust", "Moonlit", "Skyfire", "Glimmering", "Luminous",
      ],
    },
    {
      name: "woodland",
      words: [
        "Leaf", "Willow", "Canopy", "Fern", "Blossom", "Thicket", "Meadow", "Vine", "Petal", "Grove",
        "Bough", "Root", "Sapling", "Fernwood", "Wildflower", "Evergreen", "Timber", "Hollybough",
      ],
    },
    {
      name: "grace",
      words: [
        "Lyric", "Silver", "Mist", "Grace", "Whisper", "Echo", "Silk", "Dream", "Rill", "Lament",
        "Melody", "Harmony", "Elegance", "Serenity", "Wonder", "Rapture", "Sorrow", "Solace",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "elvish places",
      words: [
        "Glade", "Wood", "Spire", "Haven", "Vale", "Refuge", "Court", "Arbor", "Bower",
        "Sanctuary", "Retreat", "Enclave", "Pavilion", "Terrace", "Gallery", "Cloister",
      ],
    },
    {
      name: "elvish works",
      words: [
        "Song", "Reach", "Watch", "Rest", "Crown", "Weave", "Veil", "Light",
        "Chorus", "Verse", "Ballad", "Requiem", "Aria", "Anthem", "Hymn", "Cadence",
      ],
    },
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
    {
      name: "harvest",
      words: [
        "Honey", "Apple", "Barley", "Clover", "Butter", "Pumpkin", "Cider", "Plum", "Wheat", "Berry",
        "Pastry", "Cinnamon", "Nutmeg", "Marmalade", "Turnip", "Parsnip", "Radish", "Preserves",
      ],
    },
    {
      name: "comfort",
      words: [
        "Hearth", "Cozy", "Quiet", "Snug", "Merry", "Kindly", "Gentle", "Warm", "Peaceful", "Homely",
        "Cheerful", "Tidy", "Wholesome", "Jolly", "Amiable", "Cheery", "Content", "Placid",
      ],
    },
    {
      name: "hills",
      words: [
        "Sunny", "Hazel", "Mossy", "Bramble", "Willow", "Pebble", "Brook", "Bracken", "Thistle", "Fern",
        "Daisy", "Buttercup", "Foxglove", "Primrose", "Cowslip", "Bluebell", "Marigold", "Dandelion",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "halfling homes",
      words: [
        "Bottom", "Hollow", "Burrow", "Shire", "Hill", "Dell", "Croft", "Warren", "Den", "Nook",
        "Cottage", "Cellar", "Pantry", "Coop", "Smial", "Hillside", "Hedgerow", "Lane",
      ],
    },
    {
      name: "halfling commons",
      words: [
        "Meadow", "Orchard", "Garden", "Green", "Crossing", "Mill", "Market", "Rest",
        "Faire", "Common", "Square", "Bakery", "Brewery", "Pantry Row", "Teahouse", "Larder",
      ],
    },
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
    {
      name: "tinkering",
      words: [
        "Gear", "Flywheel", "Spring", "Bolt", "Clock", "Piston", "Lever", "Ratchet", "Gadget", "Widget",
        "Sprocket", "Pulley", "Turbine", "Contraption", "Mechanism", "Apparatus", "Device", "Winch",
      ],
    },
    {
      name: "spark",
      words: [
        "Spark", "Glimmer", "Lantern", "Ember", "Flash", "Gleam", "Fizz", "Whirl", "Buzz", "Crackle",
        "Static", "Charge", "Jolt", "Zap", "Glow", "Beam", "Pulse", "Surge",
      ],
    },
    {
      name: "gnomish metals",
      words: [
        "Copper", "Brass", "Tin", "Solder", "Alloy", "Filament", "Wire", "Pewter",
        "Steelwork", "Bronzework", "Ironmongery", "Nickel", "Chrome", "Tinplate",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "gnomish places",
      words: [
        "Nook", "Warren", "Burrow", "Workshop", "Hollow", "Den", "Hall", "Mound", "Vault", "Loft",
        "Attic", "Cellar", "Alcove", "Chamber", "Hideaway", "Retreat", "Sanctum", "Study",
      ],
    },
    {
      name: "gnomish works",
      words: [
        "Cogs", "Spire", "Works", "Forge", "Bench", "Foundry", "Lab", "Yard",
        "Laboratory", "Workshop Row", "Arcade", "Emporium", "Assembly", "Institute", "Academy", "Guildhouse",
      ],
    },
  ),
});
