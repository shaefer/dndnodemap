import { create } from "zustand";
import { oppositeDir } from "../core/compass";
import { edgesForNode } from "../core/graph";
import { generateMap } from "../core/generator";
import { buildPrototypeMap } from "../core/prototypeMap";
import type { CompassDir, GenerationParams, WorldMap } from "../types/map";

// M3-era default params, used only until GeneratePanel's draftParams wiring
// lands in M4. Seed is randomized on load per spec Section 4's one sanctioned
// Math.random() use.
export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  seed: Math.floor(Math.random() * 4294967296),
  targetNodeCount: 49,
  gridCols: 10,
  gridRows: 8,
  nodeTypeBias: { settlement: 0.18, wilderness: 0.45, mountain: 0.22, ruin: 0.15 },
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  mountainEdgeFraction: 0.7,
};

export interface NodeExit {
  direction: CompassDir;
  toNodeId: string;
  label: string;
  checkRequired: boolean;
}

// Derives a node's exit list for display (Tooltip now, node detail panel
// later). Lives here rather than in a component per spec Section 2 — the UI
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

interface MapState {
  map: WorldMap;
  generate: (params?: GenerationParams) => void;
}

// Minimal M3 store: the app boots on the prototype map and can replace it via
// a direct generateMap() call. Selection, undo/redo, draftParams, and
// libraryStore wiring are M4/M5 work per spec Section 12 — not built here.
export const useMapStore = create<MapState>((set) => ({
  map: buildPrototypeMap(),
  generate: (params = DEFAULT_GENERATION_PARAMS) => set({ map: generateMap(params) }),
}));
