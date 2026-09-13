import type { NodeType } from "../types/map";
import type { RngFn } from "./rng";
import { randPick } from "./rng";

// Static, hand-curated name pools by node type. Not wired into generateMap() —
// the generator uses placeholder labels ("Settlement-1") per spec Section 7,
// Step 1. This exists as a reusable resource for a future "randomize name"
// feature during editing (Section 11, View C).
const NAMES_BY_TYPE: Record<NodeType, readonly string[]> = {
  settlement: [
    "Ashford", "Millhaven", "Thornwall", "Duskhollow", "Briargate",
    "Crestfall", "Irongate", "Fenwatch", "Coldmere", "Saltwick",
  ],
  wilderness: [
    "Greenvale", "The Thornwood", "Bogmere Flats", "Hollow Reach", "Ashwood Trail",
    "Fen Run", "Silver Moor", "Copperwood", "Reed Marshes", "The Veldtway",
    "Longstride", "Drifting Loch", "Briar Heath", "Greywood Fen", "East Run",
    "Dunmore Ford", "Pale Crossing",
  ],
  mountain: [
    "The Shelf", "Scar Ridge", "High Notch", "Greypass", "Stoneback",
    "Rimfall", "Peakwatch", "Crownspire", "Ironwall Ridge", "The Far Spur",
    "Highfell East", "Tumble Pass",
  ],
  ruin: [
    "Old Barrow", "Wraith Hollow", "Sunken Spire", "Gloomgate", "The Black Mere",
    "Ashgrave", "Warden's Last", "Crumbled Keep", "Oathstone", "The Deep Fane",
  ],
  water: [
    "Miller's Ford", "Glasswater Pond", "Thistlemere", "The Hush Falls",
    "Cinder Spring", "Otter's Crossing", "Widow's Ford", "Stillwater Pond",
  ],
};

export function namesForType(type: NodeType): readonly string[] {
  return NAMES_BY_TYPE[type];
}

export function pickName(type: NodeType, rng: RngFn): string {
  return randPick(rng, [...NAMES_BY_TYPE[type]]);
}
