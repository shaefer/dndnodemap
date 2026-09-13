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
  generator.ts    # Map generation — orchestrates the above
  validator.ts    # Invariant checks — returns violations, never throws
  exporter.ts     # toJSON(), toMarkdown(), toSVGString()
  names.ts        # Static name lists by node type
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
```

### 3b. Extension Types (`src/types/extensions.ts`)

**The generator never reads or writes these types.** The validator never requires them. The renderer draws them when present and ignores them when absent. The UI shows extension panels only when the map's `extensions` object contains data.

The `MapExtensions` container lives on `WorldMap` so extensions round-trip cleanly through JSON export without any migration logic.

```ts
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
```

**Extension invariants (checked by validator, warnings only — not blocking):**
- Every `nodeId` in a `TerrainZone` or `Faction` must reference a node that exists in `WorldMap.nodes`
- Every `edgeId` in an `EdgeTerrainTag` must reference an edge that exists in `WorldMap.edges`
- A node should belong to at most one `Faction` (warn if duplicated)
- A node may belong to multiple `TerrainZone`s (zones can overlap — valid)

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

**Seed format:** Seeds are 32-bit unsigned integers (0–4294967295). The UI generates a random seed via `Math.floor(Math.random() * 4294967296)` on first load and on "Randomize" — this is the only legitimate use of `Math.random()` in the app.

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

- Create a `gridCols × gridRows` logical grid
- Divide the grid into spatial zones:
  - **Center zone** (inner 50% by area): eligible for settlements, wilderness, ruins
  - **Mid zone** (next ring out): eligible for wilderness, ruins, some mountain
  - **Edge zone** (outer 1–2 rows/cols): eligible for mountain and a few wilderness
- Fill zones by drawing from `nodeTypeBias` weights, but constrain each type to its eligible zones
- Apply jitter: add `(rng() - 0.5) * 0.5` to each placed node's `gx` and `gy`
- Generate placeholder label: `"Settlement-1"`, `"Wilderness-3"`, etc.

### Step 2 — `buildEdges(nodes, params, rng): MapEdge[]`

For each node A, find candidate neighbors within `1.6 * cellSize` radius. For each candidate B:
1. Compute direction via `dirBetween()`
2. Skip if direction already used from A
3. Skip if edge A↔B already exists (check both directions)
4. Skip if either node already has more than `targetDegree` exits
   - `targetDegree` = `2 + Math.round(params.edgeDensity * 4)` → range 2–6
5. Add edge with probability weighted by distance (closer = more likely)
6. Assign `connectionType` based on node types at each end:
   - mountain–mountain or mountain–wilderness: `"pass"`
   - settlement–settlement or settlement–wilderness: `"road"` (50% probability) or `"trail"`
   - water–any: `"river_ford"` (generator never places sea_route or seasonal — those are user-set)
   - all others: `"trail"`
7. Generator never sets: `travelDays`, `subtype`, `factionId`, or any extension data

After initial pass, run `isConnected()`. If false, run a connectivity repair pass:
- Find isolated clusters
- For each isolated cluster, find the nearest node in the main cluster and add a bridging edge in the correct compass direction (or closest available direction if exact is taken)

### Step 3 — `markCheckRequired(nodes, edges, params, rng): MapEdge[]`

Returns a new edges array (do not mutate). Mark an edge `checkRequired = true` if:
- Both nodes are `mountain` type, OR
- One node is `mountain` and one is `wilderness` AND `rng() < params.checkRequiredFraction`, OR
- Neither node is mountain AND `rng() < params.checkRequiredFraction * 0.2` (rare dramatic routes)

After marking, enforce constraint: every node must have at least one edge where `checkRequired = false`. If a node's only edges are all check-required, unmark the one with the lowest-difficulty neighbor.

### Step 4 — `assignCheckTypes(edges, rng): MapEdge[]`

For each `checkRequired` edge, assign a `checkType` string based on `connectionType`:
- `"pass"` (mountain): `"Athletics DC ${randInt(rng, 14, 18)}"`
- `"river_ford"`: `"Athletics DC ${randInt(rng, 10, 14)}"`
- `"trail"` in difficult terrain: `"Survival DC ${randInt(rng, 10, 14)}"`
- `"road"` (rare — washed out, broken): `"Athletics DC ${randInt(rng, 8, 12)}"`

### Step 5 — Assemble `WorldMap`

```ts
return {
  id: crypto.randomUUID(),
  name: "Unnamed Region",
  nodes,
  edges,
  extensions: {},   // always empty from generator — user populates via extension layer UI
  params,
  algorithmVersion: ALGORITHM_VERSION,  // imported constant "1.0.0"
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
```

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
4. **Mountain placement** — no mountain node has `gx` and `gy` both in the inner 40% of the grid
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
hills    → brown  (#7A5C3A @ 0.12)
tundra   → gray   (#888780 @ 0.12)
coast    → teal   (#0F6E56 @ 0.12)
jungle   → green  (#27500A @ 0.18)
lake     → blue   (#185FA5 @ 0.15)
ocean    → blue   (#042C53 @ 0.18)
```

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
Always visible. Node type determines shape; `water` nodes get a new shape:
```
settlement → filled circle, large (r=11)
wilderness → filled circle, small (r=7)
mountain   → filled square (rx=2)
ruin       → filled diamond
water      → filled circle with inner ring (r=9, inner ring r=5, 1px stroke)
             — the ring visually signals "this is a feature, not a settlement"
```

### Layer toggle UI

Toolbar area gets four small toggle buttons, always visible:
```
[≡ Edges] [◉ Nodes] [⬡ Terrain] [⚑ Factions]
```
Edges and Nodes are always on (buttons shown but disabled/locked). Terrain and Factions are off by default, clickable. When a layer has no data (extensions are empty), the button is greyed out with a tooltip "No terrain zones defined yet."

---

## 11. UI Views

### View A — Map Canvas
- Full-height SVG render of the current map
- Pan (drag), zoom (scroll/pinch), hover tooltip (exits list), click to select node or edge
- Double-click empty space → add node at that position
- Drag node to reposition (updates gx/gy, triggers re-layout of connected edge labels)
- Selected node/edge gets a highlight ring

### View B — Generation Panel (sidebar, not modal)
Controls that update a `draft: GenerationParams` in local state. Generate button commits and calls the store.

| Control | Type | Range | Default |
|---------|------|-------|---------|
| Node count | Slider | 20–80 | 49 |
| Grid cols | Slider | 6–14 | 10 |
| Grid rows | Slider | 5–12 | 8 |
| Settlements | Slider | 0–100% | 18% |
| Wilderness | Slider | 0–100% | 45% |
| Mountain | Slider | 0–100% | 22% |
| Ruins | Slider | 0–100% | 15% |
| Edge density | Slider | Sparse→Dense | 50% |
| Difficulty | Slider | Easy→Hard | 25% |
| Mountain containment | Slider | Open→Closed | 70% |
| Seed | Number input | 0–4294967295 | random on load |
| Randomize seed | Button | — | — |

The four node type sliders must normalize to sum to 1.0 on change — when one moves, the others scale proportionally to compensate. Show the actual percentage next to each slider.

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

On app load: if `overworld-current` exists and its `algorithmVersion` matches the current version, restore it. If the version differs, show a banner: "This map was generated with an older algorithm version. It can still be edited but cannot be re-generated with the same seed."

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
│   │   │   ├── generator.ts       # NOT used directly — calls API instead
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
│   │       ├── generator.ts
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

### M5 — Edit panels
Deliverables: `NodePanel.tsx`, `EdgePanel.tsx`, `DirectionPicker.tsx`, `NodeTypeSelect.tsx`

Acceptance: can rename a node inline, change its type, add an edge via direction picker, delete a node with confirmation; undo/redo works across at least 5 operations; validator violations surface in the UI.

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
