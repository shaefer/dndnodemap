import { oppositeDir } from "./compass";
import { centroid, convexHull, padHull, type Point } from "./geometry";
import { edgesForNode } from "./graph";
import { isOutpostBranch, isWaterBranch } from "./taxonomy";
import type { BorderStyle, Faction, TerrainZone } from "../types/extensions";
import type { ConnectionType, MapNode, WorldMap } from "../types/map";

// --- toJSON ------------------------------------------------------------------

export function toJSON(map: WorldMap): string {
  return JSON.stringify(map, null, 2);
}

// --- toMarkdown ----------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Mirrors selectExitsForNode's logic (store/mapStore.ts) but reimplemented
// independently — exporter.ts is core and must not import from store.
function formatExits(map: WorldMap, nodeId: string): string {
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const exits = edgesForNode(nodeId, map.edges).map((edge) => {
    const otherId = edge.fromId === nodeId ? edge.toId : edge.fromId;
    const direction = edge.fromId === nodeId ? edge.direction : oppositeDir(edge.direction);
    const label = nodeById.get(otherId)?.label ?? "Unknown";
    return `${direction}→${label}${edge.checkRequired ? " ⚠" : ""}`;
  });
  return exits.length > 0 ? exits.join(", ") : "—";
}

// Matches docs/node-reference.md's table format.
export function toMarkdown(map: WorldMap): string {
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const lines: string[] = [
    `# ${map.name} — Reference Table`,
    "",
    "## Node Index",
    "",
    "| ID | Name | Type | Exits |",
    "|----|------|------|-------|",
  ];

  map.nodes.forEach((node, i) => {
    lines.push(`| ${i} | ${node.label} | ${capitalize(node.type)} | ${formatExits(map, node.id)} |`);
  });

  const checkRequiredEdges = map.edges.filter((e) => e.checkRequired);
  lines.push(
    "",
    "---",
    "",
    "## Check-Required Routes (⚠)",
    "",
    "These connections exist but require a skill check to traverse safely.",
    "",
    "| From | To | Direction | Suggested Check |",
    "|------|----|-----------|-----------------|"
  );
  for (const edge of checkRequiredEdges) {
    const from = nodeById.get(edge.fromId)?.label ?? "Unknown";
    const to = nodeById.get(edge.toId)?.label ?? "Unknown";
    lines.push(`| ${from} | ${to} | ${edge.direction} | ${edge.checkType ?? ""} |`);
  }
  lines.push("");

  return lines.join("\n");
}

// --- toSVGString ---------------------------------------------------------------
// Pure string construction, no browser/DOM APIs, so it's usable from a Lambda
// as well as the browser. Layout constants and visual styling mirror
// components/canvas/{MapCanvas,NodeShape,EdgeLine}.tsx and, in turn,
// docs/overworld-map.html — see spec Section 10.

const SVG_W = 1200;
const SVG_H = 800;
const MARGIN = { l: 60, r: 60, t: 40, b: 40 };

const SETTLEMENT_COLOR = { fill: "#F2C14E", stroke: "#9C6B0A" };
const WATER_COLOR = { fill: "#185FA5", stroke: "#0F3D6B" };
const POI_COLOR = { fill: "#8B5FBF", stroke: "#5C3D80" };

// Wilderness land-branch color varies by Biome subtype — mirrors
// components/canvas/NodeShape.tsx. Falls back to forest's color for a
// land-branch node with no subtype (shouldn't happen post-M4.6).
const BIOME_COLOR: Record<string, { fill: string; stroke: string }> = {
  forest: { fill: "#3B6D11", stroke: "#24430A" },
  swamp: { fill: "#5F6B2A", stroke: "#3D4519" },
  desert: { fill: "#BA7517", stroke: "#8A5710" },
  plains: { fill: "#C9C93D", stroke: "#8F8F22" },
  tundra: { fill: "#A8A8A0", stroke: "#5F5E5A" },
  jungle: { fill: "#27500A", stroke: "#173206" },
};
const DEFAULT_LAND_COLOR = BIOME_COLOR.forest;

const BOUNDARY_GLYPH: Record<string, string> = {
  mountain_range: "▲",
  coastline: "〜",
  canyon_void: "⌇",
  magical_barrier: "✦",
};

const CONNECTION_STYLE: Record<ConnectionType, { stroke: string; width: number; dash?: string; opacity: number }> = {
  road: { stroke: "#888780", width: 1.5, opacity: 1 },
  trail: { stroke: "#888780", width: 1, opacity: 0.7 },
  pass: { stroke: "#888780", width: 1.5, opacity: 1 },
  river_ford: { stroke: "#185FA5", width: 1.5, opacity: 1 },
  sea_route: { stroke: "#185FA5", width: 1.5, dash: "6,3", opacity: 1 },
  seasonal: { stroke: "#888780", width: 1, dash: "2,3", opacity: 1 },
};
const CHECK_OVERLAY_COLOR = "#D85A30";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Returns the shape markup, its radius (label offset depends on it, and
// radius now varies by Tier 1.5 fork, not just NodeType), and the stroke
// color used (so the boundary badge, drawn after, can match it).
function nodeShapeSvg(node: MapNode, x: number, y: number): { svg: string; r: number; stroke: string } {
  if (node.type === "settlement") {
    const outpost = isOutpostBranch(node);
    const { fill, stroke } = SETTLEMENT_COLOR;
    if (outpost) {
      const r = 8;
      return {
        svg: `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`,
        r,
        stroke,
      };
    }
    const r = 11;
    return {
      svg: `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`,
      r,
      stroke,
    };
  }
  if (node.type === "wilderness") {
    if (isWaterBranch(node)) {
      const r = 9;
      const { fill, stroke } = WATER_COLOR;
      return {
        svg:
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1" />` +
          `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${stroke}" stroke-width="1" />`,
        r,
        stroke,
      };
    }
    const r = 7;
    const { fill, stroke } = (node.subtype && BIOME_COLOR[node.subtype]) || DEFAULT_LAND_COLOR;
    return { svg: `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`, r, stroke };
  }
  // poi
  const r = 10;
  const { fill, stroke } = POI_COLOR;
  return {
    svg: `<polygon points="${x},${y - r} ${x + r * 0.9},${y + r * 0.6} ${x - r * 0.9},${y + r * 0.6}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`,
    r,
    stroke,
  };
}

// Layer 0/1 (spec Section 10b) — mirrors
// components/canvas/{TerrainWash,FactionTerritory}.tsx so the live canvas
// and this string-built export stay visually in sync.
const WASH_COLOR: Record<string, string> = {
  forest: "#3B6D11",
  swamp: "#5F6B2A",
  desert: "#BA7517",
  plains: "#8A8A20",
  tundra: "#888780",
  jungle: "#27500A",
  coast: "#0F6E56",
  lake: "#185FA5",
  ocean: "#042C53",
};
const WASH_OPACITY: Record<string, number> = {
  forest: 0.15,
  swamp: 0.15,
  desert: 0.12,
  plains: 0.1,
  tundra: 0.12,
  jungle: 0.18,
  coast: 0.12,
  lake: 0.15,
  ocean: 0.18,
};
const WATER_TERRAINS = new Set(["lake", "ocean"]);
const FACTION_HULL_PADDING = 12;
const DASH_FOR_BORDER_STYLE: Record<BorderStyle, string | undefined> = {
  solid: undefined,
  disputed: "8,4",
  ancient: "2,6,8,6",
};

function terrainWashSvg(zones: TerrainZone[], nodeById: Map<string, MapNode>, project: (n: MapNode) => Point): string {
  const parts: string[] = [];
  for (const zone of zones) {
    const points = zone.nodeIds
      .map((id) => nodeById.get(id))
      .filter((n): n is MapNode => !!n)
      .map(project);
    const hull = convexHull(points);
    if (hull.length < 3) continue;

    const isWater = WATER_TERRAINS.has(zone.terrain);
    const color = WASH_COLOR[zone.terrain] ?? WASH_COLOR.forest;
    const opacity = WASH_OPACITY[zone.terrain] ?? 0.12;
    const center = centroid(hull);
    const pointsAttr = hull.map((p) => `${p.x},${p.y}`).join(" ");

    parts.push(
      `<polygon points="${pointsAttr}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-opacity="0.4" stroke-width="0.5" stroke-dasharray="${isWater ? "4,3" : "3,3"}" />`
    );
    parts.push(
      `<text x="${center.x}" y="${center.y}" text-anchor="middle" font-size="9" font-style="italic" fill="${color}" opacity="0.7">${escapeXml(zone.label)}</text>`
    );
  }
  return parts.join("");
}

function factionTerritorySvg(factions: Faction[], nodeById: Map<string, MapNode>, project: (n: MapNode) => Point): string {
  const parts: string[] = [];
  for (const faction of factions) {
    const points = faction.nodeIds
      .map((id) => nodeById.get(id))
      .filter((n): n is MapNode => !!n)
      .map(project);
    const hull = convexHull(points);
    if (hull.length < 3) continue;

    const padded = padHull(hull, FACTION_HULL_PADDING);
    const color = faction.color ?? "#8B5FBF";
    const pointsAttr = padded.map((p) => `${p.x},${p.y}`).join(" ");
    const top = padded.reduce((best, p) => (p.y < best.y ? p : best), padded[0]);
    const dash = DASH_FOR_BORDER_STYLE[faction.borderStyle];

    parts.push(
      `<polygon points="${pointsAttr}" fill="none" stroke="${color}" stroke-opacity="0.7" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ""} />`
    );
    parts.push(
      `<text x="${top.x}" y="${top.y - 6}" text-anchor="middle" font-size="10" fill="${color}">${escapeXml(faction.name)}</text>`
    );
  }
  return parts.join("");
}

export function toSVGString(map: WorldMap, scale = 1): string {
  const w = SVG_W * scale;
  const h = SVG_H * scale;
  const gridCols = map.params.gridCols;
  const gridRows = map.params.gridRows;
  const cellW = (SVG_W - MARGIN.l - MARGIN.r) / Math.max(1, gridCols - 1);
  const cellH = (SVG_H - MARGIN.t - MARGIN.b) / Math.max(1, gridRows - 1);
  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const nx = (node: MapNode) => MARGIN.l + node.gx * cellW;
  const ny = (node: MapNode) => MARGIN.t + node.gy * cellH;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${SVG_W} ${SVG_H}">`);
  parts.push(`<rect width="${SVG_W}" height="${SVG_H}" fill="#faf9f6" />`);
  parts.push(
    `<text x="${SVG_W / 2}" y="22" text-anchor="middle" font-size="14" fill="#888" font-family="system-ui, sans-serif">${escapeXml(map.name)}</text>`
  );

  const project = (node: MapNode): Point => ({ x: nx(node), y: ny(node) });
  if (map.extensions.terrainZones && map.extensions.terrainZones.length > 0) {
    parts.push("<g>", terrainWashSvg(map.extensions.terrainZones, nodeById, project), "</g>");
  }
  if (map.extensions.factions && map.extensions.factions.length > 0) {
    parts.push("<g>", factionTerritorySvg(map.extensions.factions, nodeById, project), "</g>");
  }

  parts.push("<g>");
  for (const edge of map.edges) {
    const from = nodeById.get(edge.fromId);
    const to = nodeById.get(edge.toId);
    if (!from || !to) continue;
    const x1 = nx(from);
    const y1 = ny(from);
    const x2 = nx(to);
    const y2 = ny(to);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const style = CONNECTION_STYLE[edge.connectionType];

    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${style.stroke}" stroke-width="${style.width}"` +
        (style.dash ? ` stroke-dasharray="${style.dash}"` : "") +
        ` opacity="${style.opacity}" />`
    );
    if (edge.checkRequired) {
      parts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CHECK_OVERLAY_COLOR}" stroke-width="${style.width}" stroke-dasharray="6,5" opacity="0.85" />`
      );
    }
    if (edge.connectionType === "pass") {
      parts.push(`<text x="${mx}" y="${my - 14}" text-anchor="middle" font-size="9" fill="${style.stroke}">▲</text>`);
    }
    const dirColor = edge.checkRequired ? CHECK_OVERLAY_COLOR : style.stroke;
    parts.push(
      `<text x="${mx}" y="${my - 5}" text-anchor="middle" font-size="9" fill="${dirColor}" opacity="0.85">${edge.direction}</text>`
    );
  }
  parts.push("</g>");

  parts.push("<g>");
  for (const node of map.nodes) {
    const x = nx(node);
    const y = ny(node);
    const { svg, r, stroke } = nodeShapeSvg(node, x, y);
    parts.push(svg);
    if (node.boundary) {
      parts.push(
        `<text x="${x + r * 0.7}" y="${y - r * 0.7}" text-anchor="middle" font-size="9" fill="${stroke}">${BOUNDARY_GLYPH[node.boundary.reason]}</text>`
      );
    }
    parts.push(
      `<text x="${x}" y="${y + r + 12}" text-anchor="middle" font-size="10" font-weight="500" fill="#444">${escapeXml(node.label)}</text>`
    );
  }
  parts.push("</g>");

  parts.push("</svg>");
  return parts.join("");
}
