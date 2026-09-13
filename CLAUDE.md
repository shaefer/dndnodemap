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

M0 (repo scaffold) complete: `frontend/` (Vite + React + TS + Vitest) builds; `backend/` (SAM scaffold, stub Lambda handler) builds via `sam build`. Next step: M1 — `frontend/src/types/map.ts`, `frontend/src/types/extensions.ts`, `frontend/src/core/rng.ts`, `frontend/src/core/compass.ts`, `frontend/src/core/graph.ts`, and their tests, per spec Section 17's M1 prompt.
