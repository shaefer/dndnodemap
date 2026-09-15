# Overworld Node Map — App Specification v2
## For Claude Code — Incremental Build

---

## 0. How to Use This Document

This spec is the single source of truth. Claude Code should read it in full before writing any code. When the spec does not cover a decision, stop and ask — do not invent. Every architectural decision made without asking must be undone.

Build in the milestone order defined in Section 10. Do not begin a milestone until the previous one passes its acceptance criteria. Each milestone produces working, runnable code.

---

## 1. Purpose

A standalone web app for generating, editing, and exporting node-based overworld maps for tabletop RPGs (D&D 5e). Maps are directional graphs: named location nodes connected by compass-direction edges.

Three capabilities:
- **Generate** — produce a new map from configurable parameters and a seed
- **Edit** — adjust any generated map manually
- **Export** — JSON (re-import), Markdown reference table, PNG, SVG

---

## 2. Architectural Contract

This is the most important section. Every layer has a strict boundary. Violating a boundary is a bug, not a style issue.

### Layer 1 — Pure Core (`src/core/`)

**What it is:** All logic that transforms data. No imports from React, no DOM access, no side effects of any kind.

**What it may import:** Other files within `src/core/`, `src/types/`, and the `seedrandom` package (in `rng.ts` only). No other external dependencies.

**Every function in this layer must be:**
- Pure: same inputs always produce same outputs
- Tested: each function has corresponding unit tests
- Side-effect free: no mutation of arguments, no global state, no randomness except via the injected PRNG

**Files:**
```
src/core/
  rng.ts          # Seeded PRNG — seedrandom wrapper + convenience functions
  compass.ts      # Direction math — pure functions only
  graph.ts        # Graph algorithms — BFS, connectivity, hop counts
  geometry.ts     # Convex hull / hull padding — used by terrain wash and faction territory rendering
  taxonomy.ts     # Tier 1.5 fork predicates (isWaterBranch, isOutpostBranch) — Section 3c
  generationShared.ts # Classification/connection-type/connectivity-repair logic shared by both placement algorithms — Section 7e
  generator.ts    # Map generation ("grid" placement algorithm) — orchestrates the above, dispatches to radialGenerator.ts
  radialGenerator.ts # Map generation ("radial" placement algorithm) — Section 7e
  validator.ts    # Invariant checks — returns violations, never throws
  exporter.ts     # toJSON(), toMarkdown(), toSVGString()
  names.ts        # Static name lists by node type
  shareCode.ts    # encodeParams()/decodeParams() — Section 13b
```

### Layer 2 — State (`src/store/`)

**What it is:** Application state and the operations that change it. Handles persistence (localStorage). Knows about types but calls core functions for all computation.

**What it may import:** `src/core/`, `src/types/`, Zustand.

**What it must not do:** Render anything. Contain logic that belongs in core (no graph math, no RNG).

**Files:**
```
src/store/
  mapStore.ts       # Current map, selection, undo/redo stack
  libraryStore.ts   # Saved maps/seeds list, localStorage sync
```

### Layer 3 — UI (`src/components/`)

**What it is:** React components. Reads from store, dispatches to store. No business logic.

**What it must not do:** Call core functions directly (go through the store). Compute derived map data inline (derive in store selectors or core).

**What it may import:** `src/store/`, `src/types/`, React, and UI libraries.

---

## 3. Types (`src/types/map.ts`)

Types are split into two files: core types that the generator uses, and extension types that are always optional and never touched by the generator.

### 3a. Core Types (`src/types/map.ts`)

```ts
// All CompassDir values — the full 8-direction set
export type CompassDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// --- Tier 1: NodeType — "what kind of place is this" -------------------------
// See Section 3c for the full tiered-classification model (Tier 1 / Tier 1.5
// forks / Tier 2 subtype / Boundary / Tier 3+). All three values are
// generator-aware — the generator can place any of them.
export type NodeType = "settlement" | "wilderness" | "poi";

// --- Tier 1.5: Wilderness forks into Land | Water ----------------------------
// The fork is inferable from which subtype union `subtype` belongs to — no
// separate "branch" field. A wilderness node's subtype is always either a
// Biome (land branch) or a WaterFeature (water branch).

// Biome: Tier 2 for the land branch. Shared with TerrainZone.terrain (Section
// 3b) — the same vocabulary describes one node's flavor or a whole zone's
// ambient condition, just at different scope. Elevation/hilliness/canyon
// character lives on TerrainZone.elevation instead (zone-scale only — see
// Section 3b); it is deliberately not a per-node field.
export type Biome = "forest" | "swamp" | "plains" | "desert" | "tundra" | "jungle";

// WaterFeature: Tier 2 for the water branch — small-scale visitable water
// features. river_crossing = the node where you deal with a river — bridge,
// ford, ferry, etc. The map shows the challenge; how the party solves it is
// not the map's problem. Large water bodies (a lake or ocean that shapes a
// whole region) are TerrainZone terrain, not a node — see Section 3b.
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
// reads as a border settlement; no separate flag needed (see Section 3c).
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
  coastal?: boolean;         // additive feature — orthogonal to subtype; independent of boundary.reason === "coastline" (Section 3c)
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

export interface GenerationParams {
  // Seed
  seed: number;              // required — 32-bit unsigned integer

  // Map shape
  targetNodeCount: number;   // 20–80, default 49
  gridCols: number;          // 6–20, default recommendedGridDimensions(targetNodeCount).gridCols (14 at the default 49)
  gridRows: number;          // 5–20, default recommendedGridDimensions(targetNodeCount).gridRows (14 at the default 49)

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
  // 1.0) — replaces a flat uniform pick across all six Biome values so a
  // generated map can read as regionally coherent (Section 7c: Region
  // Presets is a UI/store convenience for populating this field with a
  // curated combination; the generator itself has no preset concept, it
  // just reads whatever is here, exactly like every other param).
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
  // the generator picks a reason per node (Section 7) rather than this being
  // exposed per-reason, keeping the params surface small for now.
  boundaryFraction: number;       // 0.0–1.0, default 0.7

  // Optional physical-plausibility layer (Section 7, Step 2.5). Off by
  // default — most maps don't need terrain zones, and this is the one
  // generator capability that writes to `extensions` (still leaving
  // `extensions.factions` untouched always — see Section 3c).
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
```

### 3b. Extension Types (`src/types/extensions.ts`)

**The generator never reads or writes these types.** The validator never requires them. The renderer draws them when present and ignores them when absent. The UI shows extension panels only when the map's `extensions` object contains data.

The `MapExtensions` container lives on `WorldMap` so extensions round-trip cleanly through JSON export without any migration logic.

```ts
import type { Biome } from "./map"; // circular type-only import — erased at compile time, TypeScript handles this fine

// The container — always present on WorldMap, all fields optional arrays
export interface MapExtensions {
  terrainZones?: TerrainZone[];
  factions?: Faction[];
  edgeTerrainTags?: EdgeTerrainTag[];
}

// --- Terrain ---

// TerrainType: ambient regional conditions — large-scale, not a destination.
// Reuses Biome (Section 3a) rather than re-listing it — a node's flavor and a
// zone's ambient condition are the same vocabulary at different scope (see
// Section 3c). "coast" is valid here as a zone-wide ambient condition even
// though it's a per-node boolean (MapNode.coastal) at node scope — a whole
// region can read as coastal without every member node being individually
// flagged. lake / ocean obey the scale rule: large bodies that shape a region
// belong here. Small visitable water features (ponds, river crossings) are
// WaterFeature nodes instead (Section 3a).
export type TerrainType =
  | Biome
  | "coast"
  | "lake" | "ocean";    // large water bodies — traversal requires sea_route edges

// Elevation/topography texture — zone-scale only (Section 3c explains why
// this isn't also a per-node field). hills and canyon were both considered as
// new node-level "terrain features" and folded in here instead: hills is just
// naming what "rolling"/"elevated" already mean, canyon is "valley" (or
// "steep" for a more dramatic, cliff-walled gorge) — one topography axis, not
// two overlapping ones.
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
```

**Extension invariants (checked by validator, warnings only — not blocking):**
- Every `nodeId` in a `TerrainZone` or `Faction` must reference a node that exists in `WorldMap.nodes`
- Every `edgeId` in an `EdgeTerrainTag` must reference an edge that exists in `WorldMap.edges`
- A node should belong to at most one `Faction` (warn if duplicated)
- A node may belong to multiple `TerrainZone`s (zones can overlap — valid)

---

### 3c. Classification Model — Tiers, Forks, and Boundary

This section explains *why* Section 3a's and 3b's types are shaped the way they are. It exists because the original design discussion behind this app worked out a much richer classification system than the first written spec captured — that first pass over-corrected into "the generator never touches any of this nuance," which was wrong. This section is the corrected, permanent model. Read it before adding any new node category, subtype, or feature — it tells you which tier it belongs at.

**The tiers:**

- **Tier 1 — `NodeType`.** "What kind of place is this," full stop: `settlement | wilderness | poi`. Kept deliberately tiny and stable. A new Tier 1 value should be rare — most new ideas belong at a lower tier instead (see the heuristic below).
- **Tier 1.5 — an internal fork.** Some Tier 1 types split into two mutually-exclusive sub-flavors, each with its *own* independent Tier 2 vocabulary — not just a tag, a genuinely different subsequent classification tree. Currently two: Wilderness forks into **Land | Water**; Settlement forks into **Civilian | Outpost**. The fork is never a field of its own — it's inferable from which subtype union `MapNode.subtype` belongs to (a `Biome` value implies the land branch, a `WaterFeature` value implies the water branch, and so on). Use this pattern sparingly; it's for cases where two flavors of the same Tier 1 type are different enough that they shouldn't share a Tier 2 list at all.
- **Tier 2 — `NodeSubtype`.** One level of categorical specificity: `Biome`/`WaterFeature` under Wilderness, `CivilianScale`/`OutpostKind` under Settlement, `PoiKind` under Point of Interest. **This is the generator's floor** — see "What the generator may place," below.
- **Tier 3+ — always user-authored, generator never touches it.** Finer detail under a Tier 2 value: architectural style under a civilian settlement (port, walled city — not yet modeled), specific ruin flavor under `PoiKind: ruin` (monument, tomb, tower, shrine — today's leftover `RuinSubtype` values), `grove` under `Biome: forest`/`jungle`. Nothing stops a future milestone from adding real Tier 3 types; when it does, the generator still must not assign them.

**Boundary is not a tier at all — it's an orthogonal secondary marker.** Any node, regardless of its Tier 1/1.5/2 classification, can carry a `BoundaryMarker` recording that it sits at the edge of the generated region and *why*: `coastline | mountain_range | canyon_void | magical_barrier`. It answers a completely different question ("is this place at an edge, and why") than the node's primary classification ("what kind of place is this"). This is also why the old `mountain` `NodeType` is gone: a node near mountains is still a wilderness (or settlement, or poi) node that happens to carry a `mountain_range` boundary marker — it was never really a fifth peer of settlement/wilderness/ruin, it was this concept wearing a type's clothes. Political frontier/"border territory" is deliberately *not* a boundary reason — a settlement that ends up with any boundary marker already reads as a border settlement; a separate flag would be redundant.

**`coastal` is a lone additive feature, not folded into Boundary or Biome.** It's a plain per-node boolean, independent of `boundary.reason === "coastline"` — a node can be flavorfully coastal without being at the map's literal edge, and vice versa. It exists as its own field (rather than joining `ElevationHint`) because it drives real mechanics — `sea_route` edge assignment — on every map, not just ones that opt into terrain zones.

**Elevation/hilliness/canyon character lives on `TerrainZone.elevation` only** (Section 3b), not on individual nodes. `hills` and `canyon` were both considered as new node-level "terrain features" and folded into the existing `ElevationHint` axis instead once it became clear they were just naming what `rolling`/`elevated` and `valley`/`steep` already meant — one topography axis, not two overlapping ones. The tradeoff: elevation texture is only expressible on maps that use terrain zones at all (an optional extension layer), unlike `coastal`.

**What the generator may place (as of this spec version):** any `NodeType`, any Tier 1.5 fork, any Tier 2 `NodeSubtype`, any `BoundaryMarker`, and — optionally, gated by a params toggle — `TerrainZone` extension data (Section 7 covers exactly how). **What the generator must never place:** Tier 3+ detail of any kind, and anything in `MapExtensions.factions`. Factions/political territory are out of scope for generation entirely, not just deferred for this pass — that's a deliberate, permanent line, not a temporary gap (see the concept doc's framing: political texture is the DM's voice, not the algorithm's).

**Heuristic for classifying new detail, going forward:**

Ask: *does this new value replace/refine what the parent classification already means, or does it independently layer on top regardless of the parent value?*

- **Fork** — a strictly more specific version of *one particular* parent value, meaningless for its siblings. Belongs one tier deeper, scoped under that one parent. (`grove` only means anything under `forest`/`jungle`, not under `desert` — a Tier 3 fork under `forest`, not a Tier 2 `Biome` peer.)
- **Additive feature** — a modifier that can combine with *any* (or most) sibling values without changing what the base classification means. A separate, orthogonal field, not a new enum peer. (`Boundary` is the flagship example — it applies across every Tier 1 type equally. `coastal` is the other.)
- **Tier-1.5 fork** — the heavier-weight case described above. Use sparingly — it changes the whole subsequent classification tree, not just one field.

---

## 4. Seeded RNG (`src/core/rng.ts`)

Use **seedrandom** (`npm install seedrandom`, types via `@types/seedrandom`). Do not use `Math.random()` anywhere in the generator. Do not implement a custom PRNG.

```ts
import seedrandom from 'seedrandom';

// RngFn is the callable type returned by seedrandom — () => number in [0, 1)
export type RngFn = () => number;

// Create a seeded RNG from a numeric seed.
// Converts the number to a string — seedrandom accepts any string as a seed.
// Same seed always produces the same sequence.
export function makeRng(seed: number): RngFn {
  return seedrandom(String(seed));
}

// Integer in [min, max] inclusive
export function randInt(rng: RngFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Pick a random element from an array — array must be non-empty
export function randPick<T>(rng: RngFn, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Shuffle array in-place using Fisher-Yates — mutates, returns void
export function shuffle<T>(rng: RngFn, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

**Contract:** The generator calls `makeRng(params.seed)` exactly once and passes the resulting `RngFn` through every sub-function. Any code that needs randomness takes `rng: RngFn` as a parameter — it never calls `makeRng` itself. This guarantees that same seed + same params = identical output and that the call sequence is fully deterministic.

**Seed format:** Seeds are 32-bit unsigned integers (0–4294967295). The UI generates a random seed via `Math.floor(Math.random() * 4294967296)` on first load, on "Randomize," and — unless "Lock current seed" is checked (Section 11, View B) — on every "Generate" click too. This is the only legitimate use of `Math.random()` in the app.

**Algorithm version:** The constant `ALGORITHM_VERSION = "1.0.0"` in `generator.ts` must be incremented (minor) whenever the generator's RNG call sequence changes in a way that makes a given seed produce different output. Major version = breaking change to the data model. Document the version changelog in `CHANGELOG.md`.

---

## 5. Compass Math (`src/core/compass.ts`)

```ts
export const ALL_DIRS: CompassDir[] = ["N","NE","E","SE","S","SW","W","NW"];

// Returns the exact opposite direction
export function oppositeDir(dir: CompassDir): CompassDir

// Converts an angle in radians to the nearest CompassDir
// angle 0 = East, increases counter-clockwise (standard Math.atan2 convention)
export function angleToDir(radians: number): CompassDir

// Returns the dx,dy unit vector for a compass direction
// (N = dy:-1, E = dx:1, NE = dx:1 dy:-1, etc.)
export function dirToVector(dir: CompassDir): { dx: number; dy: number }

// Given two grid positions, returns the compass direction from a to b
export function dirBetween(
  ax: number, ay: number,
  bx: number, by: number
): CompassDir
```

All pure. No state. Full unit test coverage (the 8-direction symmetry makes this easy to test exhaustively).

---

## 6. Graph Algorithms (`src/core/graph.ts`)

```ts
// Returns true if all nodes are reachable from any start node
export function isConnected(nodes: MapNode[], edges: MapEdge[]): boolean

// Returns array of node ids unreachable from startId
export function unreachableFrom(
  startId: string,
  nodes: MapNode[],
  edges: MapEdge[]
): string[]

// Returns the shortest hop count between two nodes (-1 if not connected)
export function hopCount(
  fromId: string,
  toId: string,
  edges: MapEdge[]
): number

// Returns the farthest hop count reachable from a given node
export function maxHopsFrom(nodeId: string, edges: MapEdge[]): number

// Returns all edges connected to a node (in either direction)
export function edgesForNode(nodeId: string, edges: MapEdge[]): MapEdge[]

// Returns all directions already used from a node (outgoing only)
export function usedDirections(nodeId: string, edges: MapEdge[]): CompassDir[]

// Returns which CompassDirs are still free from a node
export function freeDirections(nodeId: string, edges: MapEdge[]): CompassDir[]
```

---

## 7. Generator (`src/core/generator.ts`)

Signature:
```ts
export function generateMap(params: GenerationParams): WorldMap
```

This is the only public export. Internally it calls the steps below in order. Each step is a private pure function that takes `rng` and returns data — it does not mutate any outer scope.

### Step 1 — `placeNodes(params, rng): MapNode[]`

Per Section 3c, the generator now places a full Tier 1/1.5/2 classification per node, plus boundary markers — not just a bare `NodeType`.

- Create a `gridCols × gridRows` logical grid
- Divide the grid into spatial zones:
  - **Center zone** (inner 50% by area): eligible for all three Tier 1 types
  - **Mid zone** (next ring out): eligible for all three Tier 1 types
  - **Edge zone** (outer 1–2 rows/cols): eligible for all three Tier 1 types, but this is where `boundaryFraction` concentrates — see below
- Fill zones by drawing from `nodeTypeBias` weights (`settlement | wilderness | poi`, three values now, not four), constrained to eligible zones exactly as before
- For each placed node, resolve its Tier 1.5 fork and Tier 2 subtype:
  - **Wilderness:** roll `rng() < params.wildernessWaterFraction` → water branch (pick a `WaterFeature`, uniform); else land branch (pick a `Biome`, weighted by `params.biomeMix` — not uniform; see Section 7c)
  - **Settlement:** roll `rng() < params.settlementOutpostFraction` → outpost branch (pick an `OutpostKind`); else civilian branch (pick a `CivilianScale`, weighted toward `village`/`town` — `city` and especially `metropolis` should be rare, at most one or two `city`-or-above per map regardless of `targetNodeCount`)
  - **Poi:** pick a `PoiKind` (`ruin | dungeon | lair | landmark`)
- Boundary markers: for nodes in the edge zone, roll `rng() < params.boundaryFraction`; if true, attach a `BoundaryMarker` with a reason chosen from `coastline | mountain_range | canyon_void | magical_barrier` (uniform pick is an acceptable default — no evidence yet that a different weighting is needed). Mid-zone nodes may also occasionally receive one at a much lower rate to avoid a hard ring artifact at the zone boundary (mirrors the old `midZoneMountainAllowed` safety-margin idea).
- `coastal`: set `true` on a node when it has `boundary.reason === "coastline"`, and independently (low probability) on other wilderness/settlement nodes to avoid every coastal-flavored node being confined to the boundary ring
- Apply jitter: add `(rng() - 0.5) * 0.5` to each placed node's `gx` and `gy`
- Generate placeholder label from the Tier 2 subtype where possible (e.g. `"Village-1"`, `"Forest-3"`), falling back to the Tier 1 type if no subtype was assigned

### Step 2 — `buildEdges(nodes, params, rng): MapEdge[]`

For each node A, find candidate neighbors within `candidateRadiusFor(params)` (Euclidean distance in grid units — M4.7.3's density-aware replacement for the old fixed `1.6`; see Section 7d). For each candidate B:
1. Compute direction via `dirBetween()`
2. Skip if direction already used from A
3. Skip if edge A↔B already exists (check both directions)
4. Skip if either node already has more than `targetDegree` exits
   - `targetDegree` = `2 + Math.round(params.edgeDensity * 4)` → range 2–6
5. Add edge with probability weighted by distance (closer = more likely)
6. Assign `connectionType` based on the two nodes' classification (checked in this order):
   - either node carries `boundary.reason === "mountain_range"`, and the other is that same reason or wilderness: `"pass"`
   - either node is a wilderness node on the water branch: `"river_ford"`
   - both nodes are `coastal` (or both belong to an `ocean`/`lake` `TerrainZone`, if Step 2.5 ran): `"sea_route"` — the generator may now place this (see Section 3c; it wasn't allowed to before)
   - settlement–settlement or settlement–wilderness: `"road"` (50% probability) or `"trail"`
   - all others: `"trail"`
   - `seasonal` is still never generator-placed — there's no reliable signal yet for when a route should read as conditionally passable; that stays a manual, DM-authored call (`edge.notes` carries the condition)
7. Generator never sets: `travelDays`, `factionId`, or `extensions.factions` — see Section 3c for exactly what's now in-bounds vs. permanently out

After initial pass, run `isConnected()`. If false, run a connectivity repair pass:
- Find all connected components
- Repeatedly merge the **globally nearest pair of components** — the closest node pair across *any* two components, not just "the 2nd-largest into the largest" — adding a bridging edge between them in the correct compass direction (or closest jointly-available direction if exact is taken), until only one component remains

**Why nearest-pair, not size-ranked:** an earlier version always attached whichever component wasn't currently the largest directly to the largest one, regardless of geography. On a sparse map with several small isolated pockets sitting near each other but far from whatever the largest component happened to be, this produced absurdly long bridge edges (a real generated map hit a ~10.6-unit edge when every other edge on it was under ~2 units) — each small pocket paid the full cross-map distance instead of consolidating with its nearby neighbors first. True nearest-component-pair merging (single-linkage) lets local pockets join up locally before anything has to reach further. See `generator.test.ts`'s regression test, pinned to the exact seed/params that surfaced this.

### Step 2.5 — `generateTerrainZones(nodes, params, rng): TerrainZone[]` (optional)

Only runs when `params.generateTerrainZones` is true; otherwise skipped entirely and `extensions.terrainZones` stays empty, exactly as before. When enabled:
- Cluster nearby land-branch wilderness nodes (and any nodes within the cluster's rough footprint) that ended up with the same `Biome` into a `TerrainZone` of that `terrain`
- A cluster of `coastal` nodes along one edge of the map may form an `ocean` (or `lake`, if fully enclosed) zone instead of/alongside a land biome zone
- Pick an `ElevationHint` per zone (a simple, defensible default: `flatland` unless the zone overlaps a concentration of `mountain_range`-boundary nodes, in which case `elevated`/`steep`)
- This is the only generator step that writes to `extensions` at all — it still never touches `extensions.factions`

### Step 3 — `markCheckRequired(nodes, edges, params, rng): MapEdge[]`

Returns a new edges array (do not mutate). Mark an edge `checkRequired = true` if:
- Either node carries a `mountain_range` boundary marker and the other is also boundary-marked or wilderness, OR
- One node is boundary-marked (any reason) and one is wilderness AND `rng() < params.checkRequiredFraction`, OR
- Neither node is boundary-marked AND `rng() < params.checkRequiredFraction * 0.2` (rare dramatic routes)

After marking, enforce constraint: every node must have at least one edge where `checkRequired = false`. If a node's only edges are all check-required, unmark the one with the lowest-difficulty neighbor.

### Step 4 — `assignCheckTypes(edges, rng): MapEdge[]`

For each `checkRequired` edge, assign a `checkType` string based on `connectionType`:
- `"pass"` (mountain range crossing): `"Athletics DC ${randInt(rng, 14, 18)}"`
- `"river_ford"`: `"Athletics DC ${randInt(rng, 10, 14)}"`
- `"sea_route"`: `"Athletics DC ${randInt(rng, 12, 16)}"` (vessel handling — new, since the generator can now place this connection type)
- `"trail"` in difficult terrain: `"Survival DC ${randInt(rng, 10, 14)}"`
- `"road"` (rare — washed out, broken): `"Athletics DC ${randInt(rng, 8, 12)}"`

### Step 5 — Assemble `WorldMap`

```ts
return {
  id: crypto.randomUUID(),
  name: "Unnamed Region",
  nodes,
  edges,
  extensions,        // {} unless generateTerrainZones ran (Step 2.5) — factions is always untouched
  params,
  algorithmVersion: ALGORITHM_VERSION,  // imported constant "2.1.2" — see Section 4's version history for what each bump changed
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
```

---

## 7c. Region Presets (`src/core/regionPresets.ts`) — a UI/store convenience, not a generator concept

The generator has **no preset concept whatsoever** — Step 1 always just reads `params.biomeMix` directly, exactly like every other param. Region presets exist entirely to make it easy to *populate* `biomeMix` (and `wildernessWaterFraction`) with a curated, thematically coherent combination in one action, the same way "Randomize" sets a concrete `seed` without `seed` ever needing to know "random" is a concept — there's no "which mode is active" tracked anywhere.

Six presets, each `{ label, biomeMix, wildernessWaterFraction }`, all `biomeMix` values summing to exactly 1.0:

```
Preset            forest swamp plains desert tundra jungle  water
Temperate Mixed    .30    .15   .25    .10    .10    .10    .15
Magical Forest     .55    .10   .15    .05    .00    .15    .25
Frost              .05    .05   .20    .10    .60    .00    .20
Arid Desert        .05    .05   .20    .55    .05    .10    .05
Swampland          .20    .50   .10    .05    .05    .10    .30
Tropical Jungle    .15    .15   .10    .05    .00    .55    .20
```

Each has one dominant biome (~50–60%) and the thematically-contradictory biome at or near zero — a `tundra`-heavy region reads as coherent because `desert`/`jungle` are rare or absent by construction, without any spatial "don't place these two next to each other" logic (a hard adjacency constraint was considered and deliberately not built — the macro weighting alone was judged sufficient).

`store/mapStore.ts` exposes `applyRegionPreset(id)` (sets `biomeMix` + `wildernessWaterFraction` on `draftParams` from a named preset) and `randomizeRegionPreset()` (picks one of the six via `Math.random()` — the same sanctioned exception `randomizeSeed()` already uses, mirrored the same way). `DEFAULT_GENERATION_PARAMS` initializes from one randomly-picked preset at module load, so an untouched fresh app load still reads as a coherent region rather than a flat average of all six biomes. Manually dragging any biome slider afterward is just "whatever `biomeMix` says now" — no separate "custom mode" exists to fall into or out of.

---

## 7d. Grid sizing scaled to node count (`src/core/geometry.ts`'s `recommendedGridDimensions`) — M4.7.3

Tight local clusters on a fixed-size grid were the root cause behind two bugs (an absurdly long `repairConnectivity` bridge edge, and a direction mislabel where two neighbors competed for the same compass slot). `recommendedGridDimensions(targetNodeCount)` gives nodes more breathing room by sizing a square grid roughly double the linear dimension that would just fit them:

```ts
export function recommendedGridDimensions(targetNodeCount: number): { gridCols: number; gridRows: number } {
  const side = Math.ceil(Math.sqrt(targetNodeCount)) * 2;
  return { gridCols: side, gridRows: side };
}
```

This is a **mitigation, not a guarantee** — it makes tight local clusters statistically rarer, but doesn't change how `buildEdges`/`ensureMinimumDegree` pick a fallback direction when one does occur. Square only; aspect-ratio/portrait-landscape shape control was a separate idea (not built) for an eventual alternative placement algorithm.

`store/mapStore.ts` exposes this as an explicit `applyRecommendedGridSize()` action (mirrors `applyRegionPreset` — a one-shot recompute the user triggers, not a hidden coupling on the node-count slider) and uses it once to compute `DEFAULT_GENERATION_PARAMS.gridCols`/`gridRows` at module load (14×14 for the default 49-node target, replacing the old fixed 10×8). `GeneratePanel.tsx` exposes it as an "Auto-size grid" button next to the Node count/Grid cols/Grid rows sliders, which remain independently adjustable afterward — moving them again after clicking the button is just a new `gridCols`/`gridRows`, same as any other param.

Because a sparser grid means fewer node pairs fall within a fixed candidate-search radius, `core/generator.ts`'s old fixed `CANDIDATE_RADIUS = 1.6` became a density-aware `candidateRadiusFor(params)` (see Section 7, Step 2) so the normal `buildEdges` pass — not the repair paths — still does most of the connecting work on a sparser grid. It's calibrated to reproduce exactly `1.6` at the pre-existing default density (49 nodes / 10×8 grid), so that one specific grid/node combination is bit-identical to before; only other combinations see a different candidate radius (and thus a different RNG-consuming sequence — `ALGORITHM_VERSION` → `2.1.2`).

Widening `gridCols`/`gridRows`' practical range past 15 (`recommendedGridDimensions(80)` = 18) broke `core/shareCode.ts`'s v1/v2 byte layout, which packed both into a single byte as two 4-bit nibbles — see Section 13b for the resulting `PARAMS_CODEC_VERSION 3`.

---

## 7e. Radial (core-out) generation algorithm (`src/core/radialGenerator.ts`) — M4.8

A genuinely separate placement/edge-building algorithm, not a tweak to the grid one — selected via a new, real, generator-visible field: `GenerationParams.placementAlgorithm: "grid" | "radial"`. Unlike region presets or `recommendedGridDimensions` (both deliberately "no mode field" — they just set concrete values in existing params), radial *is* a different code path, so a mode field is the honest model here. `generateMap` (`core/generator.ts`) dispatches on it immediately; both paths still produce an ordinary `WorldMap` (same node/edge shape, same `gx`/`gy`/`gridCols`/`gridRows` coordinate space), so the validator, canvas renderer, exporter, and share-code codec need no radial-awareness at all.

**Mental model — a Growing Tree maze, not literal spokes.** A core settlement sits at the exact center of a square grid, and `radialSpokeCount` initial arms fan out from it. From there, growth is a [Growing Tree maze algorithm](https://weblog.jamisbuck.org/2011/1/27/maze-generation-growing-tree-algorithm) (the well-known generalization of recursive-backtracker/Prim's-style maze generation) adapted to continuous compass-direction space: keep a frontier of still-growable nodes, repeatedly pick one, and try to grow from it. Each step picks a direction by **weighted random choice over every still-free direction at that node**, biased only *against* pointing back at the center (`weight = 0.15 + circularDist(d, inward)`) — there is deliberately **no term for "continue the way we came,"** so paths wind and bend naturally instead of running as straight rays.

> **This was corrected after the first implementation shipped.** M4.8's original version grew literal fixed-radius spokes, snapping every step toward "keep going the way this arm started" via `bestAvailableDirection`. Direct user testing rejected it as far too literal: no direction freedom, no real collision handling, straight rays out of the hub. The knobs below survived (reinterpreted); the growth mechanics were replaced end to end. Don't reintroduce any "prefer the previous heading" term — that *is* the bug.

**Collision handling is the other half of the algorithm.** Before committing a new node, the candidate position is checked against every existing node within `radialConvergenceRadius`. If something's there: if it's already connected, reject that direction and try another; otherwise roll a connect chance (`radialCoreInterconnectivity`, tapering with distance from the core — high near the center, low at the rim, which is what makes the map denser in the middle) and either join to it (a corridor rejoining itself) or reject and try a different heading. A node that exhausts every direction is simply done growing. Two closeness cases are deliberately **exempt** from collision treatment, because the proximity is intentional rather than a maze self-crossing: the initial arms fanning out around the hub (adjacent 45°-apart directions at radius ~1 are only ~0.77 units apart), and members of the same hamlet cluster (tracked via a cluster-group id). Both exemptions were added after each one was found to silently strangle growth.

**Sizing.** The grid is *derived*, not an independent input: `recommendedRadialGridDimensions(targetNodeCount)` (`core/geometry.ts`, alongside `recommendedGridDimensions`) sizes it by **area** — `ceil(sqrt(targetNodeCount)) * 2`, forced odd so there's a true center cell for the core. Arm count deliberately does *not* factor in: in organic maze growth, how far the map spreads is a function of how many nodes it holds, not how many arms it started with. (An earlier arms-based formula badly over-sized the grid — the maze filled about a third of it, leaving dead canvas margins and keeping nodes from ever reaching the outer radius bands where boundary markers live.) `generateMap` stamps this derived size back onto the `WorldMap.params` it returns — the input `gridCols`/`gridRows` are ignored entirely for radial maps, since the validator's boundary-placement check and the share-code codec both key off `map.params.gridCols`/`gridRows`, and those must reflect the grid radial mode *actually* used.

**Radius-as-zone.** A node's radius fraction (distance from the core over half the grid) replaces the grid algorithm's rectangular col/row banding for `BoundaryMarker` eligibility — ≥0.85 = "edge" (full `boundaryFraction` chance), ≥0.5 = "mid" (damped), inner = "center" (none). Radius is a *circular* measure while validator invariant 4's forbidden band is a *square*, so "mid" additionally requires the same explicit `fx`/`fy` box check (`< 0.2 || > 0.8`) the grid algorithm's `midZoneBoundaryAllowed` uses — without it, a diagonal-direction node can clear the radius threshold while still sitting inside the forbidden square.

**Shared with the grid algorithm, not duplicated:** Tier 1.5/Tier 2 classification, connection-type inference, direction/degree bookkeeping, and the connectivity-repair safety net (`repairConnectivity`/`ensureMinimumDegree`) all live in `core/generationShared.ts` — a third module neither generator file owns, so behavior can't quietly drift between the two algorithms. Dependency direction is one-way (`generator.ts` → `radialGenerator.ts` → `generationShared.ts`, and `generator.ts` → `generationShared.ts` directly) — `radialGenerator.ts` never imports from `generator.ts`, avoiding a circular dependency.

**New `GenerationParams` fields** (flat, always present — inert under `"grid"` the same way e.g. `wildernessWaterFraction` is inert when `nodeTypeBias.wilderness` is 0; kept flat rather than nested so switching `placementAlgorithm` back and forth never discards a user's tuning of the other algorithm's sliders):

| Field | Range | Default | What it controls |
|---|---|---|---|
| `radialSpokeCount` | 1–8 | 6 | How many initial arms fan out from the core before general frontier growth takes over. Not a commitment to any heading — those arms wander like everything else. Doesn't affect grid size. |
| `radialCoreInterconnectivity` | 0.0–1.0 | 0.5 | Chance of accepting a collision-triggered join, tapering with distance from the core — this is what makes the middle of the map denser than the rim. Core behavior, not a variant. |
| `radialConvergenceRadius` | grid units | 1.5 | The live collision-detection radius, checked continuously during growth. Core behavior, not a variant. |
| `radialBranchChance` | 0.0–1.0 | 0.15 | Frontier-selection strategy — the Growing Tree algorithm's defining knob. 0 always takes the newest frontier entry (recursive-backtracker-style: long winding single threads, many dead ends); 1 always takes a random entry (Prim's-style: bushier, many more branch points). |
| `radialClusterChance` | 0.0–1.0 | 0.1 | Chance a new-node placement puts down a tight 2–3 node hamlet instead of a single node — the "grouped settlements" knob |
| `radialDeadEndPoiBias` | 0.0–1.0 | 0.6 | Chance a true dead-end node (degree 1, checked *before* `ensureMinimumDegree`'s top-up runs) gets re-typed toward `poi` — "paths that lead nowhere tend to end at a point of interest" |

**Fine-tuning params (M4.9).** Every behavior that was previously a hardcoded constant is now a param, each defaulting to exactly the value it was hardcoded to — so leaving them alone reproduces prior output bit-for-bit. Six are radial-specific:

| Field | Range | Default | What it controls |
|---|---|---|---|
| `radialInwardWeight` | 0.0–1.0 | 0.15 | Relative weight of directions pointing back at the core. Lower = paths avoid doubling back harder. |
| `radialFalloffExponent` | 0.1–5.0 | 1.0 | How sharply `radialCoreInterconnectivity` decays toward the rim. 1 = linear, >1 = dense core only, <1 = stays dense further out. |
| `radialJitter` | 0.0–1.0 | 0.3 | Positional irregularity of each placed node |
| `radialRimFraction` | 0.5–0.95 | 0.85 | Radius fraction where the boundary-marked rim begins. The "mid" band's inner edge scales with it proportionally (`MID_TO_RIM_RATIO`), so both bands move together. |
| `radialClusterMaxSize` | 2–5 | 3 | Largest hamlet cluster; size is a uniform roll from 2 to this |
| `radialClusterSpread` | 0.0–1.0 | 0.35 | How loosely a hamlet's members sit around their shared point |

Five more apply under **both** placement algorithms, since none of them depends on placement geometry — they live in `core/generationShared.ts`'s `classifyNode`/`connectionTypeFor`/`pickCivilianScale` and `core/generator.ts`'s `markCheckRequired`:

| Field | Range | Default | What it controls |
|---|---|---|---|
| `maxLargeSettlements` | 0–6 | 2 | Hard cap on city-or-metropolis settlements regardless of map size (was `MAX_CITY_OR_ABOVE`) |
| `roadFraction` | 0.0–1.0 | 0.5 | Of settlement-touching connections, the share reading as roads rather than trails |
| `coastalChance` | 0.0–1.0 | 0.05 | Chance a node reads as coastal without a coastline boundary marker (was `INDEPENDENT_COASTAL_CHANCE`) — drives `sea_route` frequency |
| `interiorBoundaryDamping` | 0.0–1.0 | 0.15 | How much rarer boundary markers are off the rim than on it (was `MID_ZONE_BOUNDARY_DAMPING`) |
| `wildernessCheckMultiplier` | 0.0–1.0 | 0.2 | `checkRequiredFraction` multiplier for edges where neither end is boundary-marked |

All eleven live behind a collapsible **Advanced tuning** section in the Generation Panel (Section 11, View B) so the main panel stays scannable; the radial-specific six only render when Radial is the selected style.

`radialBranchChance`/`radialClusterChance`/`radialDeadEndPoiBias` are the three "interesting, not essential" flavor knobs; a fourth (`waviness` — small angular drift off a pure compass bearing) was considered and explicitly deferred (and is largely moot now that direction choice is weighted-random rather than heading-locked).

**Share-code codec:** `PARAMS_CODEC_VERSION` → `4` (Section 13b) — `placementAlgorithm` + the six new fields appended to v3's 21 bytes (28 bytes total). `decodeV1`/`decodeV2`/`decodeV3` all backfill `placementAlgorithm: "grid"` + the radial defaults above for old links, exactly the "never break an old link" discipline the codec was designed around.

---

## 8. Validator (`src/core/validator.ts`)

```ts
export interface Violation {
  rule: string;
  detail: string;
  nodeId?: string;
  edgeId?: string;
}

export function validateMap(map: WorldMap): Violation[]
```

Checks all invariants from Section 9. Returns empty array if valid. Never throws. Call this after generation and after every edit operation — the store should surface any violations to the UI.

---

## 9. Invariants (Hard Rules)

These must never be violated. The validator checks all of them.

1. **One direction per node** — no node has two outgoing edges with the same `direction`
2. **No duplicate pairs** — only one edge between any two nodes (undirected check)
3. **Fully connected** — every node reachable from every other node
4. **Boundary placement** (was "Mountain placement") — no node with a `BoundaryMarker` (any reason) has `gx` and `gy` both in the inner 40% of the grid. Generalized from the old mountain-specific rule now that mountain is a boundary reason rather than a `NodeType` (Section 3c) — one invariant covers all four reasons instead of a mountain-only check.
5. **Minimum exits** — every node has at least 2 edges (either direction counts)
6. **No stranded check-required** — every node has at least one edge where `checkRequired = false`
7. **Direction symmetry** — if edge A→B has direction N, no other edge from B has direction S (they'd overlap visually). Warn only, do not reject.

---

## 10. Exporter (`src/core/exporter.ts`)

```ts
// Full round-trip JSON
export function toJSON(map: WorldMap): string

// Markdown reference table matching the node-reference.md format
export function toMarkdown(map: WorldMap): string

// SVG string — full document, white background, legend included, print-ready
// Scale parameter: 1.0 = 1200×800px base
export function toSVGString(map: WorldMap, scale?: number): string
```

`toSVGString` must produce output identical in structure to the prototype HTML file's SVG rendering. No browser APIs — pure string construction. This makes it testable.

---

## 10b. Visual Layer System

The map canvas renders in four independent layers, stacked bottom to top. Each layer except the node layer can be toggled on/off independently via the toolbar. Toggling is a pure UI state change — it never modifies the underlying `WorldMap` data.

### Layer stack (bottom → top)

```
Layer 0 — Terrain wash       (extension, toggleable)
Layer 1 — Faction territory  (extension, toggleable)
Layer 2 — Edges              (always visible)
Layer 3 — Nodes              (always visible)
```

**Layer 0 — Terrain wash**
Rendered when `WorldMap.extensions.terrainZones` is non-empty and the layer is toggled on.

For each `TerrainZone`, compute a convex hull around the screen positions of its member nodes. Draw the hull as a filled polygon with:
- Low-opacity fill (0.12–0.18) in the terrain's default color
- Dashed boundary stroke (0.5px, same color, opacity 0.4)
- A small terrain label floated at the hull centroid (9px, muted, italic)
- No fill or stroke on `lake` / `ocean` zones — use a blue-tinted wash (0.15 opacity) with a subtle wave-pattern stroke on the boundary instead, to visually distinguish water regions from land terrain

Default terrain colors (can be overridden by `TerrainZone.color`):
```
forest   → green  (#3B6D11 @ 0.15)
swamp    → olive  (#5F6B2A @ 0.15)
desert   → amber  (#BA7517 @ 0.12)
plains   → yellow (#8A8A20 @ 0.10)
tundra   → gray   (#888780 @ 0.12)
jungle   → green  (#27500A @ 0.18)
coast    → teal   (#0F6E56 @ 0.12)
lake     → blue   (#185FA5 @ 0.15)
ocean    → blue   (#042C53 @ 0.18)
```
(`hills` is no longer a `TerrainType` value — it folded into `ElevationHint` per Section 3c. A zone's elevation, not its terrain color, now carries that texture.)

**Layer 1 — Faction territory**
Rendered when `WorldMap.extensions.factions` is non-empty and the layer is toggled on.

For each `Faction`, compute a convex hull (with padding — expand outward ~12px from the node positions so the hull doesn't clip node shapes). Draw:
- No fill — territory is shown by border only, to avoid obscuring terrain wash below
- Border stroke: 1.5px, faction color, opacity 0.7
- `borderStyle`:
  - `"solid"` → solid line
  - `"disputed"` → long-dash pattern (8px on, 4px off)
  - `"ancient"` → dot-dash pattern (2px dot, 6px gap, 8px dash, 6px gap)
- Faction name label near the top of the hull, 10px, faction color

**Layer 2 — Edges**
Always visible. Connection type affects visual style:
```
road         → solid, 1.5px, gray (#888780)
trail        → solid, 1px, gray (#888780), opacity 0.7
pass         → solid, 1.5px, gray — with a small ▲ glyph at midpoint
river_ford   → solid, 1.5px, blue (#185FA5) — signals water involvement
sea_route    → dashed, 1.5px, blue (#185FA5), wave-dash pattern (6px on, 3px off)
seasonal     → dotted, 1px, gray (#888780) — signals conditional access
```
Check-required edges additionally get the existing dashed-orange overlay treatment on top of their connection type style.
Direction labels always render regardless of connection type.

**Layer 3 — Nodes**
Always visible. Shape now comes from `NodeType` + Tier 1.5 fork; color comes from `NodeType` for settlement/poi, but from the **Tier 2 subtype** for wilderness — this is the one place color varies *within* a Tier 1 type, because biome identity is exactly the thing a DM wants to read at a glance:
```
settlement, civilian branch → filled square,  large (r=11), fill #F2C14E, stroke #9C6B0A
settlement, outpost branch  → filled diamond, medium (r=8), fill #F2C14E, stroke #9C6B0A
                               — same color as civilian (still "settlement family"), shape carries the fork
wilderness, land branch     → filled circle, small (r=7), color by Biome subtype (below)
wilderness, water branch    → filled circle with inner ring (r=9, inner ring r=5, 1px stroke),
                               fill #185FA5, stroke #0F3D6B
                               — the ring is kept as an extra shape cue beyond color (both blue and
                                 river_ford/sea_route edges read as blue; the ring keeps a water NODE
                                 from being confused with a water-colored EDGE at a glance)
poi                          → filled triangle, r=10, fill #8B5FBF, stroke #5C3D80
                               — one look for all four PoiKind values (ruin/dungeon/lair/landmark);
                                 subtype is available on click/hover, not encoded as a fourth shape/color
```
(The old `mountain` shape — filled square — is gone as a *base* shape; a node "being mountainous" is the `mountain_range` boundary marker below, not a Tier-1/fork shape. Squares are reused here for settlement instead.)

**Wilderness land-branch color by `Biome` subtype** (reuses the terrain-wash hues above as solid node fills, not washes — same palette, two different opacities/purposes):
```
forest  → fill #3B6D11, stroke #24430A
swamp   → fill #5F6B2A, stroke #3D4519
desert  → fill #BA7517, stroke #8A5710
plains  → fill #C9C93D, stroke #8F8F22
         — deliberately a paler, more muted yellow than settlement's #F2C14E so a plains node
           and a settlement square don't read as "the same color, different shape" at a glance
tundra  → fill #A8A8A0, stroke #5F5E5A
jungle  → fill #27500A, stroke #173206
```
If six distinct biome colors read as too busy on a dense map in practice, the fallback is collapsing to two colors (green land / blue water) — try the full six first (per direct instruction) and only fall back if it doesn't work visually.

**Boundary marker badge** — layered on top of *any* node's base shape (Layer 3, drawn after the shape), independent of `NodeType`/fork, when `MapNode.boundary` is set:
```
mountain_range   → small ▲ glyph, upper-right of the shape (same glyph the "pass" edge style already uses, for visual consistency)
coastline        → small 〜 (wave) glyph, upper-right
canyon_void      → small ⌇ (jagged) glyph, upper-right
magical_barrier  → small ✦ (sparkle) glyph, upper-right
```

### Layer toggle UI

Toolbar area gets four small toggle buttons, always visible:
```
[≡ Edges] [◉ Nodes] [⬡ Terrain] [⚑ Factions]
```
Edges and Nodes are always on (buttons shown but disabled/locked). Terrain and Factions are off by default, clickable. When a layer has no data (extensions are empty), the button is greyed out with a tooltip "No terrain zones defined yet."

The same Toolbar also carries zoom controls, right-aligned: `[⛶ Fit] [−] [100%] [+]`. `−`/`+` step the canvas zoom by a fixed factor centered on the canvas's visible center; the `100%` control is itself a button that shows the current zoom percentage and resets pan+zoom to their defaults when clicked. This is a fixed-step complement to the canvas's own continuous wheel/trackpad zoom (View A, Section 11) — not a replacement for it. `Fit` sets scale+pan directly from the current map's node bounding box (padded for label/shape overflow) so the whole map fits the visible canvas in one click, rather than requiring the user to hunt for the right zoom level by hand — an absolute placement, not a relative step like the other three controls.

---

## 11. UI Views

### View A — Map Canvas
- Full-height SVG render of the current map
- Pan (drag), zoom (scroll/pinch), hover tooltip (exits list), click to select node or edge
- Double-click empty space → add node at that position
- Drag node to reposition (updates gx/gy, triggers re-layout of connected edge labels)
- Selected node/edge gets a highlight ring
- Wheel/trackpad zoom scales its factor by the actual scroll delta (clamped), not a flat per-event jump — a light trackpad nudge zooms lightly, a hard mouse-wheel notch zooms more, in both directions around the cursor. The Toolbar (Section 10b) carries explicit `−`/`100%`/`+` zoom controls (fixed-step, centered on the canvas) alongside it, so a precise zoom level is reachable without fighting continuous scroll input; clicking the `100%` control resets pan and zoom together.

### View B — Generation Panel (sidebar, not modal)
Controls read/write the store's `draftParams` directly via `updateDraftParam` (Section 12 is authoritative on this — not a parallel local draft, superseding this view's earlier "local state" phrasing; see `CLAUDE.md`'s M4 notes). Generate button commits and calls the store.

| Control | Type | Range | Default |
|---------|------|-------|---------|
| Generation style | Select | Grid / Radial (core-out) | Grid |
| Node count | Slider | 20–80 | 49 |
| Grid cols *(Grid style only)* | Slider | 6–20 | 14 (`recommendedGridDimensions(49)`) |
| Grid rows *(Grid style only)* | Slider | 5–20 | 14 (`recommendedGridDimensions(49)`) |
| Auto-size grid *(Grid style only)* | Button | — | recomputes Grid cols/rows from the current Node count (Section 7d) |
| Grid size *(Radial style only)* | Read-only text | — | `recommendedRadialGridDimensions(targetNodeCount, radialSpokeCount)`, Section 7e — not an independent input under this style |
| Spoke count *(Radial style only)* | Slider | 1–8 | 6 |
| Core interconnectivity *(Radial style only)* | Slider | 0–100% | 50% |
| Branch chance *(Radial style only)* | Slider | 0–100% | 15% |
| Cluster chance *(Radial style only)* | Slider | 0–100% | 10% |
| Dead-end → POI bias *(Radial style only)* | Slider | 0–100% | 60% |
| Advanced tuning | Collapsible section | — | collapsed; holds the eleven fine-tuning params of Section 7e (six radial-only, five shared across both styles) |
| Convergence radius *(Radial style only)* | Slider | 0–5.0 grid units | 1.5 |
| Settlements | Slider | 0–100% | 20% |
| Wilderness | Slider | 0–100% | 55% |
| Points of Interest | Slider | 0–100% | 25% |
| Edge density | Slider | Sparse→Dense | 50% |
| Difficulty | Slider | Easy→Hard | 25% |
| Boundary containment | Slider | Open→Closed | 70% |
| Water (of Wilderness) | Slider | 0–100% | 15% |
| Outpost (of Settlement) | Slider | 0–100% | 25% |
| Region preset | Select | 6 named presets + "Custom mix" | matches whichever preset (if any) the current `biomeMix`/`wildernessWaterFraction` equals |
| Randomize region | Button | — | — |
| Forest | Slider | 0–100% | 30% |
| Swamp | Slider | 0–100% | 15% |
| Plains | Slider | 0–100% | 25% |
| Desert | Slider | 0–100% | 10% |
| Tundra | Slider | 0–100% | 10% |
| Jungle | Slider | 0–100% | 10% |
| Generate terrain zones | Checkbox | — | off |
| Seed | Number input | 0–4294967295 | random on load |
| Randomize seed | Button | — | — |
| Lock current seed | Checkbox | — | off |
| Generate | Button | — | — |
| Download JSON | Button | — | — |
| Import JSON | Button | — | — |
| Copy Link | Button | — | — |

"Generation style" (Section 7e, M4.8) is a real, generator-visible `placementAlgorithm` field, unlike Region preset below — switching it changes which controls in this panel apply, not just which values are set. Under "Grid," Grid cols/Grid rows/Auto-size grid behave exactly as before. Under "Radial," those three are replaced by a read-only "Grid size" line (the actual grid is derived from Node count + Spoke count, not an independent input) and a new "Radial shape" section of six sliders appears. Every other control (node type frequency, traversal, Tier 1.5 forks, biome mix/region presets, seed) stays visible and equally meaningful under either style, since both algorithms share the same Tier 1.5/Tier 2 classification logic (`core/generationShared.ts`) — only placement geometry differs. Switching styles never discards the other style's slider values from `draftParams`; they're simply inert until switched back to, same as any other param that has no effect under some other field's current value.

The three node type sliders (Settlements/Wilderness/Points of Interest — Tier 1, spec Section 3c) must normalize to sum to 1.0 on change — when one moves, the others scale proportionally to compensate (`rebalanceShares`, `store/mapStore.ts` — generalized from what was originally `rebalanceNodeTypeBias` once the six biome sliders needed the identical behavior). Show the actual percentage next to each slider. "Water"/"Outpost" are Tier 1.5 fork fractions, not Tier 1 shares, and don't participate in that renormalization. The six biome sliders (Forest/Swamp/Plains/Desert/Tundra/Jungle — `biomeMix`, Section 3a) renormalize among themselves the same way, independently of the Tier 1 three. "Region preset" (Section 7c) loads a named preset's `biomeMix` + water fraction into the sliders in one action; "Randomize region" does the same with a randomly-chosen preset. Neither is a persisted "mode" field — the select's displayed value is instead *derived* every render (`selectMatchingRegionPresetId`, `store/mapStore.ts`, epsilon-compared against each registered preset) from whatever `biomeMix`/`wildernessWaterFraction` currently are, so it always shows the preset that's actually active (including the one randomly chosen at load) and falls back to a real "Custom mix" option — not a disabled placeholder — the moment a biome slider is dragged away from it. "Copy Link" copies `window.location.href` (Section 13b) — the address bar already reflects the current map via `generate()`'s `history.replaceState` call, so this button is a convenience, not the only way to get a working link.

**Generate always produces a new map; "Lock current seed" is the explicit opt-out.** `generate()` draws a fresh random seed on every click by default — same as loading the page or hitting "Randomize seed" — so repeatedly clicking Generate never silently repeats the last output. Checking "Lock current seed" flips this: `generate()` reuses whatever seed is currently in `draftParams` instead of randomizing it, so the user can tweak other sliders and regenerate variations against one fixed seed on purpose. The "Randomize seed" button is unaffected by the lock either way — it always sets a new random seed into `draftParams` immediately; combined with the lock, that's how a user deliberately picks a *new* seed to hold rather than the one they started with.

### View C — Node Detail Panel
Right sidebar, appears on node select.

- Name (editable text)
- Type (select dropdown)
- Notes (textarea)
- Exit list: direction | destination | check-required toggle | delete button
- Add exit: direction picker (only unoccupied dirs shown) + node autocomplete
- Delete node button (with confirmation — shows which edges will be removed)

### View D — Edge Detail Panel
Same right sidebar, appears on edge select.

- From → To (read-only labels, with a swap button)
- Direction (select, only shows directions free from the `from` node)
- Reverse direction (auto-calculated read-only)
- Check required (toggle)
- Check type (text input, enabled when check required)
- Notes (textarea)
- Delete edge button

### View E — Library Panel
Left sidebar or modal. Lists all `SavedEntry` items from localStorage.

- Name, seed, date, algorithm version
- Load button
- Delete button
- Save current map button (prompts for name, generates thumbnail)

### View F — Reference Table Modal
Triggered from toolbar.

- Table: Name | Type | Exits (formatted "N→Destination, NW→Other ⚠")
- Second table: check-required routes with check type
- Copy as Markdown button
- Download .md button

---

## 12. State (`src/store/mapStore.ts`)

```ts
interface MapState {
  // Current map
  map: WorldMap | null;
  violations: Violation[];         // result of last validateMap() call

  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Undo/redo
  history: WorldMap[];             // past states, max 30
  future: WorldMap[];              // redo stack

  // Generation draft
  draftParams: GenerationParams;

  // Actions
  generate: () => void;            // uses draftParams, replaces map, clears history
  updateDraftParam: <K extends keyof GenerationParams>(
    key: K, value: GenerationParams[K]
  ) => void;
  randomizeSeed: () => void;

  // Edit actions (all push to history before mutating)
  updateNode: (id: string, patch: Partial<MapNode>) => void;
  deleteNode: (id: string) => void;
  addNode: (node: Omit<MapNode, 'id'>) => void;
  updateEdge: (id: string, patch: Partial<MapEdge>) => void;
  deleteEdge: (id: string) => void;
  addEdge: (edge: Omit<MapEdge, 'id'>) => void;

  undo: () => void;
  redo: () => void;

  // Selection
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
}
```

Auto-save rule: after every action that modifies `map`, write the full `WorldMap` to `localStorage['overworld-current']`.

Undo rule: before every edit action, push a deep copy of the current `map` to `history` (max 30). On undo, pop from `history` and push current to `future`. The generate action clears both stacks.

---

## 13. Persistence

```
localStorage keys:
  overworld-current     WorldMap JSON — auto-saved on every change
  overworld-library     SavedEntry[] JSON — the map library
```

On app load: if `overworld-current` exists and its `algorithmVersion` matches the current version, restore it. If the version differs, show a banner: "This map was generated with an older algorithm version. It can still be edited but cannot be re-generated with the same seed." (Not yet built — see Section 16, M5+.)

---

## 13b. Shareable Map Links (`src/core/shareCode.ts`)

A generated map's full `GenerationParams` (seed included — `seed` is already a field of `GenerationParams`, not a separate value) can be encoded into one short, URL-safe **share code** carried as a query parameter, so pasting the address bar reproduces the identical map for anyone. This is an **encoding**, not a hash — it must be decodable back into the exact params, which a one-way hash (SHA-256, etc.) cannot do.

### Byte layout (`PARAMS_CODEC_VERSION = 5`, 39 bytes)

| Bytes | Field | Encoding |
|---|---|---|
| 0 | codec version | raw uint8 |
| 1-4 | `seed` | uint32 |
| 5 | `targetNodeCount` | raw uint8 (range 20–80 fits) |
| 6 | `gridCols` | raw uint8 |
| 7 | `gridRows` | raw uint8 |
| 8 | `nodeTypeBias.settlement` | fixed-point 0–255 over [0,1] |
| 9 | `nodeTypeBias.wilderness` | fixed-point 0–255 over [0,1] — `poi` derived as `1 - settlement - wilderness` on decode, then all three renormalized to sum to exactly 1 (same drift guard `rebalanceShares` already uses) |
| 10 | `edgeDensity` | exact integer percent 0–100, decoded via `/100` |
| 11 | `checkRequiredFraction` | exact integer percent 0–100 |
| 12 | `boundaryFraction` | exact integer percent 0–100 |
| 13 | `wildernessWaterFraction` | exact integer percent 0–100 |
| 14 | `settlementOutpostFraction` | exact integer percent 0–100 |
| 15 | flags | bit 0 = `generateTerrainZones`; bits 1–7 reserved |
| 16-20 | `biomeMix.forest`, `.swamp`, `.plains`, `.desert`, `.tundra` | fixed-point 0–255 over [0,1] each — `.jungle` derived as `1 - (the other five)` on decode, then all six renormalized to sum to exactly 1 (M4.7.2; same drift-guard pattern as `nodeTypeBias` above) |
| 21 | `placementAlgorithm` | bit 0: 0 = `"grid"`, 1 = `"radial"` (M4.8, Section 7e) |
| 22 | `radialSpokeCount` | raw uint8 (range 1–8 fits) |
| 23 | `radialCoreInterconnectivity` | fixed-point 0–255 over [0,1] |
| 24 | `radialBranchChance` | fixed-point 0–255 over [0,1] |
| 25 | `radialClusterChance` | fixed-point 0–255 over [0,1] |
| 26 | `radialDeadEndPoiBias` | fixed-point 0–255 over [0,1] |
| 27 | `radialConvergenceRadius` | fixed-point ×10 over [0, 25.5] grid units |
| 28 | `radialInwardWeight` | exact integer percent 0–100 |
| 29 | `radialFalloffExponent` | fixed-point ×10 over [0, 25.5] |
| 30 | `radialJitter` | exact integer percent 0–100 |
| 31 | `radialRimFraction` | exact integer percent 0–100 |
| 32 | `radialClusterMaxSize` | raw uint8 |
| 33 | `radialClusterSpread` | exact integer percent 0–100 |
| 34 | `maxLargeSettlements` | raw uint8 |
| 35 | `roadFraction` | exact integer percent 0–100 |
| 36 | `coastalChance` | exact integer percent 0–100 |
| 37 | `interiorBoundaryDamping` | exact integer percent 0–100 |
| 38 | `wildernessCheckMultiplier` | exact integer percent 0–100 |

Base64url-encoded (`btoa`/`atob` — available identically in modern Node and every current browser, same cross-runtime assumption `crypto.randomUUID()` already relies on — with `+`/`/` swapped to `-`/`_` and `=` padding stripped) → 52 characters. Carried as the `map` query parameter, e.g. `?map=AQIDBAUG...`.

**`PARAMS_CODEC_VERSION 1` through `4`'s decoders stay registered forever** — never delete or repurpose a decoder version once shipped; this is the exact scenario the versioned-registry design exists for. `decodeV1` fills a sensible default (`biomeMix` = the Temperate Mixed region preset's values, Section 7c) for old 15-byte links that predate that field. `v2`→`v3` (M4.7.3) moved `gridCols`/`gridRows` from a single byte's two 4-bit nibbles (max 15 each) to one full byte each — `recommendedGridDimensions(80)` (Section 7d) recommends 18, which no longer fits a nibble. `v3`→`v4` (M4.8) added `placementAlgorithm` + the six radial-only fields; `decodeV1`/`decodeV2`/`decodeV3` all backfill `placementAlgorithm: "grid"` (exact, not a guess — no pre-v4 link could have been anything else) plus the radial defaults from Section 7e's table. `v4`→`v5` (M4.9) appended the eleven fine-tuning params, each backfilled by the older decoders with exactly the value that behavior was previously hardcoded to — so an old link still regenerates its original map. Only the current encoder (`encodeV5`) is ever produced going forward; `encodeV1`/`encodeV2`/`encodeV3` are gone (unused once superseded), though `encodeV3` stays as `encodeV4`'s internal building block (it reuses v3's byte 1-20 layout verbatim).

**Why the five single-slider fractions (`edgeDensity`, `checkRequiredFraction`, `boundaryFraction`, `wildernessWaterFraction`, `settlementOutpostFraction`) use exact integer percent, not generic fixed-point:** the Generation Panel's sliders (Section 11, View B) only ever produce `v/100` for integer `v` 0–100 before committing to `draftParams`. Encoding the integer and decoding via `/100` reconstructs the *exact* float the UI produced — zero precision loss, and no risk of an encoding epsilon flipping one of the many `rng() < fraction` comparisons the generator makes per node/edge. `nodeTypeBias` and `biomeMix` don't get the same treatment because `rebalanceShares`'s proportional rescale produces non-round floats regardless of encoding scheme — lower-stakes anyway, since `nodeTypeBias` only ever feeds a `Math.round(nodeCount × share)` budget calculation (Section 7) and `biomeMix` only ever feeds a weighted pick, neither a raw per-node RNG *comparison* the way the five percent fields do.

### Versioning

`PARAMS_CODEC_VERSION` is a small integer, **not** the same thing as `ALGORITHM_VERSION` (Section 4) — one tracks the encoded byte layout, the other the generator's RNG call sequence. They'll often bump together in practice (a `GenerationParams` shape change tends to trigger both) but are conceptually separate. `decodeParams` keeps a version-keyed decoder registry so every shipped codec version stays decodable — the same "never break an old meaning" discipline `ALGORITHM_VERSION` already follows.

### Load precedence

On app load: **URL share code (if present and valid) → `overworld-current` localStorage restore → prototype-map default.** A share code that fails to decode (malformed, or a `PARAMS_CODEC_VERSION` this build doesn't recognize) falls through the same chain silently (logged, not shown to the user — no banner in this pass; see Section 16, M4.7.1's note on scope).

A hand-edited map's share link reproduces its *origin* generated state, not any subsequent edits — the same limitation `SavedEntry`/library reload already has (Section 3a: `params` records provenance, not a live description of the current node/edge list).

### URL sync

`generate()` and `loadMap()` both update the address bar via `history.replaceState` (never `pushState` — a shared link must not spam browser back/forward history) so the current map is always reflected. So does the very first module load: `writeShareCodeToUrl` runs once immediately after `resolveInitialMap()` resolves the initial map (whichever of the three precedence sources it came from), not only after a subsequent `generate()`/`loadMap()` call — so a plain page visit (no `?map=` yet, e.g. a localStorage restore or the prototype default) still leaves a copy-able, reproduce-this-exact-map link in the bar immediately, and pasting an old-codec-version share code gets silently upgraded to the current codec's encoding of those same decoded params. This is a single `history.replaceState` call at module-load time (never a navigation, and nothing re-triggers it), so it cannot create a refresh loop. A "Copy Link" button (Section 11, View B) copies `window.location.href` directly.

---

## 14. File Structure

The repo has two top-level packages: `frontend/` (the React/Vite app) and `backend/` (the AWS Lambda + SAM template). They share nothing at runtime — the backend is a separate deployable. The `src/core/` functions are the only code that would logically live in both; for now they are duplicated into `backend/src/core/` to keep the Lambda self-contained. If this becomes a maintenance burden, extract to a shared package.

```
/
├── frontend/                       # React + Vite app — deployed to Netlify
│   ├── src/
│   │   ├── types/
│   │   │   ├── map.ts              # Core types
│   │   │   └── extensions.ts      # Extension types
│   │   ├── core/                  # Layer 1 — pure functions (browser build)
│   │   │   ├── rng.ts
│   │   │   ├── compass.ts
│   │   │   ├── graph.ts
│   │   │   ├── generationShared.ts # shared by generator.ts and radialGenerator.ts — NOT used directly post-M7 either
│   │   │   ├── generator.ts       # NOT used directly — calls API instead
│   │   │   ├── radialGenerator.ts # NOT used directly — calls API instead
│   │   │   ├── validator.ts
│   │   │   ├── exporter.ts
│   │   │   └── names.ts
│   │   ├── store/                 # Layer 2 — Zustand state
│   │   │   ├── mapStore.ts
│   │   │   └── libraryStore.ts
│   │   ├── components/            # Layer 3 — React UI
│   │   │   ├── canvas/
│   │   │   │   ├── MapCanvas.tsx
│   │   │   │   ├── NodeShape.tsx
│   │   │   │   ├── EdgeLine.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── panels/
│   │   │   │   ├── NodePanel.tsx
│   │   │   │   ├── EdgePanel.tsx
│   │   │   │   ├── GeneratePanel.tsx
│   │   │   │   └── LibraryPanel.tsx
│   │   │   ├── modals/
│   │   │   │   └── ReferenceTableModal.tsx
│   │   │   ├── toolbar/
│   │   │   │   └── Toolbar.tsx
│   │   │   └── shared/
│   │   │       ├── DirectionPicker.tsx
│   │   │       └── NodeTypeSelect.tsx
│   │   ├── api/
│   │   │   └── mapApi.ts          # fetch wrapper — all API calls go through here
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   └── core/
│   │       ├── rng.test.ts
│   │       ├── compass.test.ts
│   │       ├── graph.test.ts
│   │       ├── generator.test.ts  # runs against backend via local SAM or mocked
│   │       ├── validator.test.ts
│   │       └── exporter.test.ts
│   ├── .env.example               # VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
│   ├── netlify.toml
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                       # AWS Lambda — deployed via SAM
│   ├── src/
│   │   ├── lambda/
│   │   │   └── generate.ts        # Lambda handler — thin, calls generateMap()
│   │   ├── types/
│   │   │   └── map.ts             # Same types as frontend — duplicated intentionally
│   │   └── core/                  # Same core functions — duplicated intentionally
│   │       ├── rng.ts
│   │       ├── compass.ts
│   │       ├── graph.ts
│   │       ├── generationShared.ts
│   │       ├── generator.ts
│   │       ├── radialGenerator.ts
│   │       ├── validator.ts
│   │       └── names.ts
│   ├── template.yaml              # SAM template — Lambda + API Gateway definition
│   ├── samconfig.toml             # SAM deploy config (generated on first deploy)
│   └── package.json
│
├── docs/
│   ├── overworld-map-concept.md
│   ├── overworld-map-app-spec-v2.md
│   ├── node-reference.md
│   └── overworld-map.html         # Standalone prototype (reference only)
│
├── CHANGELOG.md
└── README.md
```

---

## 14b. Backend — AWS Lambda + SAM

### What lives here

The Lambda receives `GenerationParams` JSON, calls `generateMap()`, and returns `WorldMap` JSON. That's the entire backend. No database, no auth, no sessions.

The purpose is to keep `generateMap()` and the `core/` functions out of the browser bundle so they are not visible to end users via devtools.

### SAM Template (`backend/template.yaml`)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs22.x
    Timeout: 10
    MemorySize: 256
  HttpApi:
    CorsConfiguration:
      AllowOrigins:
        - "https://your-app.netlify.app"   # update before production deploy
        - "http://localhost:5173"           # Vite dev server
      AllowMethods:
        - POST
        - OPTIONS
      AllowHeaders:
        - Content-Type

Resources:
  GenerateFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda/generate.handler
      CodeUri: ./
      Events:
        Generate:
          Type: HttpApi
          Properties:
            Path: /generate
            Method: post
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Sourcemap: false
        EntryPoints:
          - src/lambda/generate.ts

Outputs:
  ApiUrl:
    Description: API Gateway endpoint
    Value: !Sub "https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com"
```

### Lambda Handler (`backend/src/lambda/generate.ts`)

```ts
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { generateMap } from "../core/generator";
import { validateMap } from "../core/validator";
import type { GenerationParams } from "../types/map";

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const params = JSON.parse(event.body ?? "{}") as GenerationParams;

    // Basic param guard — validator handles structural invariants post-generation
    if (typeof params.seed !== "number") {
      return { statusCode: 400, body: JSON.stringify({ error: "seed required" }) };
    }

    const map = generateMap(params);
    const violations = validateMap(map);

    // Violations are warnings, not errors — return them alongside the map
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map, violations }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid generation parameters" }),
    };
  }
};
```

### Frontend API Client (`frontend/src/api/mapApi.ts`)

All fetch calls go through this file. No component or store calls `fetch()` directly.

```ts
import type { GenerationParams, WorldMap } from "../types/map";
import type { Violation } from "../core/validator";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface GenerateResult {
  map: WorldMap;
  violations: Violation[];
}

export async function generateMapApi(params: GenerationParams): Promise<GenerateResult> {
  const res = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}
```

The store's `generate()` action calls `generateMapApi()` — not `generateMap()` directly. This is the only change to the store's behavior from the original design.

### Environment Variables

**Frontend (`.env.example`):**
```
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```
Set `VITE_API_URL` in Netlify's dashboard under Site settings → Environment variables. The build inlines it at compile time.

**Backend:** No secrets needed for the alpha. If an API key is added later, use AWS Systems Manager Parameter Store — never commit secrets to the SAM template.

---

## 14c. Deployment

### Backend — AWS

**Prerequisites:** AWS CLI configured, SAM CLI installed (`brew install aws-sam-cli` or pip).

**First deploy:**
```bash
cd backend
npm install
sam build
sam deploy --guided
# Prompts: stack name, region, confirm IAM creation, save to samconfig.toml
# Outputs: API Gateway URL — copy this into Netlify env vars
```

**Subsequent deploys:**
```bash
sam build && sam deploy
```

**Local dev (no AWS connection required):**
```bash
sam local start-api
# Runs Lambda locally at http://localhost:3000
# Set VITE_API_URL=http://localhost:3000 in frontend/.env.local
```

**Update the CORS origin** in `template.yaml` to your real Netlify URL before the first production deploy. Redeploy after any CORS change.

### Frontend — Netlify

**`frontend/netlify.toml`:**
```toml
[build]
  base    = "frontend"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

The `[[redirects]]` rule is required for client-side React routing — without it, any direct URL hit returns a 404.

**Deploy steps:**
1. Push repo to GitHub
2. Connect repo to Netlify (New site → Import from Git)
3. Netlify auto-detects `netlify.toml` — no manual build config needed
4. Add `VITE_API_URL` environment variable in Netlify dashboard
5. Trigger a deploy (or push a commit)

Netlify auto-deploys on every push to `main`. Branch deploys (for PRs) work out of the box and get their own preview URL.

### Alpha 0.1 Checklist

Before calling M6 done and tagging `v0.1.0`:

- [ ] `sam build && sam deploy` succeeds with no errors
- [ ] API Gateway URL responds to a POST `/generate` with valid params
- [ ] Netlify build succeeds
- [ ] Netlify app loads and generates a map via the API
- [ ] Same seed produces same map (verified in browser)
- [ ] JSON export round-trips through import cleanly
- [ ] PNG and SVG export produce valid files
- [ ] `VITE_API_URL` is set in Netlify env — not hardcoded anywhere in source
- [ ] CORS origin in `template.yaml` is the real Netlify URL, not `*`
- [ ] `README.md` documents local dev setup for both frontend and backend
- [ ] `CHANGELOG.md` has a `0.1.0` entry

---

## 15. Test Strategy

Use Vitest (bundled with Vite). Run `vitest run` before each milestone handoff.

**`rng.test.ts`**
- `makeRng(seed)` called twice with the same seed produces identical sequences of 1000 values
- `makeRng(seed)` called with two different seeds produces different sequences
- All values from the RNG are in [0, 1)
- `randInt(rng, min, max)` always returns a value in [min, max] inclusive — test across 10,000 calls
- `shuffle` on a known array with a known seed produces the expected permutation (pin the output)

**`compass.test.ts`**
- `oppositeDir` is its own inverse for all 8 directions
- `angleToDir` correctly maps 8 quadrant midpoints
- `dirBetween` is correct for all 8 relative positions (exhaustive)

**`graph.test.ts`**
- `isConnected` true for a path graph, false for a disconnected one
- `hopCount` correct on a known graph
- `freeDirections` never returns a direction already used

**`generator.test.ts`**
- Same seed + params → identical output (run 3 times, compare)
- Node count matches `targetNodeCount` ± 2
- All invariants pass (call `validateMap()` on output, expect empty violations)
- Changing only the seed produces a different map

**`validator.test.ts`**
- Construct maps that violate each invariant individually, expect the right `Violation.rule` returned
- Valid map (the prototype) returns empty array

---

## 16. Milestones

Build in this exact order. Do not skip ahead. Each milestone must pass its acceptance criteria before the next begins.

### M0 — Repo scaffold
Deliverables: monorepo directory structure, `frontend/` Vite+React+TypeScript+Vitest scaffold, `backend/` SAM scaffold with `template.yaml`, `docs/` folder with all spec and reference files, `README.md` with local dev instructions, `.gitignore` covering both packages, `.env.example`

Acceptance: `cd frontend && npm install && npm run dev` starts the Vite dev server with a blank React app. `cd backend && sam build` completes without errors. Repo is committed to GitHub.

### M1 — Core types and pure functions
Deliverables: `frontend/src/types/map.ts`, `frontend/src/types/extensions.ts`, `frontend/src/core/rng.ts`, `frontend/src/core/compass.ts`, `frontend/src/core/graph.ts`

Acceptance: all tests in `rng.test.ts`, `compass.test.ts`, `graph.test.ts` pass — paste `vitest run` output to confirm.

### M2 — Generator and validator
Deliverables: `frontend/src/core/generator.ts`, `frontend/src/core/validator.ts`, `frontend/src/core/names.ts`

Acceptance: `generator.test.ts` and `validator.test.ts` pass. Run a Node script that calls `generateMap()` with default params and prints the node count and edge count — confirm output makes sense before proceeding.

### M3 — Canvas rendering (frontend only, local generator)
Deliverables: `MapCanvas.tsx`, `NodeShape.tsx`, `EdgeLine.tsx`, `Tooltip.tsx`, `mapStore.ts` (calls `generateMap()` directly — API wiring comes in M7)

Acceptance: app renders the prototype 49-node map; pan, zoom, and hover tooltip work; node shapes match spec (circle/square/diamond/ring); edge styles match spec (solid/dashed by connection type).

### M4 — Generation panel and seed system
Deliverables: `GeneratePanel.tsx`, full `mapStore.ts`, `libraryStore.ts`, `frontend/src/core/exporter.ts`

Acceptance: sliders generate a new map; seed input and randomize button work; same seed + params = identical map (verified by generating twice); JSON export round-trips through import cleanly.

### M4.5 — Taxonomy migration (types, boundary markers, validator, prototype, rendering)

Inserted before M5 once M4 revealed the original spec had over-corrected "the generator can place this detail" into "the generator never touches subtype/water/extensions at all." Section 3c is the corrected model; this milestone is the mechanical migration to it — no new generation *variety* yet, just moving the existing mountain-fringe mechanic onto the new `BoundaryMarker` concept and getting every file compiling against the new types.

Deliverables: `frontend/src/types/map.ts` and `types/extensions.ts` rewritten per Section 3a/3b/3c; `core/generator.ts` updated so the old mountain-edge placement logic becomes boundary-marker placement (`mountain_range` reason only, via the renamed `boundaryFraction`) — `nodeTypeBias.mountain`'s old share folds into `wilderness`; `core/validator.ts` invariant 4 generalized (boundary-placement, not mountain-specific); `core/prototypeMap.ts` migrated (every old `mountain`-type node becomes a wilderness node with a `mountain_range` boundary marker); `components/canvas/NodeShape.tsx`/`EdgeLine.tsx` updated for the new shape table and boundary badge (Section 10b); `core/exporter.ts`'s `toSVGString` updated to match; every existing test file updated for the new types/defaults.

Acceptance: full test suite passes against the new types; prototype and freshly-generated maps are visually/structurally equivalent to pre-migration output (mountain fringe still reads the same way, just via a boundary marker); no wilderness/settlement/poi node has a Tier 2 `subtype` set yet by the generator (narrower version of today's status quo — still not this milestone's job); `ALGORITHM_VERSION` bumped to `2.0.0` (breaking data-model change); `npm run build` and `sam build` stay clean.

### M4.6 — Generator gains physical-plausibility capabilities

Deliverables: `core/generator.ts` gains real Tier 2 subtype assignment for all three Tier 1 types — `Biome`/`WaterFeature` via `wildernessWaterFraction`, `CivilianScale`/`OutpostKind` via `settlementOutpostFraction`, `PoiKind` for every poi node — plus `coastal` flag assignment, `sea_route` connection-type assignment, and the optional `generateTerrainZones` step (Section 7, Step 2.5). `core/names.ts` extended with name pools for the new subtypes where a placeholder label benefits from it.

Acceptance: `generator.test.ts` asserts every wilderness/settlement/poi node gets a Tier 2 subtype (never anything deeper — Tier 3+ stays generator-untouched, Section 3c); `sea_route` never appears unless both endpoints are `coastal`; `extensions.terrainZones` is empty when `generateTerrainZones` is false and populated with valid zone data when true (existing extension invariants still hold); `extensions.factions` stays empty regardless — the generator never touches it, not even opt-in; same seed + params still reproduces identical output across every new dimension.

### M4.7 — Visual layers and node shape/color revamp

Inserted once M4.6 made `TerrainZone` data real (via `generateTerrainZones`) and it became clear nothing renders it — Section 10b's full 4-layer visual system (terrain wash, faction territory, edges, nodes) was completely spec'd but Layer 0/1 and the layer-toggle toolbar were never actually assigned to any milestone. This closes that hole, and also revamps node shape/color per Section 10b's updated table (settlement square/diamond in yellow, wilderness circle colored by `Biome` subtype, poi as a purple triangle — colors/shapes above superseding what M3 originally shipped).

Deliverables:
- `core/geometry.ts` — a pure `convexHull(points)` function (and a hull-padding helper for Layer 1's ~12px expansion), used by both the live canvas and `toSVGString` so the two rendering paths share one implementation
- `components/canvas/TerrainWash.tsx` (Layer 0) and `components/canvas/FactionTerritory.tsx` (Layer 1), rendered in `MapCanvas.tsx` beneath the existing edges/nodes layers
- `components/toolbar/Toolbar.tsx` — the four-button layer toggle from Section 10b, wired to local UI-only visibility state (never `WorldMap` data — toggling must not touch the store)
- `NodeShape.tsx` and `exporter.ts`'s `toSVGString` updated in lockstep for the new shape/color table

Acceptance: a map generated with `generateTerrainZones: true` shows colored terrain washes on the canvas immediately; importing a hand-authored `WorldMap` JSON with `extensions.factions` populated shows faction borders (no Faction *editor* exists yet — this only needs to prove the render path works via import, per `GeneratePanel`'s existing Import JSON); toolbar buttons for Terrain/Factions are greyed out with a tooltip when that extension is empty; toggling a layer never mutates the map (undo stack unaffected); `toSVGString` output includes the same terrain wash / faction territory elements as the live canvas for the same map; new node shapes/colors match Section 10b exactly, including the plains-vs-settlement yellow distinction.

### M4.7.1 — Shareable map links

Deliverables: `core/shareCode.ts` (`encodeParams`/`decodeParams` per Section 13b's byte layout, `PARAMS_CODEC_VERSION`), `store/mapStore.ts` updated (`resolveInitialMap`'s URL → localStorage → prototype-map precedence, `generate()`/`loadMap()` both call `history.replaceState` via a `writeShareCodeToUrl` helper), a "Copy Link" button in `GeneratePanel.tsx`.

Acceptance: generating a map updates the address bar with a `?map=...` share code; opening that URL fresh (or pasting it into a new tab) reproduces the identical map; Copy Link copies the current address bar URL to the clipboard; a malformed or unrecognized-version share code falls through silently to the existing localStorage/prototype-map chain (no crash, no user-facing error — that banner is explicitly deferred); `shareCode.test.ts` covers round-trip correctness (exact for seed/targetNodeCount/gridCols/gridRows/flags/the five integer-percent fraction fields, epsilon-bounded and sum-to-1 for `nodeTypeBias`) and rejects malformed/unsupported-version input without throwing.

### M4.7.2 — Macro region presets for biome coherence

Deliverables: `core/regionPresets.ts` (six named presets per Section 7c); `types/map.ts`'s `GenerationParams.biomeMix` (new field); `core/generator.ts`'s wilderness land-branch subtype pick reworked from a flat uniform `randPick` to a weighted pick against `biomeMix` (`ALGORITHM_VERSION` → `2.1.0`); `core/shareCode.ts`'s `PARAMS_CODEC_VERSION` → `2` (new `encodeV2`/`decodeV2`, `decodeV1` updated to fill a default `biomeMix` rather than left alone); `store/mapStore.ts`'s `rebalanceNodeTypeBias` generalized to `rebalanceShares` (now also driving the six new biome sliders) plus new `applyRegionPreset`/`randomizeRegionPreset` actions; `GeneratePanel.tsx` gains six biome sliders, a Region Preset select, and a Randomize Region button.

Acceptance: a map generated with the Frost preset never places a `jungle` node (its `biomeMix.jungle` is exactly 0) across many seeds; the Region Preset select loads a preset's exact values into the sliders in one action, and manually dragging any biome slider afterward just changes `biomeMix` with no separate "custom mode" to fall in or out of; a share code decodes `biomeMix` correctly under `PARAMS_CODEC_VERSION 2`, and an old `PARAMS_CODEC_VERSION 1` code (predating `biomeMix`) still decodes successfully with a sensible default rather than failing; `rebalanceShares` produces identical behavior to the old `rebalanceNodeTypeBias` for the 3-key case (regression) and correctly renormalizes the 6-key `biomeMix` case; visually verified via the same headless-Chrome-screenshot approach as M4.7 (see `CLAUDE.md`) — a Frost-preset map should visibly read as tundra-dominant.

### M4.7.3 — Grid sizing scaled to node count

Deliverables: `core/geometry.ts`'s `recommendedGridDimensions(targetNodeCount)` (Section 7d); `core/generator.ts`'s fixed `CANDIDATE_RADIUS` replaced with a density-aware `candidateRadiusFor(params)` (`ALGORITHM_VERSION` → `2.1.2`); `store/mapStore.ts`'s `applyRecommendedGridSize` action and a `DEFAULT_GENERATION_PARAMS.gridCols`/`gridRows` computed from it (14×14 at the default 49-node target, replacing the old fixed 10×8); `GeneratePanel.tsx` gains an "Auto-size grid" button and widened Grid cols/rows slider bounds (6–20). Widening the grid range past 15 broke `core/shareCode.ts`'s v1/v2 nibble-packed `gridCols`/`gridRows` byte (4 bits each, max 15) — discovered while implementing, not planned up front — so `PARAMS_CODEC_VERSION` also bumped to `3` (Section 13b): `gridCols`/`gridRows` each get a full byte now; `decodeV1`/`decodeV2` stay registered for old links, `encodeV1`/`encodeV2` themselves were removed as genuinely dead code once `encodeParams` moved to `encodeV3`.

Acceptance: `recommendedGridDimensions(49)` returns `{ gridCols: 14, gridRows: 14 }` (the milestone's own worked example); the pre-existing 49-node/10×8 combination generates a bit-identical map to before this change (regression — guards the `CANDIDATE_RADIUS` recalibration); a map generated at the new 14×14 default (and an 18×18/80-node case) still passes all validator invariants across several seeds; an 18×18-grid share code round-trips exactly under codec v3 (regression — this is exactly the case v1/v2 couldn't represent); a hand-built v2 payload still decodes correctly (regression, mirroring the existing v1 one); visually verified via the same headless-Chrome-screenshot approach as M4.7/M4.7.2 — the new default should read as visibly less clustered than the old 10×8 default, without empty-looking dead space. Explicitly out of scope: any change to `ensureMinimumDegree`/`bestAvailableDirection`'s direction-fallback logic — this mitigates tight local clusters statistically, it doesn't prevent them.

### M4.8 — Radial (core-out) generation algorithm

Deliverables: `types/map.ts`'s `PlacementAlgorithm`/`GenerationParams.placementAlgorithm` + six new `radial*` fields (Section 7e); `core/generationShared.ts` (new) — classification/connection-type/direction-degree/connectivity-repair logic extracted from `core/generator.ts` so both placement algorithms share one implementation; `core/radialGenerator.ts` (new) — `generateRadial`, implementing the spoke/ring/convergence skeleton plus `radialBranchChance`/`radialClusterChance`/`radialDeadEndPoiBias`; `core/generator.ts`'s `generateMap` dispatches on `placementAlgorithm` and stamps radial's derived grid size back onto the returned map's `params` (`ALGORITHM_VERSION` → `2.2.0`); `core/geometry.ts`'s `recommendedRadialGridDimensions`; `core/shareCode.ts`'s `PARAMS_CODEC_VERSION` → `4` (`encodeV4`/`decodeV4`, `decodeV1`/`decodeV2`/`decodeV3` updated to backfill `placementAlgorithm: "grid"` + radial defaults); `GeneratePanel.tsx` gains a "Generation style" selector, a conditional Grid cols/rows vs. read-only derived-size display, and a "Radial shape" slider section shown only for radial.

Acceptance: `generateMap` with `placementAlgorithm: "radial"` produces a `WorldMap` that passes every validator invariant across a range of seeds, spoke counts, and node counts; the core settlement sits at the exact, unjittered grid center every time; `map.params.gridCols`/`gridRows` reflect the derived size, not whatever was passed in; higher `radialCoreInterconnectivity`/`radialBranchChance`/`radialClusterChance` each produce measurably more edges/nodes on average across seeds than their lowest setting; `radialDeadEndPoiBias: 1` reliably retypes a constructed true-dead-end node to `poi` while `radialDeadEndPoiBias: 0` reliably leaves it alone; an old (pre-M4.8) share code still decodes with `placementAlgorithm: "grid"` and sensible radial defaults; visually verified via headless-Chrome screenshot across several spoke counts/variant settings/node counts (20–80) — spokes read as visually recognizable, interconnectivity visibly tapers outward, and each variant's effect is visible when pushed to its extreme. Explicitly out of scope: `waviness` (a fourth considered flavor variant, deferred) and any change to the grid algorithm's own behavior or output (verified unchanged for existing seeds/params).

### M5 — Edit panels
Deliverables: `NodePanel.tsx`, `EdgePanel.tsx`, `DirectionPicker.tsx`, `NodeTypeSelect.tsx`

Acceptance: can rename a node inline, change its type, add an edge via direction picker, delete a node with confirmation; undo/redo works across at least 5 operations; validator violations surface in the UI.

**Note (added after M4.5/M4.6 were inserted):** "change its type" now means the full Tier 1 + Tier 1.5 fork + Tier 2 subtype + optional `BoundaryMarker` — not just a bare `NodeType` dropdown. This closes the gap flagged earlier in the project (Section 11's View C never actually specified a subtype/boundary editing surface). Confirm the exact control layout when M5 starts; not designed yet.

### M6 — Library and export
Deliverables: `LibraryPanel.tsx`, `ReferenceTableModal.tsx`, PNG/SVG/Markdown export

Acceptance: can save a map to library, reload it, and get identical output; reference table matches `node-reference.md` format; PNG export is crisp at 2× resolution; SVG opens correctly in a browser.

### M7 — Backend wiring and alpha deploy
Deliverables: `backend/src/core/` (copy of frontend core), `backend/src/lambda/generate.ts`, `frontend/src/api/mapApi.ts`, `frontend/netlify.toml`, updated `mapStore.ts` (calls API instead of local generator)

Acceptance: all items on the Alpha 0.1 Checklist in Section 14c pass. Tag the commit `v0.1.0`.

---

## 17. Starting Prompts for Claude Code

Use these prompts in order. Each is pasted at the start of the relevant milestone session.

---

### M0 Prompt — Repo scaffold

```
Read docs/overworld-map-app-spec-v2.md in full before doing anything.
Then read docs/overworld-map-concept.md.

We are building milestone M0: the repo scaffold.

M0 deliverables:
  - frontend/ — Vite + React + TypeScript + Vitest, no content yet
  - backend/ — SAM scaffold with template.yaml as specified in Section 14b
  - docs/ — copy all spec/reference files here (already exist)
  - README.md — local dev instructions for both frontend and backend
  - .gitignore — covers node_modules, dist, .env, .aws-sam, samconfig.toml
  - frontend/.env.example — with VITE_API_URL placeholder

Rules:
- Do not write any application logic during M0 — scaffold only
- frontend/src/ should contain only App.tsx and main.tsx with a placeholder div
- backend/src/ should contain only a placeholder generate.ts with a stub handler
- Run `cd frontend && npm run build` — must succeed with no errors
- Run `cd backend && sam build` — must succeed with no errors
- If any scaffold decision is ambiguous, ask before deciding

When both builds pass, list the created files and wait for confirmation before M1.
```

---

### M1 Prompt — Core types and pure functions

```
We are building milestone M1. The scaffold from M0 is in place.

M1 deliverables:
  frontend/src/types/map.ts
  frontend/src/types/extensions.ts
  frontend/src/core/rng.ts
  frontend/src/core/compass.ts
  frontend/src/core/graph.ts
  frontend/tests/core/rng.test.ts
  frontend/tests/core/compass.test.ts
  frontend/tests/core/graph.test.ts

Rules:
- Install seedrandom: `cd frontend && npm install seedrandom @types/seedrandom`
- Every function in src/core/ must be pure — the only external import permitted is seedrandom, in rng.ts only
- Do not write generator.ts, any store files, or any React components during M1
- Do not use Math.random() anywhere in src/core/
- Run `cd frontend && npx vitest run` — paste the full output
- If the spec is ambiguous, ask before deciding

Wait for confirmation before starting M2.
```

---

### M2–M6 Prompt Template

```
We are building milestone M[N]. Previous milestones are complete and passing.

Refer to Section 16 of the spec for M[N] deliverables and acceptance criteria.

Rules:
- Stay within the files listed for this milestone — do not reach ahead
- Run the relevant tests before declaring the milestone done
- If any decision isn't covered by the spec, ask

Wait for confirmation before starting M[N+1].
```

---

### M7 Prompt — Backend wiring and alpha deploy

```
We are building milestone M7: the final wiring to AWS and Netlify.

M7 deliverables:
  backend/src/core/   — copy of frontend/src/core/ (generator must be identical)
  backend/src/types/  — copy of frontend/src/types/map.ts
  backend/src/lambda/generate.ts  — as specified in Section 14b
  frontend/src/api/mapApi.ts      — as specified in Section 14b
  frontend/netlify.toml           — as specified in Section 14c
  Updated mapStore.ts             — generate() calls generateMapApi() not generateMap()

Deployment steps:
1. cd backend && sam build && sam deploy --guided
2. Copy the output API Gateway URL
3. Set VITE_API_URL in Netlify dashboard
4. Push to GitHub — Netlify deploys automatically

Work through the Alpha 0.1 Checklist in Section 14c item by item.
Do not tag v0.1.0 until every checklist item passes.
```

---

## 18. Prototype Reference Data

`node-reference.md` contains the 49-node hand-verified example map. Use it as:

- **Test fixture** in `generator.test.ts` and `validator.test.ts` — the prototype map must pass all invariants
- **Demo map** shown on first launch before any generation
- **Visual baseline** — the SVG rendered from this data should match `overworld-map.html` closely

Import format: parse the markdown table, assign sequential UUIDs, set `gx`/`gy` from the original grid positions.
