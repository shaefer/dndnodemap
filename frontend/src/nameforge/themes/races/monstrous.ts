import { FAUNA } from "../../categories";
import type { Theme } from "../../types";
import { cats, raceTheme } from "./_shared";

// The wilder peoples and aberrations. Same three-cadence template as every
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
    { name: "war", words: ["Blood", "Battle", "Rage", "Gore", "Tusk", "Bone", "Fang", "Scar", "Wound", "Cleaver"] },
    { name: "strength", words: ["Iron", "Brute", "Crush", "Smash", "Break", "Grip", "Hard", "Heavy", "Savage", "Red"] },
    FAUNA,
  ),
  suffixes: cats(
    { name: "orcish camps", words: ["Camp", "Pit", "Hold", "Maw", "Den", "Warren", "Grounds", "Kraal", "Stockade", "Spike"] },
    { name: "orcish trophies", words: ["Stake", "Skull", "Banner", "Totem", "Pyre", "Ring", "Mound", "Gate"] },
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
    { name: "scrap", words: ["Scrap", "Rust", "Junk", "Sharp", "Bent", "Patch", "Salvage", "Tatter", "Splinter", "Shiv"] },
    { name: "squalor", words: ["Stink", "Muck", "Grime", "Reek", "Filth", "Mold", "Soot", "Slime", "Rot", "Ash"] },
    { name: "cunning", words: ["Sneak", "Filch", "Snare", "Trick", "Pinch", "Skulk", "Creep", "Lurk", "Squeak", "Scurry"] },
  ),
  suffixes: cats(
    { name: "goblin holes", words: ["Warren", "Hole", "Nest", "Pit", "Heap", "Den", "Burrow", "Midden", "Hovel", "Crawl"] },
    { name: "goblin camps", words: ["Camp", "Shack", "Roost", "Stash", "Trap", "Perch", "Snarl", "Tangle"] },
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
    { name: "the bull", words: ["Brow", "Hoof", "Bull", "Gore", "Charge", "Bellow", "Snort", "Hide", "Muzzle", "Stampede"] },
    { name: "the labyrinth", words: ["Serpentine", "Labyrinth", "Winding", "Crooked", "Endless", "Turning", "Spiral", "Curling", "Twisting", "Blind"] },
    { name: "minotaur metals", words: ["Bronze", "Iron", "Brass", "Copper", "Stone", "Granite", "Basalt", "Obsidian"] },
  ),
  suffixes: cats(
    { name: "labyrinth places", words: ["Maze", "Warren", "Hall", "Arena", "Pit", "Run", "Gate", "Coil", "Crossing", "Den"] },
    { name: "minotaur works", words: ["Horn", "Ring", "Throne", "Forge", "Pillar", "Vault", "Gallery", "Descent"] },
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
    { name: "scale", words: ["Scale", "Fang", "Tooth", "Claw", "Tail", "Hide", "Crest", "Frill", "Jaw", "Molt"] },
    { name: "marsh", words: ["Marsh", "Mud", "Silt", "Reed", "Swamp", "Brackish", "Sedge", "Murk", "Stagnant", "Fen"] },
    { name: "the hunt", words: ["Torpid", "Stalk", "Lunge", "Sink", "Drown", "Coil", "Ambush", "Patient", "Still", "Cold"] },
  ),
  suffixes: cats(
    { name: "lizardfolk nests", words: ["Nest", "Mire", "Bask", "Warren", "Shallows", "Hollow", "Mound", "Bog", "Den", "Spawn"] },
    { name: "lizardfolk works", words: ["Hunt", "Reach", "Wallow", "Perch", "Crossing", "Snare", "Roost", "Hatchery"] },
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
    { name: "sky", words: ["Thunder", "Storm", "Cloud", "Sky", "Gale", "Tempest", "Lightning", "Wind", "Rain", "Squall"] },
    { name: "mountain", words: ["Mountain", "Boulder", "Peak", "Bluff", "Cliff", "Scree", "Rime", "Glacier", "Frost", "Stone"] },
    { name: "titans", words: ["Titan", "Elder", "Great", "Vast", "Mighty", "Colossal", "Ancient", "Towering", "Immense", "Hoary"] },
  ),
  suffixes: cats(
    { name: "giant halls", words: ["Heim", "Gard", "Hall", "Throne", "Hold", "Seat", "Keep", "Steading", "Longhall", "Barrow"] },
    { name: "giant heights", words: ["Crag", "Summit", "Fell", "Reach", "Steppe", "Ridge", "Pass", "Shelf"] },
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
    { name: "the mind", words: ["Mind", "Thought", "Dream", "Psi", "Memory", "Will", "Cognition", "Reverie", "Intellect", "Notion"] },
    { name: "the colony", words: ["Elder", "Thrall", "Brine", "Spawn", "Tadpole", "Cerebral", "Cephal", "Brood", "Larval", "Ganglion"] },
    { name: "the deeps", words: ["Nether", "Void", "Sunless", "Abyssal", "Fathom", "Lightless", "Drowned", "Buried", "Silent", "Cold"] },
  ),
  suffixes: cats(
    { name: "illithid colonies", words: ["Spire", "Pool", "Colony", "Nursery", "Deeps", "Vault", "Nexus", "Sanctum", "Hive", "Trench"] },
    { name: "illithid works", words: ["Conclave", "Cistern", "Lattice", "Chorus", "Reservoir", "Strata", "Warren", "Gyre"] },
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
    { name: "the eye", words: ["Eye", "Gaze", "Stalk", "Iris", "Pupil", "Sclera", "Lid", "Blink", "Stare", "Ray"] },
    { name: "tyranny", words: ["Tyrant", "Sovereign", "Supreme", "Absolute", "Undisputed", "Perfect", "Sole", "Exalted", "Imperious", "Dread"] },
    { name: "paranoia", words: ["Sleepless", "Watchful", "Vigilant", "Suspicious", "Wary", "Unblinking", "Restless", "Jealous", "Guarded", "Wakeful"] },
  ),
  suffixes: cats(
    { name: "beholder lairs", words: ["Lair", "Den", "Hollow", "Warren", "Sanctum", "Cavern", "Vault", "Roost", "Pit", "Throne"] },
    { name: "beholder domains", words: ["Dominion", "Demesne", "Gallery", "Oculus", "Vantage", "Reach", "Perch", "Chamber"] },
  ),
});
