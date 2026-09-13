import { create } from "zustand";
import { oppositeDir } from "../core/compass";
import { edgesForNode } from "../core/graph";
import { generateMap } from "../core/generator";
import { buildPrototypeMap } from "../core/prototypeMap";
import { validateMap, type Violation } from "../core/validator";
import type { CompassDir, GenerationParams, MapEdge, MapNode, WorldMap } from "../types/map";

const MAX_HISTORY = 30;
const STORAGE_KEY = "overworld-current";

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  seed: randomSeed(),
  targetNodeCount: 49,
  gridCols: 10,
  gridRows: 8,
  nodeTypeBias: { settlement: 0.18, wilderness: 0.45, mountain: 0.22, ruin: 0.15 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  mountainEdgeFraction: 0.7,
};

// The one sanctioned Math.random() use in the app (spec Section 4) — every
// other seed value flows from this, either at load or via randomizeSeed().
function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

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

type NodeTypeBias = GenerationParams["nodeTypeBias"];

// Spec Section 11, View B: when one node-type slider moves, the other three
// rescale proportionally so all four continue to sum to 1.0.
export function rebalanceNodeTypeBias(
  current: NodeTypeBias,
  changedKey: keyof NodeTypeBias,
  newValue: number
): NodeTypeBias {
  const clamped = Math.max(0, Math.min(1, newValue));
  const keys = Object.keys(current) as (keyof NodeTypeBias)[];
  const others = keys.filter((k) => k !== changedKey);
  const oldRestSum = others.reduce((sum, k) => sum + current[k], 0);
  const remaining = 1 - clamped;

  const next = { ...current, [changedKey]: clamped };
  if (oldRestSum <= 0) {
    const share = remaining / others.length;
    for (const k of others) next[k] = share;
  } else {
    for (const k of others) next[k] = current[k] * (remaining / oldRestSum);
  }

  // Floating-point drift guard so the four values always sum to exactly 1
  // (within float precision), not just approximately.
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

  generate: () => void;
  // Replaces the current map wholesale (JSON import). Not in spec Section
  // 12's literal action list, but Section 1 promises "Export — JSON
  // (re-import)" as an app capability and nothing else provides it — see
  // CLAUDE.md's M4 notes.
  loadMap: (map: WorldMap) => void;
  updateDraftParam: <K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => void;
  randomizeSeed: () => void;

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

const initialMap = loadPersistedMap() ?? buildPrototypeMap();

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

  generate: () => {
    const map = generateMap(get().draftParams);
    persistMap(map);
    set({ map, violations: validateMap(map), history: [], future: [], selectedNodeId: null, selectedEdgeId: null });
  },

  loadMap: (map) => {
    persistMap(map);
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
