import type { NodeType } from "../types/map";
import type { RngFn } from "./rng";
import { randPick } from "./rng";

// Static, hand-curated name pools by node type. Not wired into generateMap() —
// the generator uses placeholder labels ("Settlement-1") per spec Section 7,
// Step 1. This exists as a reusable resource for a future "randomize name"
// feature during editing (Section 11, View C).
// The old "mountain" and "ruin" NodeType keys are gone (spec Section 3c) —
// their name pools folded into wilderness (mountain-flavored nodes are now
// wilderness nodes with a mountain_range boundary marker) and poi (ruin
// renamed to poi) respectively.
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
    "The Shelf", "Scar Ridge", "High Notch", "Greypass", "Stoneback",
    "Rimfall", "Peakwatch", "Crownspire", "Ironwall Ridge", "The Far Spur",
    "Highfell East", "Tumble Pass",
  ],
  poi: [
    "Old Barrow", "Wraith Hollow", "Sunken Spire", "Gloomgate", "The Black Mere",
    "Ashgrave", "Warden's Last", "Crumbled Keep", "Oathstone", "The Deep Fane",
  ],
};

// Water-feature-flavored names, for once the Wilderness water fork is placed
// by the generator (M4.6). Not keyed by NodeType since water is a Tier 1.5
// fork, not its own type.
export const WATER_FEATURE_NAMES: readonly string[] = [
  "Miller's Ford", "Glasswater Pond", "Thistlemere", "The Hush Falls",
  "Cinder Spring", "Otter's Crossing", "Widow's Ford", "Stillwater Pond",
];

export function namesForType(type: NodeType): readonly string[] {
  return NAMES_BY_TYPE[type];
}

export function pickName(type: NodeType, rng: RngFn): string {
  return randPick(rng, [...NAMES_BY_TYPE[type]]);
}
