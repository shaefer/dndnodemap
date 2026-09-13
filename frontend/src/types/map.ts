import type { MapExtensions } from "./extensions";

// All CompassDir values — the full 8-direction set
export type CompassDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// The five primary node categories — permanent and generator-aware
// water = a visitable body of water (small lake, pond, river crossing, waterfall)
//         Scale rule: if a party travels *to* it and makes decisions there → node.
//         If it defines an entire region's character → TerrainZone (extension layer).
export type NodeType = "settlement" | "wilderness" | "mountain" | "ruin" | "water";

// Optional specificity within a NodeType — user-assigned, never generator-assigned
export type SettlementSubtype =
  | "city" | "town" | "outpost" | "port" | "monastery" | "waystation";

export type WildernessSubtype =
  | "forest" | "swamp" | "plains" | "desert" | "coast" | "grove" | "canyon";

export type MountainSubtype =
  | "peak" | "pass" | "cliff" | "ridge" | "cave";

export type RuinSubtype =
  | "dungeon" | "lair" | "monument" | "tomb" | "tower" | "shrine";

// water subtypes: small-scale visitable water features
// river_crossing = the node where you deal with a river — bridge, ford, ferry, etc.
// The map shows the challenge; how the party solves it is not the map's problem.
export type WaterSubtype =
  | "pond" | "lake" | "river_crossing" | "hot_spring" | "waterfall" | "delta";

export type NodeSubtype =
  | SettlementSubtype
  | WildernessSubtype
  | MountainSubtype
  | RuinSubtype
  | WaterSubtype;

// How a connection presents physically — affects rendering and default check behavior
// river_ford:  edge leading into or out of a river_crossing node — check per conditions
// sea_route:   edge between two coastal/port nodes requiring a vessel
// seasonal:    conditionally passable — see edge.notes for conditions
export type ConnectionType =
  | "road"          // maintained path — no check modifier
  | "trail"         // unmaintained path — no check modifier
  | "pass"          // mountain crossing — check-required by default
  | "river_ford"    // river crossing approach — check per conditions
  | "sea_route"     // water travel required — check-required by default
  | "seasonal";     // conditionally passable — see edge.notes

export interface MapNode {
  id: string;           // uuid v4
  label: string;        // e.g. "Ashford"
  type: NodeType;
  subtype?: NodeSubtype; // optional — user-assigned, never generator-assigned
  gx: number;           // logical grid col — float OK (jitter applied)
  gy: number;           // logical grid row — float OK
  notes?: string;       // DM notes, not rendered on map
  factionId?: string;   // ref to Faction.id — extension layer, nullable
}

export interface MapEdge {
  id: string;           // uuid v4
  fromId: string;       // MapNode.id
  toId: string;         // MapNode.id
  direction: CompassDir; // from fromId's perspective
  connectionType: ConnectionType; // default "trail" when generator creates
  checkRequired: boolean;
  checkType?: string;   // e.g. "Athletics DC 14"
  travelDays?: number;  // optional travel cost — extension layer, nullable
  notes?: string;
}

export interface WorldMap {
  id: string;
  name: string;
  nodes: MapNode[];
  edges: MapEdge[];
  extensions: MapExtensions; // always present, all fields optional
  params: GenerationParams;  // always present — hand-edited maps carry their origin params
  algorithmVersion: string;  // semver string, e.g. "1.0.0" — set by generator
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

export interface GenerationParams {
  // Seed
  seed: number;              // required — 32-bit unsigned integer

  // Map shape
  targetNodeCount: number;   // 20–80, default 49
  gridCols: number;          // 6–14, default 10
  gridRows: number;          // 5–12, default 8

  // Node type frequency (four values must sum to 1.0)
  nodeTypeBias: {
    settlement: number;      // default 0.18
    wilderness: number;      // default 0.45
    mountain: number;        // default 0.22
    ruin: number;            // default 0.15
  };

  // Difficulty / traversal
  checkRequiredFraction: number;  // 0.0–1.0, default 0.25
  edgeDensity: number;            // 0.0–1.0, default 0.5
                                  // 0 = sparse (avg 2–3 exits/node), 1 = dense (avg 5–6 exits)

  // Containment
  mountainEdgeFraction: number;   // 0.0–1.0, default 0.7
}

// What gets saved in the library
export interface SavedEntry {
  id: string;
  name: string;
  seed: number;
  algorithmVersion: string;
  params: GenerationParams;
  createdAt: string;
  thumbnail?: string;           // base64 PNG, small — generated on save
}
