import { create } from "zustand";
import { oppositeDir } from "../core/compass";
import { centroid, convexHull, padHull, recommendedGridDimensions, recommendedRadialGridDimensions } from "../core/geometry";
import { edgesForNode } from "../core/graph";
import { generateMap } from "../core/generator";
import { buildPrototypeMap } from "../core/prototypeMap";
import { REGION_PRESET_IDS, REGION_PRESETS, type RegionPresetId } from "../core/regionPresets";
import { decodeParams, encodeParams } from "../core/shareCode";
import { isOutpostBranch, isWaterBranch } from "../core/taxonomy";
import { validateMap, type Violation } from "../core/validator";
import type { CompassDir, GenerationParams, MapEdge, MapNode, WorldMap } from "../types/map";

// Re-exported so the UI layer (components/) can infer a node's Tier 1.5 fork,
// compute a hull for the terrain/faction overlay layers, or list region
// presets, without importing core/ directly — components may only import
// store/, types/, and React (spec Section 2 / CLAUDE.md's architecture
// contract).
export {
  centroid,
  convexHull,
  isOutpostBranch,
  isWaterBranch,
  padHull,
  recommendedGridDimensions,
  recommendedRadialGridDimensions,
  REGION_PRESET_IDS,
  REGION_PRESETS,
};
export type { RegionPresetId };

const MAX_HISTORY = 30;
const STORAGE_KEY = "overworld-current";

// The one sanctioned Math.random() use in the app (spec Section 4) — every
// other seed value flows from this, either at load or via randomizeSeed().
function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

// Same sanctioned exception, mirrored for region presets (spec Section 7c) —
// picks one at random so an untouched fresh app load still reads as a
// coherent region instead of a flat average of all six biomes.
function randomRegionPresetId(): RegionPresetId {
  return REGION_PRESET_IDS[Math.floor(Math.random() * REGION_PRESET_IDS.length)];
}

// Drives the Region Preset dropdown's displayed value: which (if any)
// registered preset the current biomeMix/wildernessWaterFraction actually
// matches, so the dropdown always reflects reality (the preset that was
// randomly chosen at load, one explicitly picked, or "Custom" once a biome
// slider has been dragged away from it) instead of always showing a bare
// placeholder. Epsilon-compared, not exact — floating-point rescale (
// rebalanceShares) or a share-code round-trip can leave a value a hair off
// an exact preset match even when nothing meaningfully changed.
const PRESET_MATCH_EPSILON = 0.005;

export function selectMatchingRegionPresetId(
  params: Pick<GenerationParams, "biomeMix" | "wildernessWaterFraction">
): RegionPresetId | null {
  for (const id of REGION_PRESET_IDS) {
    const preset = REGION_PRESETS[id];
    if (Math.abs(params.wildernessWaterFraction - preset.wildernessWaterFraction) > PRESET_MATCH_EPSILON) continue;
    const biomeKeys = Object.keys(preset.biomeMix) as (keyof GenerationParams["biomeMix"])[];
    const matches = biomeKeys.every((k) => Math.abs(params.biomeMix[k] - preset.biomeMix[k]) <= PRESET_MATCH_EPSILON);
    if (matches) return id;
  }
  return null;
}

const initialRegionPreset = REGION_PRESETS[randomRegionPresetId()];
const initialGridSize = recommendedGridDimensions(49);

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  seed: randomSeed(),
  placementAlgorithm: "grid",
  targetNodeCount: 49,
  gridCols: initialGridSize.gridCols,
  gridRows: initialGridSize.gridRows,
  radialSpokeCount: 6,
  radialCoreInterconnectivity: 0.5,
  radialBranchChance: 0.15,
  radialClusterChance: 0.1,
  radialDeadEndPoiBias: 0.6,
  radialConvergenceRadius: 1.5,
  radialInwardWeight: 0.15,
  radialFalloffExponent: 1,
  radialJitter: 0.3,
  radialRimFraction: 0.85,
  radialClusterMaxSize: 3,
  radialClusterSpread: 0.35,
  maxLargeSettlements: 2,
  roadFraction: 0.5,
  coastalChance: 0.05,
  interiorBoundaryDamping: 0.15,
  wildernessCheckMultiplier: 0.2,
  nodeTypeBias: { settlement: 0.2, wilderness: 0.55, poi: 0.25 },
  wildernessWaterFraction: initialRegionPreset.wildernessWaterFraction,
  settlementOutpostFraction: 0.25,
  biomeMix: { ...initialRegionPreset.biomeMix },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  boundaryFraction: 0.7,
  generateTerrainZones: false,
};

// localStorage is unavailable in the Vitest ("node") test environment and may
// throw in private-browsing contexts — persistence is a convenience, never a
// correctness requirement, so every access is best-effort.
function loadPersistedMap(): WorldMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorldMap) : null;
  } catch {
    return null;
  }
}

function persistMap(map: WorldMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore — see loadPersistedMap comment
  }
}

// Shareable links (spec Section 13b). `window`/`location`/`history` are all
// undefined in Vitest's "node" test environment, same reason localStorage
// access above is guarded — every access here is best-effort, never a
// correctness requirement.
const SHARE_CODE_PARAM = "map";

function readShareCodeFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(SHARE_CODE_PARAM);
  } catch {
    return null;
  }
}

// Called after generate()/loadMap() so the address bar always reflects the
// current map. Uses replaceState, never pushState — a shared link must not
// spam browser back/forward history.
function writeShareCodeToUrl(params: GenerationParams): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_CODE_PARAM, encodeParams(params));
    window.history.replaceState(null, "", url.toString());
  } catch {
    // ignore — URL sync is a convenience, not a correctness requirement
  }
}

// Load precedence (spec Section 13b): a URL share code, if present and
// valid, wins over the localStorage restore, which wins over the prototype
// map default. A malformed or unrecognized-version code falls through
// silently (logged, not shown to the user — no banner in this pass).
function resolveInitialMap(): WorldMap {
  const code = readShareCodeFromUrl();
  if (code) {
    const decoded = decodeParams(code);
    if (decoded.ok) return generateMap(decoded.params);
    console.warn(`Couldn't load shared map link: ${decoded.error}`);
  }
  return loadPersistedMap() ?? buildPrototypeMap();
}

export interface NodeExit {
  direction: CompassDir;
  toNodeId: string;
  label: string;
  checkRequired: boolean;
}

// Derives a node's exit list for display (Tooltip, and later the node detail
// panel). Lives here rather than in a component per spec Section 2 — the UI
// layer must not compute derived map data inline.
export function selectExitsForNode(map: WorldMap, nodeId: string): NodeExit[] {
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  return edgesForNode(nodeId, map.edges).map((edge) => {
    const toNodeId = edge.fromId === nodeId ? edge.toId : edge.fromId;
    const direction = edge.fromId === nodeId ? edge.direction : oppositeDir(edge.direction);
    return {
      direction,
      toNodeId,
      label: nodeById.get(toNodeId)?.label ?? "Unknown",
      checkRequired: edge.checkRequired,
    };
  });
}

// Spec Section 11, View B: when one slider in a bias/mix group moves, the
// others rescale proportionally so the group continues to sum to 1.0.
// Originally written just for the three nodeTypeBias shares; generalized
// once biomeMix (six shares) needed the identical behavior — a second real
// use case, not speculative genericization.
export function rebalanceShares<K extends string>(
  current: Record<K, number>,
  changedKey: K,
  newValue: number
): Record<K, number> {
  const clamped = Math.max(0, Math.min(1, newValue));
  const keys = Object.keys(current) as K[];
  const others = keys.filter((k) => k !== changedKey);
  const oldRestSum = others.reduce((sum, k) => sum + current[k], 0);
  const remaining = 1 - clamped;

  const next: Record<K, number> = { ...current, [changedKey]: clamped };
  if (oldRestSum <= 0) {
    const share = remaining / others.length;
    for (const k of others) next[k] = share;
  } else {
    for (const k of others) next[k] = current[k] * (remaining / oldRestSum);
  }

  // Floating-point drift guard so the group always sums to exactly 1 (within
  // float precision), not just approximately.
  const total = keys.reduce((sum, k) => sum + next[k], 0);
  if (total > 0) {
    for (const k of keys) next[k] = next[k] / total;
  }
  return next;
}

function touch(map: WorldMap): WorldMap {
  return { ...map, updatedAt: new Date().toISOString() };
}

interface HistoryPatch {
  history: WorldMap[];
  future: WorldMap[];
}

// Every edit action pushes a snapshot of the pre-edit map before applying its
// change, and clears the redo stack (a new edit invalidates old redos) — spec
// Section 12's undo rule.
function pushHistory(state: Pick<MapState, "map" | "history">): HistoryPatch {
  const snapshot = structuredClone(state.map);
  return { history: [...state.history, snapshot].slice(-MAX_HISTORY), future: [] };
}

interface MapState {
  map: WorldMap;
  violations: Violation[];

  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  history: WorldMap[];
  future: WorldMap[];

  draftParams: GenerationParams;
  // When false (the default), generate() draws a fresh random seed every
  // click — a Generate click always produces a new map, not a repeat of the
  // last one. Locking is the explicit opt-out: "keep this seed" so the user
  // can tweak other params and regenerate variations against the same one.
  seedLocked: boolean;

  generate: () => void;
  // Replaces the current map wholesale (JSON import). Not in spec Section
  // 12's literal action list, but Section 1 promises "Export — JSON
  // (re-import)" as an app capability and nothing else provides it — see
  // CLAUDE.md's M4 notes.
  loadMap: (map: WorldMap) => void;
  updateDraftParam: <K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => void;
  randomizeSeed: () => void;
  setSeedLocked: (locked: boolean) => void;
  // Both set biomeMix + wildernessWaterFraction on draftParams in one action
  // (spec Section 7c) — a UI/store convenience, not a generator concept; the
  // generator only ever reads the resulting biomeMix, same as any other
  // param. Neither is a persisted "mode" — dragging a biome slider
  // afterward is just a new biomeMix, nothing to fall in or out of.
  applyRegionPreset: (id: RegionPresetId) => void;
  randomizeRegionPreset: () => void;
  // Sets gridCols/gridRows to recommendedGridDimensions(targetNodeCount) in
  // one action (spec Section 7/16, "grid sizing scaled to node count") — an
  // explicit, user-triggered recompute, not a hidden coupling on the node
  // count slider. gridCols/gridRows stay freely adjustable afterward, same
  // as biomeMix sliders after a region preset.
  applyRecommendedGridSize: () => void;

  updateNode: (id: string, patch: Partial<MapNode>) => void;
  deleteNode: (id: string) => void;
  addNode: (node: Omit<MapNode, "id">) => void;
  updateEdge: (id: string, patch: Partial<MapEdge>) => void;
  deleteEdge: (id: string) => void;
  addEdge: (edge: Omit<MapEdge, "id">) => void;

  undo: () => void;
  redo: () => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
}

const initialMap = resolveInitialMap();
// Populate the address bar with the first map's share code on first load too
// — not just after a subsequent generate()/loadMap() — so a plain visit (no
// `?map=` yet, e.g. restoring from localStorage, or the prototype default)
// still leaves a copy-able link in the bar immediately. Runs exactly once at
// module load (a top-level statement, not inside a React effect), and
// writeShareCodeToUrl only ever calls history.replaceState — never a
// navigation or reload — so this can't create a refresh loop.
writeShareCodeToUrl(initialMap.params);

// Full store per spec Section 12. Edit actions (updateNode/deleteNode/etc.)
// and undo/redo have no UI calling them yet — NodePanel/EdgePanel are M5 —
// but the milestone deliverable list names "full mapStore.ts" for M4, so the
// complete action set is built now and ready for M5 to wire buttons to.
export const useMapStore = create<MapState>((set, get) => ({
  map: initialMap,
  violations: validateMap(initialMap),
  selectedNodeId: null,
  selectedEdgeId: null,
  history: [],
  future: [],
  draftParams: { ...DEFAULT_GENERATION_PARAMS },
  seedLocked: false,

  generate: () =>
    set((state) => {
      const params = state.seedLocked ? state.draftParams : { ...state.draftParams, seed: randomSeed() };
      const map = generateMap(params);
      persistMap(map);
      writeShareCodeToUrl(map.params);
      return {
        map,
        draftParams: params,
        violations: validateMap(map),
        history: [],
        future: [],
        selectedNodeId: null,
        selectedEdgeId: null,
      };
    }),

  loadMap: (map) => {
    persistMap(map);
    // A hand-edited map's share link reproduces its origin generated state,
    // not any subsequent edits — the same limitation SavedEntry/library
    // reload already has (params records provenance, not a live description
    // of the current node/edge list).
    writeShareCodeToUrl(map.params);
    set({
      map,
      violations: validateMap(map),
      draftParams: map.params,
      history: [],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  updateDraftParam: (key, value) => set((state) => ({ draftParams: { ...state.draftParams, [key]: value } })),

  randomizeSeed: () => set((state) => ({ draftParams: { ...state.draftParams, seed: randomSeed() } })),

  setSeedLocked: (locked) => set({ seedLocked: locked }),

  applyRegionPreset: (id) =>
    set((state) => {
      const preset = REGION_PRESETS[id];
      return {
        draftParams: {
          ...state.draftParams,
          biomeMix: { ...preset.biomeMix },
          wildernessWaterFraction: preset.wildernessWaterFraction,
        },
      };
    }),

  randomizeRegionPreset: () => {
    get().applyRegionPreset(randomRegionPresetId());
  },

  applyRecommendedGridSize: () =>
    set((state) => {
      const { gridCols, gridRows } = recommendedGridDimensions(state.draftParams.targetNodeCount);
      return { draftParams: { ...state.draftParams, gridCols, gridRows } };
    }),

  updateNode: (id, patch) =>
    set((state) => {
      const map = touch({ ...state.map, nodes: state.map.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
      persistMap(map);
      return { ...pushHistory(state), map, violations: validateMap(map) };
    }),

  deleteNode: (id) =>
    set((state) => {
      const map = touch({
        ...state.map,
        nodes: state.map.nodes.filter((n) => n.id !== id),
        edges: state.map.edges.filter((e) => e.fromId !== id && e.toId !== id),
      });
      persistMap(map);
      return {
        ...pushHistory(state),
        map,
        violations: validateMap(map),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    }),

  addNode: (node) =>
    set((state) => {
      const map = touch({ ...state.map, nodes: [...state.map.nodes, { ...node, id: crypto.randomUUID() }] });
      persistMap(map);
      return { ...pushHistory(state), map, violations: validateMap(map) };
    }),

  updateEdge: (id, patch) =>
    set((state) => {
      const map = touch({ ...state.map, edges: state.map.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
      persistMap(map);
      return { ...pushHistory(state), map, violations: validateMap(map) };
    }),

  deleteEdge: (id) =>
    set((state) => {
      const map = touch({ ...state.map, edges: state.map.edges.filter((e) => e.id !== id) });
      persistMap(map);
      return {
        ...pushHistory(state),
        map,
        violations: validateMap(map),
        selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
      };
    }),

  addEdge: (edge) =>
    set((state) => {
      const map = touch({ ...state.map, edges: [...state.map.edges, { ...edge, id: crypto.randomUUID() }] });
      persistMap(map);
      return { ...pushHistory(state), map, violations: validateMap(map) };
    }),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      persistMap(previous);
      return {
        map: previous,
        violations: validateMap(previous),
        history: state.history.slice(0, -1),
        future: [state.map, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      persistMap(next);
      return {
        map: next,
        violations: validateMap(next),
        history: [...state.history, state.map].slice(-MAX_HISTORY),
        future: rest,
      };
    }),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
}));
