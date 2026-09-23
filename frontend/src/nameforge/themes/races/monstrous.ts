import { FAUNA } from "../../categories";
import type { Theme } from "../../types";
import { cats, raceTheme } from "./_shared";

// The wilder peoples and aberrations. Same four-cadence template as every
// other race (see _shared.ts) — the distinctiveness lives in the phonetics
// and the word content.

// Orcish: guttural stops, gr/kr/z/ug — blood, war, trophies, the strong camp.
export const orcish: Theme = raceTheme({
  id: "orcish",
  chain: {
    start: ["Gru", "Zag", "Mog", "Urz", "Kra", "Thok", "Gor", "Nak", "Rez", "Ug", "Dra", "Skul"],
    middle: ["ga", "uk", "ra", "oz", "ag", "ur"],
    end: ["nak", "tuk", "gash", "mog", "dur", "grim", "zug", "rok", "thar", "uk", "bash", "gul"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "war",
      words: [
        "Blood", "Battle", "Rage", "Gore", "Tusk", "Bone", "Fang", "Scar", "Wound", "Cleaver",
        "Slaughter", "Warpath", "Skirmish", "Onslaught", "Ambush", "Conquest", "Bloodlust", "Reaver",
      ],
    },
    {
      name: "strength",
      words: [
        "Iron", "Brute", "Crush", "Smash", "Break", "Grip", "Hard", "Heavy", "Savage", "Red",
        "Mighty", "Brutal", "Ferocious", "Merciless", "Vicious", "Grueling", "Unrelenting", "Bloodied",
      ],
    },
    FAUNA,
  ),
  suffixes: cats(
    {
      name: "orcish camps",
      words: [
        "Camp", "Pit", "Hold", "Maw", "Den", "Warren", "Grounds", "Kraal", "Stockade", "Spike",
        "Encampment", "Bivouac", "Outpost", "Garrison", "Muster", "Warcamp", "Bastion", "Rampart",
      ],
    },
    {
      name: "orcish trophies",
      words: [
        "Stake", "Skull", "Banner", "Totem", "Pyre", "Ring", "Mound", "Gate",
        "Standard", "Effigy", "Cairn", "Gallows", "Warflag", "Charnel", "Shrine", "Altar",
      ],
    },
  ),
});

// Goblin: short, snappy, sneering — scrap, junk, tunnels, stolen things.
export const goblin: Theme = raceTheme({
  id: "goblin",
  chain: {
    start: ["Snik", "Grib", "Zik", "Nub", "Krik", "Wort", "Gib", "Skab", "Yip", "Nax"],
    middle: ["na", "it", "ug", "er", "ik"],
    end: ["snag", "nit", "gub", "zik", "rat", "gob", "wort", "nob", "skit", "grub"],
    minMiddle: 0,
    maxMiddle: 1,
  },
  roots: cats(
    {
      name: "scrap",
      words: [
        "Scrap", "Rust", "Junk", "Sharp", "Bent", "Patch", "Salvage", "Tatter", "Splinter", "Shiv",
        "Scrounge", "Cobble", "Rickety", "Ramshackle", "Tinker", "Jagged", "Broken", "Makeshift",
      ],
    },
    {
      name: "squalor",
      words: [
        "Stink", "Muck", "Grime", "Reek", "Filth", "Mold", "Soot", "Slime", "Rot", "Ash",
        "Grubby", "Foul", "Fetid", "Squalid", "Dank", "Mildew", "Sludge", "Vermin",
      ],
    },
    {
      name: "cunning",
      words: [
        "Sneak", "Filch", "Snare", "Trick", "Pinch", "Skulk", "Creep", "Lurk", "Squeak", "Scurry",
        "Scheme", "Pilfer", "Swindle", "Wheedle", "Cackle", "Snicker", "Grovel", "Backstab",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "goblin holes",
      words: [
        "Warren", "Hole", "Nest", "Pit", "Heap", "Den", "Burrow", "Midden", "Hovel", "Crawl",
        "Squat", "Nook", "Grotto", "Tunnel", "Cubby", "Shanty", "Dugout", "Alcove",
      ],
    },
    {
      name: "goblin camps",
      words: [
        "Camp", "Shack", "Roost", "Stash", "Trap", "Perch", "Snarl", "Tangle",
        "Hideout", "Ambuscade", "Thicket", "Ratrun", "Sinkhole", "Backalley", "Covert", "Dustbowl",
      ],
    },
  ),
});

// Minotaur: bellowing vowels and heavy consonants — horn, maze, bronze, bull.
export const minotaur: Theme = raceTheme({
  id: "minotaur",
  chain: {
    start: ["Bhar", "Kar", "Tor", "Mak", "Gran", "Dur", "Hro", "Kaz", "Bran", "Tharn"],
    middle: ["an", "ur", "os", "ak", "on"],
    end: ["thos", "run", "dor", "mak", "aros", "korn", "tan", "gul", "axos", "burn"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "the bull",
      words: [
        "Brow", "Hoof", "Bull", "Gore", "Charge", "Bellow", "Snort", "Hide", "Muzzle", "Stampede",
        "Rampage", "Trample", "Brawn", "Girth", "Flank", "Withers", "Haunches", "Bloodrage",
      ],
    },
    {
      name: "the labyrinth",
      words: [
        "Serpentine", "Labyrinth", "Winding", "Crooked", "Endless", "Turning", "Spiral", "Curling", "Twisting", "Blind",
        "Meandering", "Convoluted", "Snaking", "Tangled", "Bewildering", "Circuitous", "Baffling", "Interlacing",
      ],
    },
    {
      name: "minotaur metals",
      words: [
        "Bronze", "Iron", "Brass", "Copper", "Stone", "Granite", "Basalt", "Obsidian",
        "Steel", "Marble", "Slate", "Alloy", "Ore", "Flint", "Quartz", "Adamant",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "labyrinth places",
      words: [
        "Maze", "Warren", "Hall", "Arena", "Pit", "Run", "Gate", "Coil", "Crossing", "Den",
        "Rotunda", "Colosseum", "Gauntlet", "Passage", "Corridor", "Vestibule", "Enclosure", "Ringwall",
      ],
    },
    {
      name: "minotaur works",
      words: [
        "Horn", "Ring", "Throne", "Forge", "Pillar", "Vault", "Gallery", "Descent",
        "Anvil", "Bastion", "Colonnade", "Obelisk", "Rampart", "Parapet", "Battlement", "Buttress",
      ],
    },
  ),
});

// Lizardfolk: hissing sibilants, ss/sk/zh — scale, marsh, basking, spawn.
export const lizardfolk: Theme = raceTheme({
  id: "lizardfolk",
  chain: {
    start: ["Sess", "Hiss", "Vysk", "Ssur", "Khaz", "Zask", "Thass", "Ixi", "Ssal", "Yeth"],
    middle: ["ka", "iss", "sa", "uz", "ash"],
    end: ["issk", "ath", "ka", "uss", "zar", "esh", "ikh", "orr", "sha", "xis"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "scale",
      words: [
        "Scale", "Fang", "Tooth", "Claw", "Tail", "Hide", "Crest", "Frill", "Jaw", "Molt",
        "Talon", "Ridgeback", "Scute", "Underbite", "Webbing", "Barb", "Spine", "Gullet",
      ],
    },
    {
      name: "marsh",
      words: [
        "Marsh", "Mud", "Silt", "Reed", "Swamp", "Brackish", "Sedge", "Murk", "Stagnant", "Fen",
        "Bayou", "Slough", "Peat", "Quagmire", "Backwater", "Mangrove", "Wetland", "Tidewater",
      ],
    },
    {
      name: "the hunt",
      words: [
        "Torpid", "Stalk", "Lunge", "Sink", "Drown", "Coil", "Ambush", "Patient", "Still", "Cold",
        "Predatory", "Submerged", "Camouflaged", "Venomous", "Silent", "Watchful", "Merciless", "Voracious",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "lizardfolk nests",
      words: [
        "Nest", "Mire", "Bask", "Warren", "Shallows", "Hollow", "Mound", "Bog", "Den", "Spawn",
        "Rookery", "Lagoon", "Estuary", "Floodplain", "Backpool", "Thicket", "Sandbar", "Islet",
      ],
    },
    {
      name: "lizardfolk works",
      words: [
        "Hunt", "Reach", "Wallow", "Perch", "Crossing", "Snare", "Roost", "Hatchery",
        "Feeding", "Foraging", "Migration", "Predation", "Territory", "Domain", "Enclave", "Refuge",
      ],
    },
  ),
});

// Giant: Jotunn-flavored, thunderous, Norse-adjacent — sky, storm, summit.
export const giant: Theme = raceTheme({
  id: "giant",
  chain: {
    start: ["Jot", "Thrym", "Skad", "Hrung", "Bergel", "Gymir", "Utgar", "Surt", "Vafr", "Hymir"],
    middle: ["un", "gar", "ir", "mir", "al"],
    end: ["heim", "gard", "nir", "mir", "hall", "fell", "thun", "grim", "vald", "storm"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "sky",
      words: [
        "Thunder", "Storm", "Cloud", "Sky", "Gale", "Tempest", "Lightning", "Wind", "Rain", "Squall",
        "Skyfall", "Windswept", "Cyclone", "Downpour", "Hailstorm", "Zephyr", "Maelstrom", "Gust",
      ],
    },
    {
      // No "Scarp" (M4.16.3) — obscure short form of "escarpment."
      name: "mountain",
      words: [
        "Mountain", "Boulder", "Peak", "Bluff", "Cliff", "Scree", "Rime", "Glacier", "Frost", "Stone",
        "Avalanche", "Talus", "Precipice", "Highland", "Alpine", "Moraine", "Escarpment",
      ],
    },
    {
      // No "Behemothic" (M4.16.3) — not a real word, an awkwardly invented
      // adjective form of "Behemoth."
      name: "titans",
      words: [
        "Titan", "Elder", "Great", "Vast", "Mighty", "Colossal", "Ancient", "Towering", "Immense", "Hoary",
        "Gargantuan", "Primordial", "Monolithic", "Enormous", "Stalwart", "Venerable", "Boundless",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "giant halls",
      words: [
        "Heim", "Gard", "Hall", "Throne", "Hold", "Seat", "Keep", "Steading", "Longhall", "Barrow",
        "Manor", "Palace", "Bastion", "Vault", "Fortress", "Sanctuary", "Citadel", "Domicile",
      ],
    },
    {
      name: "giant heights",
      words: [
        "Crag", "Summit", "Fell", "Reach", "Steppe", "Ridge", "Pass", "Shelf",
        "Plateau", "Promontory", "Overlook", "Vantage", "Aerie", "Eyrie", "Spire", "Cornice",
      ],
    },
  ),
});

// Illithid: deliberately hard to pronounce — brine, thralls, the elder deeps.
export const illithid: Theme = raceTheme({
  id: "illithid",
  chain: {
    start: ["Ilth", "Xax", "Vlaak", "Ghyl", "Qoth", "Zar", "Nth", "Ulth", "Cth", "Mraa"],
    middle: ["ith", "aa", "oq", "yl", "zz", "uun"],
    end: ["ith", "ax", "oth", "uun", "khar", "yss", "aal", "orq", "ulu", "nyx"],
    minMiddle: 1,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "the mind",
      words: [
        "Mind", "Thought", "Dream", "Psi", "Memory", "Will", "Cognition", "Reverie", "Intellect", "Notion",
        "Consciousness", "Synapse", "Neural", "Psionic", "Telepathic", "Sentience", "Cognizance", "Perception",
      ],
    },
    {
      // No "Gestalt" (M4.16.3) — psychology/philosophy jargon, reads as
      // out-of-place modern rather than alien.
      name: "the colony",
      words: [
        "Elder", "Thrall", "Brine", "Spawn", "Tadpole", "Cerebral", "Cephal", "Brood", "Larval", "Ganglion",
        "Progenitor", "Symbiont", "Parasitic", "Colonial", "Umbilical", "Gestation", "Metamorphic",
      ],
    },
    {
      // No "Benthic" (M4.16.3) — marine-biology jargon.
      name: "the deeps",
      words: [
        "Nether", "Void", "Sunless", "Abyssal", "Fathom", "Lightless", "Drowned", "Buried", "Silent", "Cold",
        "Submerged", "Crushing", "Uncharted", "Pressurized", "Bottomless", "Frigid", "Vast",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "illithid colonies",
      words: [
        "Spire", "Pool", "Colony", "Nursery", "Deeps", "Vault", "Nexus", "Sanctum", "Hive", "Trench",
        "Enclave", "Chrysalis", "Incubator", "Larvarium", "Cavity", "Membrane", "Basin", "Grotto",
      ],
    },
    {
      name: "illithid works",
      words: [
        "Conclave", "Cistern", "Lattice", "Chorus", "Reservoir", "Strata", "Warren", "Gyre",
        "Matrix", "Array", "Circuit", "Conduit", "Meridian", "Vortex", "Helix", "Spiral",
      ],
    },
  ),
});

// Beholder: paranoid grandiosity — every beholder titles its own lair.
export const beholder: Theme = raceTheme({
  id: "beholder",
  chain: {
    start: ["Xan", "Ith", "Gzem", "Vor", "Qual", "Zul", "Oth", "Ghar", "Nyl", "Ux"],
    middle: ["a", "ul", "ez", "or", "ith"],
    end: ["athar", "ux", "oth", "zir", "ath", "eyn", "aal", "ixis", "ozz", "urn"],
    minMiddle: 0,
    maxMiddle: 2,
  },
  roots: cats(
    {
      name: "the eye",
      words: [
        "Eye", "Gaze", "Stalk", "Iris", "Pupil", "Sclera", "Lid", "Blink", "Stare", "Ray",
        "Glare", "Squint", "Ocular", "Retina", "Cornea", "Beam", "Glower", "Peer",
      ],
    },
    {
      name: "tyranny",
      words: [
        "Tyrant", "Sovereign", "Supreme", "Absolute", "Undisputed", "Perfect", "Sole", "Exalted", "Imperious", "Dread",
        "Despotic", "Autocratic", "Domineering", "Omniscient", "Almighty", "Unchallenged", "Totalitarian", "Peerless",
      ],
    },
    {
      name: "paranoia",
      words: [
        "Sleepless", "Watchful", "Vigilant", "Suspicious", "Wary", "Unblinking", "Restless", "Jealous", "Guarded", "Wakeful",
        "Distrustful", "Paranoid", "Cautious", "Alert", "Anxious", "Twitchy", "Overcautious", "Uneasy",
      ],
    },
  ),
  suffixes: cats(
    {
      name: "beholder lairs",
      words: [
        "Lair", "Den", "Hollow", "Warren", "Sanctum", "Cavern", "Vault", "Roost", "Pit", "Throne",
        "Aerie", "Bastion", "Redoubt", "Enclave", "Nest", "Grotto", "Fortress", "Refuge",
      ],
    },
    {
      // No "Demesne" (M4.16.3) — obscure feudal-legal term for land under a
      // lord's direct control.
      name: "beholder domains",
      words: [
        "Dominion", "Gallery", "Oculus", "Vantage", "Reach", "Perch", "Chamber",
        "Territory", "Realm", "Province", "Expanse", "Purview", "Jurisdiction", "Hegemony", "Dynasty",
      ],
    },
  ),
});
