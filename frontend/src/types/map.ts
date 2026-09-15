import type { MapExtensions } from "./extensions";

// All CompassDir values — the full 8-direction set
export type CompassDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// --- Tier 1: NodeType — "what kind of place is this" -------------------------
// See spec Section 3c for the full tiered-classification model (Tier 1 /
// Tier 1.5 forks / Tier 2 subtype / Boundary / Tier 3+). All three values are
// generator-aware — the generator can place any of them.
export type NodeType = "settlement" | "wilderness" | "poi";

// --- Tier 1.5: Wilderness forks into Land | Water ----------------------------
// The fork is inferable from which subtype union `subtype` belongs to — no
// separate "branch" field. A wilderness node's subtype is always either a
// Biome (land branch) or a WaterFeature (water branch).

// Biome: Tier 2 for the land branch. Shared with TerrainZone.terrain
// (extensions.ts) — the same vocabulary describes one node's flavor or a
// whole zone's ambient condition, just at different scope. Elevation/
// hilliness/canyon character lives on TerrainZone.elevation instead
// (zone-scale only) — deliberately not a per-node field.
export type Biome = "forest" | "swamp" | "plains" | "desert" | "tundra" | "jungle";

// WaterFeature: Tier 2 for the water branch — small-scale visitable water
// features. river_crossing = the node where you deal with a river — bridge,
// ford, ferry, etc. The map shows the challenge; how the party solves it is
// not the map's problem. Large water bodies (a lake or ocean that shapes a
// whole region) are TerrainZone terrain, not a node.
export type WaterFeature =
  | "pond" | "lake" | "river_crossing" | "hot_spring" | "waterfall" | "delta";

// --- Tier 1.5: Settlement forks into Civilian | Outpost ----------------------
// Same inference rule — the fork is implied by which union `subtype` is in.

// CivilianScale: Tier 2 for the civilian branch — a population/importance
// scale, not an architectural style (that's Tier 3, e.g. "port" or "walled
// city" — deferred, not yet modeled).
export type CivilianScale = "village" | "town" | "city" | "metropolis";

// OutpostKind: Tier 2 for the outpost branch — small, purpose-built,
// low-population places defined by function rather than size. A wizard's
// tower or lighthouse is a `poi` (Landmark), not an OutpostKind — it's too
// singular/unique to be "a type of outpost."
export type OutpostKind =
  | "monastery" | "military_fort" | "trading_post" | "mining_camp" | "waystation";

// --- Tier 2: Point of Interest — no Tier 1.5 fork (for now) ------------------
export type PoiKind = "ruin" | "dungeon" | "lair" | "landmark";

export type NodeSubtype = Biome | WaterFeature | CivilianScale | OutpostKind | PoiKind;

// --- Boundary: an orthogonal secondary marker, not a type or subtype ---------
// Any node, regardless of its NodeType/subtype, can carry a boundary marker
// recording that it sits at the edge of the generated region and why. This
// replaces the old "mountain" NodeType entirely — a node near mountains is
// still a wilderness (or settlement, or poi) node that happens to carry a
// mountain_range boundary marker. Deliberately excludes political
// frontier/"border territory" — a settlement with any boundary marker already
// reads as a border settlement; no separate flag needed.
export type BoundaryReason =
  | "coastline" | "mountain_range" | "canyon_void" | "magical_barrier";

export interface BoundaryMarker {
  reason: BoundaryReason;
  notes?: string;
}

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
  id: string;               // uuid v4
  label: string;             // e.g. "Ashford"
  type: NodeType;
  subtype?: NodeSubtype;     // Tier 2 — generator-assignable (Section 3c); Tier 3+ detail is always user-only
  boundary?: BoundaryMarker; // optional — generator-assignable; any NodeType may carry one
  coastal?: boolean;         // additive feature — orthogonal to subtype; independent of boundary.reason === "coastline"
  gx: number;                // logical grid col — float OK (jitter applied)
  gy: number;                // logical grid row — float OK
  notes?: string;            // DM notes, not rendered on map
  factionId?: string;        // ref to Faction.id — extension layer, nullable
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
  algorithmVersion: string;  // semver string, e.g. "2.0.0" — set by generator
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

// Which placement/edge-building algorithm generates the map. "grid" is the
// original scan-a-rectangular-grid approach; "radial" places a core
// settlement at the center and grows spoke chains outward from it (spec
// Section 7e). This is a real, generator-visible mode field — unlike region
// presets or recommendedGridDimensions, the two algorithms are genuinely
// different code paths, not different values for the same one.
export type PlacementAlgorithm = "grid" | "radial";

export interface GenerationParams {
  // Seed
  seed: number;              // required — 32-bit unsigned integer

  placementAlgorithm: PlacementAlgorithm; // default "grid"

  // Map shape
  targetNodeCount: number;   // 20–80, default 49
  gridCols: number;          // 6–14, default 10 ("grid" mode only — a "radial" map derives its own grid size, see radialSpokeCount below)
  gridRows: number;          // 5–12, default 8 ("grid" mode only, same as above)

  // --- "radial" mode only below — always present (flat, per spec Section
  // 7f) even when placementAlgorithm is "grid", so switching modes back and
  // forth never discards a user's tuning. Inert under "grid", the same way
  // e.g. wildernessWaterFraction is inert when nodeTypeBias.wilderness is 0.
  radialSpokeCount: number;            // 1–8, default 6 — how many of the 8 CompassDirs grow a spoke from the core
  radialCoreInterconnectivity: number; // 0.0–1.0, default 0.5 — strength of the ring-connection falloff (high near core, taper outward)
  radialBranchChance: number;          // 0.0–1.0, default 0.15 — chance a spoke forks into an extra node at a given radius step
  radialClusterChance: number;         // 0.0–1.0, default 0.1 — chance a ring position places a small hamlet cluster instead of one node
  radialDeadEndPoiBias: number;        // 0.0–1.0, default 0.6 — chance a true dead-end node (degree 1, pre-min-degree-topup) gets re-typed toward poi
  radialConvergenceRadius: number;     // grid units, default 1.5 — distance threshold for the final cross-spoke connection pass

  // Node type frequency (three values must sum to 1.0)
  nodeTypeBias: {
    settlement: number;      // default 0.20
    wilderness: number;      // default 0.55
    poi: number;             // default 0.25
  };

  // Tier 1.5 fork fractions — how much of each Tier 1 type's placements land
  // on the "secondary" branch; the rest take the "primary" branch.
  wildernessWaterFraction: number;    // 0.0–1.0, default 0.15 — fraction of wilderness placements that are water (vs. land/biome)
  settlementOutpostFraction: number;  // 0.0–1.0, default 0.25 — fraction of settlement placements that are outposts (vs. civilian-scale)

  // Biome frequency for the wilderness land branch (six values must sum to
  // 1.0) — replaces a flat uniform pick so a generated map can read as
  // regionally coherent (spec Section 7c: Region Presets is a UI/store
  // convenience for populating this field with a curated combination; the
  // generator itself has no preset concept, it just reads this like any
  // other param).
  biomeMix: {
    forest: number;   // default 0.30
    swamp: number;    // default 0.15
    plains: number;   // default 0.25
    desert: number;   // default 0.10
    tundra: number;   // default 0.10
    jungle: number;   // default 0.10
  };

  // Difficulty / traversal
  checkRequiredFraction: number;  // 0.0–1.0, default 0.25
  edgeDensity: number;            // 0.0–1.0, default 0.5
                                  // 0 = sparse (avg 2–3 exits/node), 1 = dense (avg 5–6 exits)

  // Containment — replaces the old mountain-specific mountainEdgeFraction.
  // Fraction of edge-zone nodes that receive a boundary marker (any reason);
  // the generator picks a reason per node rather than this being exposed
  // per-reason, keeping the params surface small for now.
  boundaryFraction: number;       // 0.0–1.0, default 0.7

  // Optional physical-plausibility layer. Off by default — most maps don't
  // need terrain zones, and this is the one generator capability that writes
  // to `extensions` (still leaving `extensions.factions` untouched always).
  generateTerrainZones: boolean;  // default false
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
