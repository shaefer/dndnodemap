import type {
  CompassDir,
  ConnectionType,
  GenerationParams,
  MapEdge,
  MapNode,
  NodeType,
  WorldMap,
} from "../types/map";
import { enforceNonCheckRequiredExit } from "./generator";

// The hand-verified 49-node example map, transcribed from the embedded NODES/EDGES
// arrays in docs/overworld-map.html (same source data as docs/node-reference.md).
// Used as the demo map on first launch and as a generator/validator test fixture.
// Not part of the spec's Section 2 core file list — added because both the
// validator's "known-good map" test and M3's demo render need a real WorldMap
// built from this data, and duplicating the transcription in two places would
// just invite drift.

interface RawNode {
  id: number;
  label: string;
  type: NodeType;
  gx: number;
  gy: number;
}

type RawEdge = [number, number, CompassDir] | [number, number, CompassDir, true, string];

export const PROTOTYPE_GRID_COLS = 10;
export const PROTOTYPE_GRID_ROWS = 8;

const RAW_NODES: RawNode[] = [
  { id: 0, label: "Ashford", type: "settlement", gx: 3, gy: 3 },
  { id: 1, label: "Millhaven", type: "settlement", gx: 5, gy: 2 },
  { id: 2, label: "Thornwall", type: "settlement", gx: 1, gy: 3 },
  { id: 3, label: "Duskhollow", type: "settlement", gx: 3, gy: 5 },
  { id: 4, label: "Briargate", type: "settlement", gx: 6, gy: 4 },
  { id: 5, label: "Crestfall", type: "settlement", gx: 2, gy: 1 },
  { id: 6, label: "Irongate", type: "settlement", gx: 7, gy: 2 },
  { id: 7, label: "Fenwatch", type: "settlement", gx: 1, gy: 6 },
  { id: 8, label: "Coldmere", type: "settlement", gx: 4, gy: 7 },
  { id: 9, label: "Saltwick", type: "settlement", gx: 8, gy: 5 },
  { id: 10, label: "Greenvale", type: "wilderness", gx: 3, gy: 2 },
  { id: 11, label: "The Thornwood", type: "wilderness", gx: 2, gy: 4 },
  { id: 12, label: "Bogmere Flats", type: "wilderness", gx: 1, gy: 5 },
  { id: 13, label: "Hollow Reach", type: "wilderness", gx: 4, gy: 4 },
  { id: 14, label: "Ashwood Trail", type: "wilderness", gx: 4, gy: 2 },
  { id: 15, label: "Fen Run", type: "wilderness", gx: 0, gy: 5 },
  { id: 16, label: "Silver Moor", type: "wilderness", gx: 5, gy: 5 },
  { id: 17, label: "Copperwood", type: "wilderness", gx: 6, gy: 3 },
  { id: 18, label: "Reed Marshes", type: "wilderness", gx: 2, gy: 6 },
  { id: 19, label: "The Veldtway", type: "wilderness", gx: 5, gy: 3 },
  { id: 20, label: "Longstride", type: "wilderness", gx: 6, gy: 6 },
  { id: 21, label: "Drifting Loch", type: "wilderness", gx: 3, gy: 6 },
  { id: 22, label: "Briar Heath", type: "wilderness", gx: 2, gy: 2 },
  { id: 23, label: "Greywood Fen", type: "wilderness", gx: 0, gy: 4 },
  { id: 24, label: "East Run", type: "wilderness", gx: 7, gy: 4 },
  { id: 25, label: "Dunmore Ford", type: "wilderness", gx: 4, gy: 5 },
  { id: 26, label: "Pale Crossing", type: "wilderness", gx: 5, gy: 6 },
  { id: 27, label: "The Shelf", type: "mountain", gx: 0, gy: 2 },
  { id: 28, label: "Scar Ridge", type: "mountain", gx: 0, gy: 3 },
  { id: 29, label: "High Notch", type: "mountain", gx: 1, gy: 2 },
  { id: 30, label: "Greypass", type: "mountain", gx: 1, gy: 0 },
  { id: 31, label: "Stoneback", type: "mountain", gx: 0, gy: 6 },
  { id: 32, label: "Rimfall", type: "mountain", gx: 0, gy: 7 },
  { id: 33, label: "Peakwatch", type: "mountain", gx: 4, gy: 0 },
  { id: 34, label: "Crownspire", type: "mountain", gx: 6, gy: 0 },
  { id: 35, label: "Ironwall Ridge", type: "mountain", gx: 8, gy: 1 },
  { id: 36, label: "The Far Spur", type: "mountain", gx: 8, gy: 7 },
  { id: 37, label: "Highfell East", type: "mountain", gx: 9, gy: 4 },
  { id: 38, label: "Tumble Pass", type: "mountain", gx: 8, gy: 3 },
  { id: 39, label: "Old Barrow", type: "ruin", gx: 3, gy: 4 },
  { id: 40, label: "Wraith Hollow", type: "ruin", gx: 2, gy: 3 },
  { id: 41, label: "Sunken Spire", type: "ruin", gx: 4, gy: 3 },
  { id: 42, label: "Gloomgate", type: "ruin", gx: 5, gy: 4 },
  { id: 43, label: "The Black Mere", type: "ruin", gx: 1, gy: 7 },
  { id: 44, label: "Ashgrave", type: "ruin", gx: 3, gy: 1 },
  { id: 45, label: "Warden's Last", type: "ruin", gx: 7, gy: 6 },
  { id: 46, label: "Crumbled Keep", type: "ruin", gx: 7, gy: 3 },
  { id: 47, label: "Oathstone", type: "ruin", gx: 6, gy: 1 },
  { id: 48, label: "The Deep Fane", type: "ruin", gx: 6, gy: 7 },
];

// checkRequired flags and checkType strings reconciled against
// docs/node-reference.md's "Check-Required Routes" table, which is treated as
// authoritative (see docs/overworld-map-app-spec-v2.md Section 18). The two
// source documents disagreed on exactly one pair of edges: the HTML flagged
// Ashwood Trail→Peakwatch [14,33,"N"] as check-required and did NOT flag
// Peakwatch→Crownspire [33,34,"E"], while node-reference.md's table says the
// opposite. Fixed here to match node-reference.md.
const RAW_EDGES: RawEdge[] = [
  [0, 10, "N"], [0, 22, "NW"], [0, 14, "NE"], [0, 39, "S"], [0, 13, "SE"], [0, 11, "W"],
  [10, 22, "W"], [10, 14, "E"], [10, 5, "NW"], [10, 44, "N"],
  [5, 22, "SE"], [5, 29, "W"], [5, 30, "NW", true, "Athletics DC 14"], [5, 44, "E"],
  [22, 29, "NW"], [22, 40, "SW"], [22, 11, "S"], [22, 27, "W", true, "Athletics DC 12"],
  [27, 28, "S"], [27, 29, "SE"], [28, 23, "S"], [28, 40, "E"],
  [29, 30, "N", true, "Athletics DC 16"], [23, 15, "S"], [23, 12, "SE"],
  [11, 40, "N"], [11, 12, "S"], [11, 2, "W"],
  [2, 40, "NE"], [2, 12, "SE"], [2, 29, "N", true, "Athletics DC 12"],
  [40, 39, "E"],
  [12, 15, "W"], [12, 18, "S"], [12, 7, "SE"],
  [15, 31, "S", true, "Athletics DC 12"], [15, 32, "SW", true, "Athletics DC 16"],
  [7, 18, "NE"], [7, 43, "S", true, "Survival DC 13"], [7, 31, "W", true, "Athletics DC 14"],
  [18, 21, "E"], [18, 8, "SE"], [18, 43, "SW"],
  [31, 32, "S"], [43, 32, "SE"],
  [39, 13, "E"], [39, 41, "N"], [39, 3, "S"],
  [41, 14, "N"], [41, 19, "E"], [41, 0, "SW"], [41, 42, "SE"],
  [14, 1, "E"], [14, 33, "N"], [14, 47, "NE"],
  [1, 19, "SW"], [1, 6, "E"], [1, 47, "NW"],
  [47, 34, "N", true, "Athletics DC 14"], [47, 6, "E"], [47, 33, "W"],
  [6, 35, "N", true, "Athletics DC 16"], [6, 46, "S"], [6, 38, "SW"],
  [34, 35, "E"], [33, 34, "E", true, "Athletics DC 14"],
  [35, 38, "S"], [38, 46, "N"], [38, 24, "SE"],
  [46, 17, "W"], [46, 24, "SE"], [46, 37, "E", true, "Athletics DC 14"],
  [24, 9, "SE"], [24, 16, "SW"], [24, 37, "E", true, "Athletics DC 16"],
  [37, 9, "S", true, "Athletics DC 16"],
  [17, 19, "W"], [17, 4, "SE"], [17, 42, "S"],
  [19, 42, "S"], [19, 4, "SE"],
  [42, 16, "SE"], [42, 13, "W"], [42, 4, "E"],
  [4, 9, "E"], [4, 16, "S"], [4, 20, "SE"],
  // Saltwick->Longstride was originally also labeled SW, duplicating
  // Saltwick->Warden's Last's SW — a real conflict in the source data (both
  // node-reference.md and the HTML give Saltwick two SW exits). Longstride is
  // the less exact SW of the two geometrically, so it's relabeled to the
  // nearest direction actually free at Saltwick.
  [9, 20, "SE"], [9, 45, "SW"], [9, 36, "S", true, "Athletics DC 16"],
  [20, 26, "W"], [20, 45, "NW"], [20, 48, "SW"],
  [45, 26, "SW"], [45, 48, "S"],
  [48, 36, "SE", true, "Survival DC 14"], [48, 26, "N"],
  [36, 37, "N", true, "Athletics DC 18"],
  [13, 3, "S"], [13, 25, "SE"],
  [3, 25, "E"], [3, 21, "W"], [3, 8, "SE"], [3, 16, "NE"],
  [25, 16, "N"], [25, 8, "E"], [25, 26, "SE"],
  [8, 26, "E"], [8, 21, "W"],
  [21, 26, "SE"],
  [44, 30, "NW", true, "Athletics DC 18"], [44, 33, "NE", true, "Athletics DC 18"],
  [30, 33, "E", true, "Athletics DC 18"],
];

function connectionTypeFor(a: NodeType, b: NodeType): ConnectionType {
  if (a === "water" || b === "water") return "river_ford";
  const isMountainPair =
    (a === "mountain" && (b === "mountain" || b === "wilderness")) ||
    (b === "mountain" && (a === "mountain" || a === "wilderness"));
  if (isMountainPair) return "pass";
  const isSettlementPair =
    (a === "settlement" && (b === "settlement" || b === "wilderness")) ||
    (b === "settlement" && (a === "settlement" || a === "wilderness"));
  if (isSettlementPair) return "road";
  return "trail";
}

export function buildPrototypeMap(): WorldMap {
  const nodeIds = RAW_NODES.map((n) => `prototype-node-${n.id}`);

  const nodes: MapNode[] = RAW_NODES.map((n) => ({
    id: nodeIds[n.id],
    label: n.label,
    type: n.type,
    gx: n.gx,
    gy: n.gy,
  }));

  const rawEdges: MapEdge[] = RAW_EDGES.map(([a, b, direction, check, checkType], i) => ({
    id: `prototype-edge-${i}`,
    fromId: nodeIds[a],
    toId: nodeIds[b],
    direction,
    connectionType: connectionTypeFor(RAW_NODES[a].type, RAW_NODES[b].type),
    checkRequired: check === true,
    ...(checkType ? { checkType } : {}),
  }));

  // Two nodes in the original hand-authored data (Far Spur, Highfell East)
  // have every connection marked check-required, violating invariant 6.
  // Repaired with the same "unmark the lowest-difficulty edge" policy the
  // generator itself uses (see generator.ts, enforceNonCheckRequiredExit).
  const edges = enforceNonCheckRequiredExit(nodes, rawEdges);

  const params: GenerationParams = {
    seed: 0,
    targetNodeCount: nodes.length,
    gridCols: PROTOTYPE_GRID_COLS,
    gridRows: PROTOTYPE_GRID_ROWS,
    nodeTypeBias: { settlement: 0.18, wilderness: 0.45, mountain: 0.22, ruin: 0.15 },
    checkRequiredFraction: 0.25,
    edgeDensity: 0.5,
    mountainEdgeFraction: 0.7,
  };

  const now = new Date().toISOString();
  return {
    id: "prototype-region",
    name: "Prototype Region",
    nodes,
    edges,
    extensions: {},
    params,
    algorithmVersion: "0.0.0-prototype",
    createdAt: now,
    updatedAt: now,
  };
}
