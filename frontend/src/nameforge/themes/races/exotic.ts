import { COLORS } from "../../categories";
import type { Theme } from "../../types";
import { cats, raceTheme } from "./_shared";

// Planar and uncommon peoples. Two of these deviate from the standard
// four-cadence template with an extra pattern their culture specifically
// calls for — see goliath (deed-names) and tiefling (virtue-names).

// Aasimar: celestial, flowing, luminous — dawn, grace, the choir above.
export const aasimar: Theme = raceTheme({
  id: "aasimar",
  chain: {
    start: ["Aur", "Cel", "Sera", "Lumi", "Thal", "Eli", "Sol", "Vaal", "Ori", "Ithar"],
    middle: ["ia", "an", "es", "or", "el", "ari"],
    end: ["iel", "ion", "ariel", "ath", "eth", "aeon", "ara", "um", "ius", "anis"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "radiance",
      words: [
        "Morning", "Luminous", "Radiant", "Sun", "Halo", "Starlit", "Aurora", "Gleaming", "Lucent", "Daybreak",
        "Celestial", "Brilliant", "Shining", "Glorious", "Resplendent", "Effulgent", "Incandescent", "Dazzling",
      ],
    },
    {
      name: "the divine",
      words: [
        "Holy", "Benevolent", "Blessed", "Sacred", "Hallowed", "Exalted", "Devout", "Chorus", "Psalm", "Covenant",
        "Righteous", "Virtuous", "Pure", "Reverent", "Pious", "Faithful", "Beatific", "Seraphic",
      ],
    },
    COLORS,
  ),
  suffixes: cats(
    {
      // No "Sacristy" (M4.16.3) — obscure ecclesiastical term for the room
      // where vestments are kept.
      name: "celestial places",
      words: [
        "Spire", "Sanctum", "Haven", "Ascent", "Choir", "Gate", "Vigil", "Beacon", "Reliquary", "Altar",
        "Cathedral", "Chantry", "Shrine", "Basilica", "Chapel", "Vestibule", "Nave",
      ],
    },
    {
      name: "celestial works",
      words: [
        "Rest", "Reach", "Light", "Crown", "Hymn", "Watch", "Grace", "Dawn",
        "Blessing", "Vigilance", "Devotion", "Serenity", "Splendor", "Communion", "Absolution", "Benediction",
      ],
    },
  ),
});

// Dragonborn: sharp sibilants and hard stops — scale, flame, hoard, wing.
export const draconic: Theme = raceTheme({
  id: "draconic",
  chain: {
    start: ["Arj", "Bala", "Kriv", "Medr", "Pandj", "Rhog", "Shamm", "Torinn", "Verth", "Zeh", "Nagh", "Surr"],
    middle: ["ar", "ax", "iss", "en", "ur", "akh"],
    end: ["ash", "axar", "thar", "ossan", "drax", "iss", "mordan", "kar", "zorn", "vash", "rekh", "thyr"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "draconic body",
      words: [
        "Scute", "Claw", "Pinion", "Talon", "Tooth", "Maw", "Horn", "Spine", "Tail", "Hide",
        "Jaw", "Snout", "Crest", "Ridgeback", "Underbelly", "Foreclaw", "Membrane", "Barb",
      ],
    },
    {
      name: "breath",
      words: [
        "Fire", "Ember", "Cinder", "Frost", "Storm", "Acid", "Thunder", "Venom", "Blaze", "Char",
        "Inferno", "Lightning", "Corrosion", "Poison", "Scald", "Smolder", "Combustion", "Caustic",
      ],
    },
    {
      name: "hoard",
      words: [
        "Bounty", "Gold", "Treasure", "Trove", "Coin", "Relic", "Tribute", "Plunder", "Glory", "Legacy",
        "Riches", "Wealth", "Fortune", "Jewel", "Regalia", "Opulence", "Splendor", "Grandeur",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "draconic roosts",
      words: [
        "Roost", "Aerie", "Spire", "Perch", "Crag", "Throne", "Eyrie", "Pinnacle", "Summit", "Nest",
        "Lair", "Den", "Cave", "Cliffside", "Bastion", "Redoubt", "Sanctum", "Domain",
      ],
    },
    {
      name: "draconic works",
      words: [
        "Hoard", "Pyre", "Scale", "Fang", "Vault", "Reach", "Wing", "Flame",
        "Roar", "Ash", "Coil", "Gullet", "Brood", "Wyrmling", "Scorch", "Rend",
      ],
    },
  ),
});

// Goliath: stone, altitude, endurance. Goliaths earn descriptive deed-names
// rather than inheriting family ones, so their signature pattern is a
// hyphenated feat — "Stone-Breaker", "Bear-Killer" — which is what the
// `compoundSeparator` hook exists for.
export const goliath: Theme = raceTheme({
  id: "goliath",
  compoundSeparator: "-",
  chain: {
    start: ["Aukan", "Kavaki", "Meavo", "Thotham", "Vaunea", "Ilikan", "Keothi", "Paavu", "Uthal", "Gaur"],
    middle: ["va", "no", "tha", "ki", "ma"],
    end: ["an", "aki", "ovo", "ela", "uma", "ika", "othi", "avu"],
    minMiddle: 0,
    maxMiddle: 1,
  },
  roots: cats(
    {
      name: "deed subjects",
      words: [
        "Stone", "Peak", "Storm", "Bison", "Sky", "Thunder", "Frost", "Summit", "Boulder", "Avalanche",
        "Cliff", "Ridge", "Glacier", "Torrent", "Landslide", "Highland", "Granite", "Crag",
      ],
    },
    {
      name: "deed virtues",
      words: [
        "Fearless", "Steadfast", "Tireless", "Unbowed", "Patient", "Sure", "Silent", "Long", "Iron", "True",
        "Resolute", "Unyielding", "Enduring", "Watchful", "Humble", "Solemn", "Faithful", "Constant",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "deeds",
      words: [
        "Killer", "Breaker", "Climber", "Walker", "Seeker", "Bearer", "Watcher", "Render", "Keeper", "Hunter",
        "Slayer", "Warden", "Guardian", "Tamer", "Conqueror", "Vanquisher", "Defender", "Pathfinder",
      ],
    },
    {
      name: "endurances",
      words: [
        "Strider", "Stander", "Holder", "Carver", "Wrestler", "Singer", "Mender", "Finder",
        "Runner", "Survivor", "Wanderer", "Voyager", "Pilgrim", "Nomad", "Sentinel", "Trailblazer",
      ],
    },
  ),
});

// Tiefling: infernal edges plus the virtue-names many tieflings take for
// themselves — hence the extra "virtue" pattern alongside the standard four.
export const tiefling: Theme = raceTheme({
  id: "tiefling",
  chain: {
    start: ["Akme", "Bara", "Damak", "Kair", "Mele", "Rieta", "Skam", "Zeph", "Mor", "Vex", "Iado", "Nemm"],
    middle: ["na", "el", "ka", "os", "ith"],
    end: ["nos", "ikos", "akos", "oth", "ax", "ira", "eth", "ur", "iel", "azel"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "infernal",
      words: [
        "Brimstone", "Ash", "Soot", "Cinder", "Smoke", "Sulfur", "Iron", "Obsidian", "Scorch", "Blaze",
        "Flame", "Char", "Molten", "Searing", "Smoldering", "Hellfire", "Sear", "Pyroclasm",
      ],
    },
    {
      name: "shadow",
      words: [
        "Dusk", "Shade", "Shroud", "Gloom", "Umbra", "Night", "Hush", "Eclipse", "Cloak", "Whisper",
        "Dark", "Murk", "Twilight", "Nightshade", "Obscure", "Somber", "Ebon", "Grim",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "infernal places",
      words: [
        "Spire", "Gate", "Pyre", "Throne", "Veil", "Sanctum", "Hollow", "Brand", "Reach", "Descent",
        "Abyss", "Pit", "Chasm", "Crucible", "Furnace", "Cauldron", "Maw", "Den",
      ],
    },
    {
      name: "infernal works",
      words: [
        "Ember", "Pact", "Bargain", "Oath", "Crown", "Chain", "Sigil", "Ward",
        "Covenant", "Contract", "Binding", "Curse", "Malediction", "Compact", "Ritual", "Damnation",
      ],
    },
  ),
  extraPatterns: [
    // "The Hope", "The Torment" — the virtue-names tieflings choose, used as
    // place names by tiefling enclaves.
    {
      id: "virtue",
      slots: [
        { type: "literal", text: "The " },
        {
          type: "bank",
          name: "virtues",
          bank: [
            "Hope", "Sorrow", "Torment", "Glory", "Dread", "Mercy", "Ruin", "Ardor",
            "Fury", "Despair", "Resolve", "Vengeance", "Solace", "Penance", "Longing", "Reverence",
            "Wrath", "Grace", "Malice", "Redemption",
          ],
        },
      ],
    },
  ],
});

// Drow: sibilant dark-elvish, sharp and venomous — spider, web, shadow, silk.
export const drow: Theme = raceTheme({
  id: "drow",
  chain: {
    start: ["Zar", "Mal", "Vier", "Quar", "Szin", "Drie", "Nath", "Ilva", "Jhael", "Xull", "Velk", "Ssap"],
    middle: ["ath", "ice", "ra", "el", "zz", "yn"],
    end: ["ice", "ryn", "afein", "ath", "zyr", "nyl", "thra", "ene", "ryl", "xis", "aebh", "orl"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "spider",
      words: [
        "Spider", "Strand", "Silk", "Fang", "Venom", "Chitin", "Spinneret", "Brood", "Skitter", "Thread",
        "Arachnid", "Mandible", "Carapace", "Legspan", "Ensnare", "Skulker", "Larva", "Chrysalis",
      ],
    },
    {
      name: "underdark",
      words: [
        "Shadow", "Obsidian", "Night", "Dusk", "Whisper", "Gloom", "Sunless", "Spore", "Fungus", "Echo",
        "Cavern", "Stalactite", "Lightless", "Blackrock", "Umbral", "Cryptic", "Abyssal", "Murk",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "drow places",
      words: [
        "Spire", "Web", "Hold", "Warren", "Deeps", "Nest", "Enclave", "Vault", "Shroud", "Throne",
        "Lair", "Grotto", "Bastion", "Sanctuary", "Chamber", "Colony", "Citadel", "Refuge",
      ],
    },
    {
      name: "drow works",
      words: [
        "Weave", "Snare", "Coil", "Veil", "Lament", "Rite", "Blade", "Court",
        "Ritual", "Ambush", "Poison", "Malice", "Betrayal", "Guile", "Deception", "Scheme",
      ],
    },
  ),
});
