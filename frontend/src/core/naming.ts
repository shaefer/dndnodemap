import {
  generateName,
  poiFanciful,
  regionName,
  settlementMedieval,
  waterFeature,
  wildernessDesert,
  wildernessForest,
  wildernessJungle,
  wildernessPlains,
  wildernessSwamp,
  wildernessTundra,
  type Theme,
} from "../nameforge";
import type { Biome, MapNode } from "../types/map";
import type { RngFn } from "./rng";
import { isWaterBranch } from "./taxonomy";

// M4.12 — the app-specific adapter between the generic, standalone nameforge
// library and this app's types. Nothing in nameforge imports from here or
// from types/map.ts; this is the only file that bridges the two.

const BIOME_THEME: Record<Biome, Theme> = {
  forest: wildernessForest,
  swamp: wildernessSwamp,
  plains: wildernessPlains,
  desert: wildernessDesert,
  tundra: wildernessTundra,
  jungle: wildernessJungle,
};

function themeForNode(node: MapNode): Theme {
  if (node.type === "settlement") return settlementMedieval;
  if (node.type === "poi") return poiFanciful;
  // wilderness
  if (isWaterBranch(node)) return waterFeature;
  // Land branch. Falls back to forest if subtype is somehow unset — mirrors
  // exporter.ts's DEFAULT_LAND_COLOR precedent for the same shouldn't-happen
  // case (subtype is always assigned post-M4.6).
  return BIOME_THEME[node.subtype as Biome] ?? wildernessForest;
}

// A post-generation pass (M4.12) — mirrors layoutRelax.ts's shape (M4.10): a
// standalone function generateMap() calls once, over already-classified
// nodes, that only touches one concern (here, label) and knows nothing about
// geometry, edges, or which placement algorithm produced the nodes. The same
// function is what a future "rename this node"/"reroll all names" editing
// feature would call again over an existing map.
export function applyNodeNames(nodes: MapNode[], rng: RngFn): MapNode[] {
  return nodes.map((node) => ({ ...node, label: generateName(themeForNode(node), rng).text }));
}

export function generateMapName(rng: RngFn): string {
  return generateName(regionName, rng).text;
}
