# CLAUDE.md

Guidance for Claude Code when working in this repository. Read this file first on every session — it is the entry point. It does not restate what the other project documents already say; it tells you how to use them and how to work here.

## What This Project Is

Overworld Node Map is a web app for generating, editing, and exporting node-graph overworld maps for tabletop RPGs. Locations are nodes; routes between them are compass-direction edges (N/NE/E/SE/S/SW/W/NW), some of which require a skill check to pass. There are no coordinates and no real scale — the graph *is* the map. Full rationale, the MUD/hex-map inspiration, the node-type taxonomy, and the generation-to-edit design arc live in [docs/overworld-map-concept.md](docs/overworld-map-concept.md) — read it once for the "why" before touching code that shapes user-facing behavior.

## Source Documents — Read in This Order

1. **[docs/overworld-map-concept.md](docs/overworld-map-concept.md)** — the vision. Why this tool exists, how travel and node types work, what the extension layer is for. Start here to understand intent.
2. **[docs/overworld-map-app-spec-v2.md](docs/overworld-map-app-spec-v2.md)** — the technical single source of truth. Types, architectural contract, generator algorithm, invariants, UI views, state shape, file structure, backend/deploy design, test strategy, and milestone order. **Read this in full before writing any code.** When it doesn't cover a decision, stop and ask — don't invent. Any architectural decision made without asking must be undone.
3. **[docs/node-reference.md](docs/node-reference.md)** — a hand-verified 49-node example map. This is a test fixture and demo dataset, not a design document.
4. **[docs/overworld-map.html](docs/overworld-map.html)** — a single-file prototype. It's a visual reference for what the rendered output should look like (pan/zoom/hover, PNG/SVG export) — **not** an architectural reference. The real implementation comes entirely from the spec, not from this file's code.

## Repo Layout

This is a two-package monorepo (spec Section 14):

```
frontend/   React + Vite app — deployed to Netlify
backend/    AWS Lambda + API Gateway (SAM) — deployed to AWS
docs/       Concept doc, spec, reference data, prototype
```

They don't share a runtime or a build — the backend is a separate deployable hit over HTTP. See the milestone map in Section 16 of the spec: M0–M6 build the frontend against a **local** `generateMap()` call; M7 is the only milestone that touches `backend/` and rewires the frontend to call it via `frontend/src/api/mapApi.ts` instead.

## Architecture — Why the Layers Are Shaped This Way

The spec (Section 2) defines three strict layers inside `frontend/src/`: **Core** (`core/`), **Store** (`store/`), **UI** (`components/`). The boundary rules there are absolute — treat a violation as a bug. This section explains the reasoning so the boundary stays meaningful as the app grows, including why a fourth piece (the backend) exists at all:

**Core must stay deployment-target-agnostic.** Everything in `core/` (RNG, compass math, graph algorithms, the generator, the validator, the exporter) is pure, side-effect-free, and touches nothing browser-specific — no DOM, no `localStorage`, no `window`. That's not just a testability nicety: it's what let this same code get duplicated into `backend/src/core/` and run unchanged inside a Lambda (Node runtime) with zero modification. Keep it that way even when it would be more convenient to reach for a browser API from inside `core/`.
  - Concretely: `crypto.randomUUID()` and `seedrandom` are fine — both work identically in modern Node and browsers. Anything that only exists in one runtime does not belong in `core/`.

**Why hide the core behind a Lambda at all?** So the generation algorithm — the placement weights, the edge-building heuristics, the name lists — isn't sitting in the browser bundle for anyone to open devtools and read. This hides the *algorithm*, not the output: the `WorldMap` JSON shape, the validator's invariants, and the exporter all still ship client-side (they need to, for editing and export to work offline-ish). Calibrate expectations accordingly — it raises the bar, it doesn't make the generator secret in an absolute sense.

**`backend/src/core/` is an intentional duplicate, not a shared package — for now.** The spec (Section 14) is explicit that this is deliberate short-term duplication to keep the Lambda self-contained, with an explicit escape hatch: if keeping the two copies in sync becomes a burden, extract to a shared workspace package. Until that happens: `generator.ts`, `rng.ts`, `names.ts`, `validator.ts`, `compass.ts`, and `graph.ts` in `backend/src/core/` must mirror `frontend/src/core/` exactly, and `ALGORITHM_VERSION` must match across both. After M7, `frontend/src/core/generator.ts` (and `rng.ts`/`names.ts`) become dead code paths in the running app — the store calls the API instead — but they stay in the tree; don't delete them as "unused."

**Store is the client-specific seam.** `frontend/src/store/` is where browser concerns actually live: `localStorage` persistence, undo/redo history, selection state, orchestrating calls into `core/` (M0–M6) or the API client (M7+). This is deliberately the *only* layer that changes when generation moves off the client — swapping a direct `generateMap()` call for `generateMapApi()`. Core wouldn't change. UI wouldn't change. That's the point of drawing the line here.

**UI is a pure function of Store state.** `frontend/src/components/` renders what the store gives it and dispatches actions back into it. It never calls `core/` directly and never derives map data inline — that logic belongs in a store selector or in `core/` itself. The "node reference" (the `WorldMap` object) is the one source of truth the UI observes; components stay simple because they're not carrying business logic.

Keep functions in `core/` small, pure, and independently testable — same inputs, same outputs, no hidden state, randomness only via an injected `RngFn`. This is what makes the generator's pieces (placement, edge-building, check-marking) reusable and safe to recompose later, and it's what makes the Lambda-portability story above actually true rather than aspirational.

## Tech Stack

- **Vite + React + TypeScript** — `frontend/`, app shell and UI
- **Zustand** — store layer (`frontend/src/store/`)
- **Vitest** — test runner (`frontend/`); this project is test-driven — see below
- **seedrandom** — the only permitted RNG source in `core/`; no custom PRNG, no bare `Math.random()` anywhere except the one exception the spec calls out (initial/randomized seed value in the UI)
- **AWS SAM + Lambda (Node.js) + API Gateway** — `backend/`, wired up in M7 only
- **Netlify** — frontend hosting, auto-deploy from `main`

## Local Environment Notes (this machine)

- **Node/npm via nvm** — `~/.zshrc` sources `~/.nvm/nvm.sh`. If a shell reports `node: command not found`, that line is missing — see `README.md`.
- **AWS SAM CLI** — no Homebrew on this machine, so it's installed via `pip3 install --user aws-sam-cli`. The `sam` binary lives in `~/Library/Python/3.9/bin`, which must be on `PATH`.
- **esbuild** — SAM's esbuild build method requires an `esbuild` binary reachable on `PATH` (a local devDependency alone isn't enough); it's installed globally via `npm install -g esbuild`.
- Claude's own shell (the Bash tool) does not auto-source `~/.zshrc` even when it exists (non-interactive shells don't) — commands that need `node`/`npm`/`sam` source nvm and extend `PATH` inline per command.

## Development Workflow

- **Test-driven.** Every `core/` function gets unit tests alongside it (see spec Section 15 for what each test file must cover). Don't consider a function done until its tests exist and pass.
- **Build in milestone order** (spec Section 16: M0 → M7). Don't start a milestone before the previous one's acceptance criteria pass. Each milestone must leave the app in a working, runnable state.
- Run `cd frontend && npm test` (vitest) before declaring any milestone complete and show the output.
- Favor small, independent, composable pure functions over classes or deep inheritance — this is what the spec's generator design and the reusability goal (especially around the "random" generation logic) depend on. Don't introduce an abstraction until a second real use case needs it.
- No speculative features, no unrequested refactors, no half-finished edit paths. If the spec's editing UI is "intentionally basic" for a milestone (see concept doc's Generation-to-Edit Arc), build it basic — don't gold-plate ahead of schedule.

## Repository State

Git is initialized locally as of M0. Whether/when to create a **remote** GitHub repo and push is a separate decision from local commits — local commits are low-risk and expected per the milestone flow; creating a remote and pushing code is a shared/external action and should be confirmed explicitly before it happens, including repo visibility (public/private) and which GitHub account.

## Current Status

M0–M4.6 complete. `frontend/` builds, 76 tests pass. `backend/` builds via `sam build`. The app has a working sidebar `GeneratePanel` (all sliders including the M4.6 Tier 1.5 fork controls, seed + randomize, Generate button, JSON download/import) driving `MapCanvas`. Not yet visually verified in a browser by Claude (no browser-automation tool available in this environment) — dev server confirmed to serve without errors after every change so far, but the interactive parts need a manual check before treating any milestone as fully signed off.

**M4.5 and M4.6 are both done.** `NodeType` is `settlement | wilderness | poi`; the generator now places a full Tier 2 subtype on every node (biome/water feature, civilian scale/outpost kind, poi kind), assigns `coastal` and real boundary-reason variety (not just `mountain_range`), can produce `sea_route` edges, and can optionally generate `TerrainZone` extension data. `ALGORITHM_VERSION` is `2.0.0`. See "Notes on M4.6" below for implementation decisions. Next: M5 (edit panels).

## Notes on M4.6 (generator capability expansion — implemented)

- **A shared `core/taxonomy.ts` module was added** (`BIOMES`/`WATER_FEATURES`/`CIVILIAN_SCALES`/`OUTPOST_KINDS`/`POI_KINDS` sets, `isWaterBranch`/`isOutpostBranch` predicates) — this is the third real use site for "infer the Tier 1.5 fork from `subtype`'s value" (`generator.ts`, `NodeShape.tsx`, `exporter.ts` all needed it), so it was extracted rather than left as three independently-drifting copies. **Important architectural detail:** `components/canvas/NodeShape.tsx` cannot import `core/taxonomy.ts` directly — the UI layer may only import `store/`/`types/`/React (spec Section 2). `isWaterBranch`/`isOutpostBranch` are re-exported from `store/mapStore.ts` for that reason; don't "simplify" this by having a component import core directly.
- **Civilian settlement scale is weighted (village 45 / town 35 / city 15 / metropolis 5) with a hard cap** (`MAX_CITY_OR_ABOVE = 2`) rather than pure weighted-random — the spec calls for "rare" city-or-above regardless of map size, and probability alone doesn't guarantee that on a large map. The cap forces village/town once 2 city-or-above settlements exist.
- **Boundary reason is now a real uniform pick among all four values** (`coastline | mountain_range | canyon_void | magical_barrier`), superseding M4.5's mountain_range-only placeholder. `markCheckRequired`'s "always check-required" rule was narrowed to specifically mean *mountain_range* paired with another boundary/wilderness node — under M4.5 this was written as "any two boundary-marked nodes," which was equivalent when only one reason existed but would have been wrong now (two unrelated boundary reasons, e.g. one coastline + one canyon_void, shouldn't unconditionally force a check).
- **`coastal` is independent of `boundary.reason === "coastline"`** — always true when that reason is present, but also assigned at a low independent rate (`INDEPENDENT_COASTAL_CHANCE = 0.05`) elsewhere, so coastal flavor and `sea_route` eligibility aren't confined to the boundary ring.
- **`generateTerrainZonesStep` groups by matching Biome value across the whole map, not spatial proximity** — one zone per biome present (≥2 members), plus one `ocean` zone if ≥2 coastal nodes exist. This is a deliberate simplification: proper spatial clustering into multiple disconnected same-biome zones is more sophistication than a first pass needs, and it's easy to evolve later without changing the `TerrainZone` shape.
- **Extension invariants (spec Section 3b) were implemented in `validator.ts` for the first time in this milestone** — `extension-node-ref`, `extension-edge-ref`, `faction-membership-unique`, all warn-only. They existed only as spec prose before now because extensions were always empty pre-M4.6; there was nothing to check.
- **Labels now derive from the Tier 2 subtype** (`"Village-1"`, `"Forest-3"`, `"Monastery-2"`) instead of the bare Tier 1 type, per spec Section 7 Step 1 — this changes generated (not hand-authored) labels from M4.5's behavior.
- **`GeneratePanel.tsx` gained three new controls** (`wildernessWaterFraction`/`settlementOutpostFraction` sliders, a `generateTerrainZones` checkbox) since these params are functionally meaningful now — leaving them unreachable from the UI would make the new capability invisible in the running app.

## Notes on M4.5 (taxonomy migration — implemented)

Read spec Section 3c before touching `NodeType`, `NodeSubtype`, `BoundaryMarker`, or `TerrainType` — it's the authoritative explanation of the tiered model (Tier 1 / Tier 1.5 fork / Tier 2 / Boundary / Tier 3+) and the fork-vs-additive-feature heuristic for extending it later. Highlights, since this reworks types that M1–M4 already shipped against:

- `NodeType` shrinks from 5 values to 3: `settlement | wilderness | poi`. `mountain` is gone entirely — it's now a `mountain_range` `BoundaryMarker`, an orthogonal fact any node can carry, not a type. `water` is gone as a top-level type too — it's a Tier 1.5 fork *inside* Wilderness (land vs. water), inferable from which subtype union a node's `subtype` belongs to (no separate branch field).
- Settlement gets the same Tier-1.5-fork treatment: civilian (scaled `village|town|city|metropolis`) vs. outpost (categorized by purpose: `monastery|military_fort|trading_post|mining_camp|waystation`). A settlement's "size" and "is it a specialized outpost" are different questions, not one scale with outpost at the bottom.
- **The generator-capability rule inverted from the original spec, not just expanded:** the old spec said the generator never touches `subtype`/water/extensions — full stop. The corrected rule is the generator *is* capable through Tier 2 (any `NodeType`, fork, and `NodeSubtype`) plus `BoundaryMarker`, and optionally `TerrainZone` data behind a new `generateTerrainZones` param. Only Tier 3+ detail (a specific ruin flavor, `grove` under `forest`, architectural settlement style) and all `Faction` data stay permanently, deliberately manual — that's not "not yet built," it's a permanent line (political texture is the DM's voice, not the algorithm's).
- `hills`/`canyon` were seriously considered as new node-level "terrain feature" values and explicitly rejected in favor of folding into the existing (zone-only) `ElevationHint` field — one topography axis, not two overlapping ones. `coastal` stayed a real per-node field specifically because it drives `sea_route` assignment on every map, not just ones using terrain zones.
- `TerrainType` (Section 3b) now literally reuses `Biome` (Section 3a) via `Biome | "coast" | "lake" | "ocean"` rather than an independently-drifting list — this creates a circular type-only import between `map.ts` and `extensions.ts`, which is fine (erased at compile time) but don't "fix" it by duplicating the union.
- `ALGORITHM_VERSION` bumps to `2.0.0` in M4.5 — this is a breaking data-model change (Section 4's versioning rule), not a minor RNG-sequence tweak.
- M4.5 and M4.6 are deliberately split: M4.5 is types + the mountain→boundary-marker migration only (must happen together since `generator.ts`/`prototypeMap.ts` won't compile against the new types otherwise) — no new subtype variety yet. M4.6 is where water/biome/civilian-scale/outpost-kind/poi-kind/terrain-zones actually start getting placed. Don't collapse these into one milestone — M4.5 alone is already a full-codebase migration touching generator/validator/prototype/rendering/exporter/every test file.

**Implementation decisions made while executing M4.5** (beyond the spec's literal text):

- **`placeNodes` got genuinely simpler, not just migrated.** Since all three Tier 1 types are now zone-uniform (zone only gates `BoundaryMarker` probability, not type eligibility — spec Section 7), the old per-zone eligibility-list-plus-force-fill machinery (`CENTER_ZONE_TYPES`/`MID_ZONE_TYPES`, the settlement/mountain quota mechanism from M2) is gone entirely. Type assignment is now a shuffled bag sized exactly to each budget (`round(nodeCount × share)`), zipped one-for-one against the already-shuffled cell order — hits the target split exactly, every seed, with far less code. Verified across 4 seeds: settlement/wilderness/poi land on exact target counts (10/27/12 for the default 20/55/25% bias) every time.
- **Only `mountain_range` is ever placed as a boundary reason in M4.5** — deliberate, not an oversight. `coastline`/`canyon_void`/`magical_barrier` need coastal/terrain awareness that doesn't exist until M4.6; picking among all four uniformly now would just be noise with no signal behind it. `generator.test.ts` has an explicit test asserting this (`only ever places mountain_range boundary markers`) — when M4.6 adds real reason variety, that test's assumption must be revisited, not just deleted.
- **Mid-zone boundary markers use a `MID_ZONE_BOUNDARY_DAMPING = 0.15` multiplier** on top of `boundaryFraction`, gated by the same `midZoneBoundaryAllowed` geometric safety margin the old `midZoneMountainAllowed` used. Not deeply tuned — flagged in the spec itself as "no evidence yet a different weighting is needed."
- **Rendering (`NodeShape.tsx`, `exporter.ts`) infers the Tier 1.5 fork from `subtype`'s value**, exactly as spec'd — `isWaterBranch`/`isOutpostBranch` check membership in the `WaterFeature`/`OutpostKind` value sets. Since M4.5 never assigns those subtypes, every settlement currently renders as civilian (large circle) and every wilderness node as land (plain circle) — the fork-aware code paths are correct but practically dormant until M4.6 starts populating `subtype`. Don't be surprised the outpost/water shapes don't show up yet; that's expected, not a bug.
- **`prototypeMap.ts`'s `RAW_NODES` data itself was not touched** — it still says `type: "mountain"` / `type: "ruin"` in the transcription (kept for source-fidelity/readability against the original HTML), and a new `resolveType()` function maps those raw labels to the current `{ type, boundary }` shape at build time. Don't "clean up" `RAW_NODES` to say `wilderness`/`poi` directly — that would erase the useful historical context of *why* those 22 nodes are boundary-marked.
- **`names.ts`'s old `mountain`/`ruin` name pools folded into `wilderness`/`poi` respectively** (matching the type migration); the old `water` pool became a standalone `WATER_FEATURE_NAMES` export, not part of `NAMES_BY_TYPE`, since water isn't a `NodeType` key anymore.

## Notes on M4

- **Full `mapStore.ts` built now, per the spec's explicit M4 file list** — including `updateNode`/`deleteNode`/`addNode`/`updateEdge`/`deleteEdge`/`addEdge` and `undo`/`redo`, even though no UI calls them yet (`NodePanel`/`EdgePanel` are M5). Same pattern as M3's edit-actions-ahead-of-UI approach, just completed. A new edit action clears the redo (`future`) stack — standard undo/redo semantics, not stated explicitly in spec Section 12 but the conventional reading of it.
- **`loadMap(map)` is a store action not in spec Section 12's literal list.** Section 1 promises "Export — JSON (re-import)" as an app capability, but no Section 12 action or Section 11 view owns "import." Added the minimal action needed to make M4's "JSON export round-trips through import cleanly" acceptance criterion true in the running app (wired to `GeneratePanel`'s "Import JSON" button), rather than only proving the round-trip at the `exporter.test.ts` level. Resolves `draftParams` to the loaded map's own `params` so the panel doesn't show stale sliders after an import.
- **Section 11 View B says sliders update a `draft: GenerationParams` in local component state; Section 12 says the store owns `draftParams`.** These two parts of the spec disagree. Treated Section 12 (the authoritative state shape) as controlling — `GeneratePanel` reads/writes the store's `draftParams` directly via `updateDraftParam`, no parallel local draft state.
- **`rebalanceNodeTypeBias(current, changedKey, newValue)`** (in `mapStore.ts`, not `core/`) implements the "four sliders renormalize to sum 1.0" rule from Section 11 View B. It's pure and unit-tested but lives in `store/` rather than `core/` since it operates on UI-adjacent `GenerationParams` sliders, never on `WorldMap` graph data, and the generator itself never calls it.
- **`libraryStore.ts` is built with no UI consumer yet** (`LibraryPanel.tsx` is M6) — same "full store, UI catches up later" pattern. `SavedEntry` (spec Section 3a) stores `seed` + `params`, not the map itself, so "loading" a saved entry means regenerating via `generateMap()` — only reproduces the original output if the map was never hand-edited after generation. Documented inline since it's easy to assume the library snapshots full maps.
- **`exporter.ts`'s `toSVGString` mirrors `MapCanvas`/`NodeShape`/`EdgeLine`'s rendering rules independently** (pure string construction, duplicated constants) rather than sharing code with the component layer — required by the architecture boundary (`core/` cannot import from `components/`), and it's what makes `toSVGString` usable from a future Lambda per spec Section 10.
- **No version-mismatch banner was built** for Section 13's "restore from localStorage" behavior — the map is still restored on load regardless of `algorithmVersion`, but no component surfaces a warning when it's stale. No milestone's file list names this UI, and only one algorithm version currently exists, so there's nothing to warn about yet. Revisit if `ALGORITHM_VERSION` ever bumps before a component is built for it.

## Notes on M3

- `mapStore.ts` is intentionally minimal for this milestone: `{ map, generate }` only, with `map` initialized from `buildPrototypeMap()`. The full shape in spec Section 12 (selection, undo/redo, `draftParams`, `libraryStore` wiring) is M4/M5 scope — don't treat this file's current shape as final.
- `generate()` takes an optional `GenerationParams` override with a module-level `DEFAULT_GENERATION_PARAMS` fallback (random seed, per spec Section 4's one sanctioned `Math.random()` use). This default will be replaced once `GeneratePanel.tsx` owns `draftParams` in M4 — don't build more on top of it.
- `selectExitsForNode(map, nodeId)` lives in `mapStore.ts`, not in a component, per the Section 2 rule that UI must not derive map data inline. It reuses `core/graph.ts`'s `edgesForNode` and `core/compass.ts`'s `oppositeDir` — no new graph logic.
- Canvas layout constants (1200×800 base SVG, margins, `nx`/`ny` projection) mirror `docs/overworld-map.html`'s numbers so the render stays visually close to the prototype, per that file's documented role as a visual reference (not an architectural one).
- Node/edge visual styling (shapes, radii, colors, dash patterns, check-required overlay) follows spec Section 10b exactly. Only terrain/faction layers (Layer 0/1) and the layer-toggle toolbar are deliberately not built yet — extensions are always empty pre-M5/M6, so that UI would be premature.
- Hover highlighting/dimming of connected nodes (present in the prototype) was deliberately left out — not part of M3's acceptance criteria, and adding it isn't free of judgment calls (e.g., interaction with future click-to-select). Revisit if/when M5 needs it.

## Notes on M2 (decisions made beyond the spec's literal pseudocode)

The spec's generator/prototype description left some real gaps; these were resolved rather than left to chance, and are worth knowing before touching `generator.ts` or `prototypeMap.ts` again:

- **`core/prototypeMap.ts` is a new file, not in the spec's Section 2 file list.** It converts the 49-node dataset embedded in `docs/overworld-map.html` into a real `WorldMap` — needed both for the validator's "known-good map" test and M3's demo-map render. Added because building the same conversion twice (once ad hoc for tests, once "for real" in M3) would just invite drift.
- **The two reference docs disagreed with each other** on which edges are check-required (one edge each way) and the source data had 3 literal duplicate edges plus one node (Saltwick) with two exits both labeled SW. `docs/node-reference.md`'s table was treated as authoritative where the two disagreed; duplicates were removed; Saltwick's less-exact SW exit was relabeled to the nearest actually-free direction. Two nodes (Far Spur, Highfell East) had *every* connection marked check-required, which invariant 6 forbids — fixed with the same "unmark the lowest-difficulty edge" policy the generator itself uses (now exported as `enforceNonCheckRequiredExit` so both places share one policy).
- **The prototype still trips the warn-only direction-symmetry rule (invariant 7) in ~20 places** — real artifacts of hand-drawn data. Per spec Section 9 that rule is explicitly non-blocking, so `validator.test.ts` checks the prototype against the six hard invariants only, not that one.
- **`mountainEdgeFraction` and `nodeTypeBias.mountain` fought each other.** A 1-cell-thick edge ring is naturally ~40% of a modest grid's area, so an independent per-cell roll at 70% (the mountainEdgeFraction default) produced far more mountains than `nodeTypeBias.mountain`'s 22% share implied — and starved settlement/ruin's remaining budget in the process. Reinterpreted: `nodeTypeBias.mountain` sets a global mountain *budget* (`≈round(nodeCount × share)`); `mountainEdgeFraction` controls how much of that budget concentrates on the perimeter (edge-zone cells are processed first) versus spilling into the mid zone, rather than being an independent probability. This matches the concept doc's own framing of "frequency" and "containment" as two separate dials.
- **Settlement is placed only in the center zone** (per spec), which is a minority of the grid — left to organic weighted rolls, wilderness's larger weight consistently crowded settlement down to ~4% of the map instead of its 18% target. Fixed with a quota that gets force-filled once remaining center cells run low relative to remaining settlement need, so the target is actually met rather than just "allowed." Verified across 8+ seeds: settlement and mountain now land on target exactly every time; wilderness/ruin vary normally around their targets (no quota needed there — the miss wasn't structural).
- Center-zone "inner 50% by area" (Section 7, Step 1) is a **different, much wider band** than invariant 4's "inner 40%" mountain-forbidden band (Section 9) — these were conflated in an early draft of `classifyZone`, which starved settlement further. Now: center zone ≈ inner 70.7% per axis (`sqrt(0.5)`), invariant 4's band is untouched at 40%.
