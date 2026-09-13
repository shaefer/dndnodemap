import type { MapNode } from "../types/map";

// Tier 2 subtype value sets, used only to infer which Tier 1.5 fork a node is
// on (spec Section 3c — the fork is never its own field on MapNode). Shared
// by generator.ts (which assigns subtype) and the rendering/export layers
// (which infer the fork from it) so the three don't drift independently.
export const BIOMES = new Set(["forest", "swamp", "plains", "desert", "tundra", "jungle"]);
export const WATER_FEATURES = new Set(["pond", "lake", "river_crossing", "hot_spring", "waterfall", "delta"]);
export const CIVILIAN_SCALES = new Set(["village", "town", "city", "metropolis"]);
export const OUTPOST_KINDS = new Set(["monastery", "military_fort", "trading_post", "mining_camp", "waystation"]);
export const POI_KINDS = new Set(["ruin", "dungeon", "lair", "landmark"]);

export function isWaterBranch(node: MapNode): boolean {
  return node.type === "wilderness" && !!node.subtype && WATER_FEATURES.has(node.subtype);
}

export function isOutpostBranch(node: MapNode): boolean {
  return node.type === "settlement" && !!node.subtype && OUTPOST_KINDS.has(node.subtype);
}
