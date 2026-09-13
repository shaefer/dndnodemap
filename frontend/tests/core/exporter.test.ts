import { describe, expect, it } from "vitest";
import { toJSON, toMarkdown, toSVGString } from "../../src/core/exporter";
import { generateMap } from "../../src/core/generator";
import { buildPrototypeMap } from "../../src/core/prototypeMap";
import type { GenerationParams, WorldMap } from "../../src/types/map";

const DEFAULT_PARAMS: GenerationParams = {
  seed: 12345,
  targetNodeCount: 49,
  gridCols: 10,
  gridRows: 8,
  nodeTypeBias: { settlement: 0.2, wilderness: 0.55, poi: 0.25 },
  wildernessWaterFraction: 0.15,
  settlementOutpostFraction: 0.25,
  checkRequiredFraction: 0.25,
  edgeDensity: 0.5,
  boundaryFraction: 0.7,
  generateTerrainZones: true,
};

describe("toJSON", () => {
  it("round-trips through JSON.parse with no loss", () => {
    const map = buildPrototypeMap();
    const parsed = JSON.parse(toJSON(map)) as WorldMap;
    expect(parsed).toEqual(map);
  });
});

describe("toMarkdown", () => {
  const map = buildPrototypeMap();
  const markdown = toMarkdown(map);

  it("includes the node index table header", () => {
    expect(markdown).toContain("## Node Index");
    expect(markdown).toContain("| ID | Name | Type | Exits |");
  });

  it("lists every node with a capitalized type", () => {
    for (const node of map.nodes) {
      expect(markdown).toContain(node.label);
    }
    expect(markdown).toContain("Settlement");
    expect(markdown).toContain("Poi");
  });

  it("marks check-required exits with a warning glyph", () => {
    expect(markdown).toContain("⚠");
  });

  it("includes a check-required routes table with one row per check-required edge", () => {
    expect(markdown).toContain("## Check-Required Routes (⚠)");
    const checkRequiredCount = map.edges.filter((e) => e.checkRequired).length;
    const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
    for (const edge of map.edges.filter((e) => e.checkRequired)) {
      const from = nodeById.get(edge.fromId)!.label;
      const to = nodeById.get(edge.toId)!.label;
      expect(markdown).toContain(`| ${from} | ${to} | ${edge.direction} |`);
    }
    expect(checkRequiredCount).toBeGreaterThan(0);
  });
});

describe("toSVGString", () => {
  const map = buildPrototypeMap();

  it("produces a well-formed SVG document at the base scale", () => {
    const svg = toSVGString(map);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="800"');
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("scales width/height while keeping the viewBox fixed", () => {
    const svg = toSVGString(map, 2);
    expect(svg).toContain('width="2400"');
    expect(svg).toContain('height="1600"');
    expect(svg).toContain('viewBox="0 0 1200 800"');
  });

  it("renders every node's label", () => {
    const svg = toSVGString(map);
    for (const node of map.nodes) {
      expect(svg).toContain(node.label);
    }
  });

  it("draws a poi triangle and a mountain_range boundary badge for at least one node of each", () => {
    const svg = toSVGString(map);
    expect(map.nodes.some((n) => n.type === "poi")).toBe(true);
    expect(map.nodes.some((n) => n.boundary?.reason === "mountain_range")).toBe(true);
    expect(svg).toContain("<polygon");
    expect(svg).toContain("▲"); // mountain_range boundary badge glyph
  });

  it("renders terrain wash polygons and labels for a map with terrainZones", () => {
    const generated = generateMap(DEFAULT_PARAMS);
    expect(generated.extensions.terrainZones?.length ?? 0).toBeGreaterThan(0);
    const svg = toSVGString(generated);
    for (const zone of generated.extensions.terrainZones ?? []) {
      if (zone.nodeIds.length < 3) continue; // hull needs >=3 members to render
      expect(svg).toContain(zone.label);
    }
  });

  it("omits terrain wash entirely when extensions.terrainZones is absent", () => {
    const svg = toSVGString(map); // prototype map has no extensions
    expect(map.extensions.terrainZones).toBeUndefined();
    expect(svg).not.toContain("font-style=\"italic\"");
  });

  it("renders faction territory borders and labels when extensions.factions is present", () => {
    const withFaction: WorldMap = {
      ...map,
      extensions: {
        factions: [
          {
            id: "f1",
            name: "The Ashen Concord",
            borderStyle: "disputed",
            nodeIds: map.nodes.slice(0, 5).map((n) => n.id),
          },
        ],
      },
    };
    const svg = toSVGString(withFaction);
    expect(svg).toContain("The Ashen Concord");
    expect(svg).toContain('stroke-dasharray="8,4"'); // disputed border style
  });
});
