import { oppositeDir } from "./compass";
import { edgesForNode } from "./graph";
import type { ConnectionType, MapNode, NodeType, WorldMap } from "../types/map";

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

const TYPE_FILL: Record<NodeType, string> = {
  settlement: "#5DCAA5",
  wilderness: "#85B7EB",
  poi: "#EF9F27",
};
const TYPE_STROKE: Record<NodeType, string> = {
  settlement: "#0F6E56",
  wilderness: "#185FA5",
  poi: "#BA7517",
};

// Tier 2 subtype unions used only to infer which Tier 1.5 fork a node is on
// (spec Section 3c — the fork is never its own field). Mirrors
// components/canvas/NodeShape.tsx.
const WATER_FEATURES = new Set(["pond", "lake", "river_crossing", "hot_spring", "waterfall", "delta"]);
const OUTPOST_KINDS = new Set(["monastery", "military_fort", "trading_post", "mining_camp", "waystation"]);

function isWaterBranch(node: MapNode): boolean {
  return node.type === "wilderness" && !!node.subtype && WATER_FEATURES.has(node.subtype);
}

function isOutpostBranch(node: MapNode): boolean {
  return node.type === "settlement" && !!node.subtype && OUTPOST_KINDS.has(node.subtype);
}

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

// Returns both the shape markup and its radius (label offset depends on it,
// and radius now varies by Tier 1.5 fork, not just NodeType).
function nodeShapeSvg(node: MapNode, x: number, y: number): { svg: string; r: number } {
  const fill = TYPE_FILL[node.type];
  const stroke = TYPE_STROKE[node.type];

  if (node.type === "settlement") {
    const outpost = isOutpostBranch(node);
    const r = outpost ? 8 : 11;
    const dash = outpost ? ` stroke-dasharray="3,2"` : "";
    return { svg: `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.8"${dash} />`, r };
  }
  if (node.type === "wilderness") {
    if (isWaterBranch(node)) {
      const r = 9;
      return {
        svg:
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1" />` +
          `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${stroke}" stroke-width="1" />`,
        r,
      };
    }
    const r = 7;
    return { svg: `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`, r };
  }
  // poi
  const r = 10;
  return {
    svg: `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />`,
    r,
  };
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
    const { svg, r } = nodeShapeSvg(node, x, y);
    parts.push(svg);
    if (node.boundary) {
      const stroke = TYPE_STROKE[node.type];
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
