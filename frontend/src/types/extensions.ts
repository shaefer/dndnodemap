// The generator never reads or writes these types. The validator never requires
// them. The renderer draws them when present and ignores them when absent. The
// UI shows extension panels only when the map's `extensions` object contains data.
//
// The MapExtensions container lives on WorldMap so extensions round-trip cleanly
// through JSON export without any migration logic.

// The container — always present on WorldMap, all fields optional arrays
export interface MapExtensions {
  terrainZones?: TerrainZone[];
  factions?: Faction[];
  edgeTerrainTags?: EdgeTerrainTag[];
}

// --- Terrain ---

// TerrainType: ambient regional conditions — large-scale, not a destination
// lake / ocean obey the scale rule: large bodies that shape a region belong here.
// Small visitable water features (ponds, river crossings) are water nodes instead.
export type TerrainType =
  | "forest" | "swamp" | "desert" | "plains"
  | "hills" | "tundra" | "coast" | "jungle"
  | "lake" | "ocean";    // large water bodies — traversal requires sea_route edges

export type ElevationHint =
  | "flatland"   // no notable elevation change
  | "rolling"    // gentle hills
  | "elevated"   // high ground, plateaus
  | "steep"      // cliffs, dramatic drops
  | "valley";    // sunken terrain

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
