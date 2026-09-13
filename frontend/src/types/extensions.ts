// The generator never reads or writes TerrainZone/Faction directly except when
// explicitly opted into via GenerationParams.generateTerrainZones (spec
// Section 7, Step 2.5) — the validator never requires any of this. The
// renderer draws it when present and ignores it when absent. The UI shows
// extension panels only when the map's `extensions` object contains data.
// Faction data is never generator-written, opt-in or not — see spec Section 3c.
//
// The MapExtensions container lives on WorldMap so extensions round-trip cleanly
// through JSON export without any migration logic.
import type { Biome } from "./map"; // circular type-only import — erased at compile time, fine

// The container — always present on WorldMap, all fields optional arrays
export interface MapExtensions {
  terrainZones?: TerrainZone[];
  factions?: Faction[];
  edgeTerrainTags?: EdgeTerrainTag[];
}

// --- Terrain ---

// TerrainType: ambient regional conditions — large-scale, not a destination.
// Reuses Biome (map.ts) rather than re-listing it — a node's flavor and a
// zone's ambient condition are the same vocabulary at different scope (spec
// Section 3c). "coast" is valid here as a zone-wide ambient condition even
// though it's a per-node boolean (MapNode.coastal) at node scope. lake /
// ocean obey the scale rule: large bodies that shape a region belong here.
// Small visitable water features (ponds, river crossings) are WaterFeature
// nodes instead.
export type TerrainType =
  | Biome
  | "coast"
  | "lake" | "ocean";    // large water bodies — traversal requires sea_route edges

// Elevation/topography texture — zone-scale only (spec Section 3c explains
// why this isn't also a per-node field). hills and canyon fold in here rather
// than being separate node-level features: hills is "rolling"/"elevated",
// canyon is "valley" (or "steep" for a dramatic, cliff-walled gorge).
export type ElevationHint =
  | "flatland"   // no notable elevation change
  | "rolling"    // gentle hills
  | "elevated"   // high ground, plateaus
  | "steep"      // cliffs, dramatic drops — also a dramatic canyon
  | "valley";    // sunken terrain — also the default reading of "canyon"

// A TerrainZone groups nodes that share ambient terrain.
// It is a set-membership record, not a spatial polygon.
// Rendering: draw a soft background wash behind member nodes.
export interface TerrainZone {
  id: string;
  label: string;              // e.g. "The Ashwood", "Bogmere Marshes"
  terrain: TerrainType;
  elevation: ElevationHint;
  nodeIds: string[];          // MapNode.id — the members of this zone
  color?: string;             // optional override hex for the wash; renderer picks a default per terrain
  notes?: string;
}

// When an edge crosses from one TerrainZone to another, this record
// decorates it with the crossing detail. Pure annotation — does not
// change edge connectivity or direction.
export interface EdgeTerrainTag {
  edgeId: string;             // MapEdge.id
  fromTerrain: TerrainType;
  toTerrain: TerrainType;
  crossingNotes?: string;     // e.g. "enters the treeline", "marshland begins"
}

// --- Factions / Territories ---

export type BorderStyle = "solid" | "disputed" | "ancient";

// A Faction owns a set of nodes. The faction boundary is rendered
// as a convex hull around its member nodes.
export interface Faction {
  id: string;
  name: string;               // e.g. "Kingdom of Veldtmark"
  color?: string;             // hex — used for border and territory wash
  borderStyle: BorderStyle;
  nodeIds: string[];          // MapNode.id — nodes in this territory
  notes?: string;
}
