import type { BorderStyle, Faction } from "../../types/extensions";
import type { MapNode } from "../../types/map";
import { convexHull, padHull } from "../../store/mapStore";

const DEFAULT_COLOR = "#8B5FBF";
const HULL_PADDING = 12;

// Spec Section 10b, Layer 1: border style alone carries political character —
// solid/disputed/ancient — no legend needed.
const DASH_FOR_STYLE: Record<BorderStyle, string | undefined> = {
  solid: undefined,
  disputed: "8,4",
  ancient: "2,6,8,6",
};

interface FactionTerritoryProps {
  factions: Faction[];
  nodeById: Map<string, MapNode>;
  project: (node: MapNode) => { x: number; y: number };
}

export function FactionTerritory({ factions, nodeById, project }: FactionTerritoryProps) {
  return (
    <g>
      {factions.map((faction) => {
        const points = faction.nodeIds
          .map((id) => nodeById.get(id))
          .filter((n): n is MapNode => !!n)
          .map(project);
        const hull = convexHull(points);
        if (hull.length < 3) return null; // too few members to read as a territory

        const padded = padHull(hull, HULL_PADDING);
        const color = faction.color ?? DEFAULT_COLOR;
        const pointsAttr = padded.map((p) => `${p.x},${p.y}`).join(" ");
        const top = padded.reduce((best, p) => (p.y < best.y ? p : best), padded[0]);

        return (
          <g key={faction.id}>
            <polygon
              points={pointsAttr}
              fill="none"
              stroke={color}
              strokeOpacity={0.7}
              strokeWidth={1.5}
              strokeDasharray={DASH_FOR_STYLE[faction.borderStyle]}
            />
            <text
              x={top.x}
              y={top.y - 6}
              textAnchor="middle"
              fontSize={10}
              fill={color}
              style={{ pointerEvents: "none" }}
            >
              {faction.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
