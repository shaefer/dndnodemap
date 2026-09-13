import type { TerrainZone } from "../../types/extensions";
import type { MapNode } from "../../types/map";
import { centroid, convexHull } from "../../store/mapStore";

// Default terrain wash colors per spec Section 10b, Layer 0. Distinct from
// (but same hue family as) NodeShape.tsx's solid node-fill colors — a wash
// is a low-opacity zone-level backdrop, not a node's own color.
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

interface TerrainWashProps {
  zones: TerrainZone[];
  nodeById: Map<string, MapNode>;
  project: (node: MapNode) => { x: number; y: number };
}

export function TerrainWash({ zones, nodeById, project }: TerrainWashProps) {
  return (
    <g>
      {zones.map((zone) => {
        const points = zone.nodeIds
          .map((id) => nodeById.get(id))
          .filter((n): n is MapNode => !!n)
          .map(project);
        const hull = convexHull(points);
        if (hull.length < 3) return null; // too few members to read as a region

        const isWater = WATER_TERRAINS.has(zone.terrain);
        const color = WASH_COLOR[zone.terrain] ?? WASH_COLOR.forest;
        const opacity = WASH_OPACITY[zone.terrain] ?? 0.12;
        const center = centroid(hull);
        const pointsAttr = hull.map((p) => `${p.x},${p.y}`).join(" ");

        return (
          <g key={zone.id}>
            <polygon
              points={pointsAttr}
              fill={isWater ? color : color}
              fillOpacity={opacity}
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={0.5}
              strokeDasharray={isWater ? "4,3" : "3,3"}
            />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              fontSize={9}
              fontStyle="italic"
              fill={color}
              opacity={0.7}
              style={{ pointerEvents: "none" }}
            >
              {zone.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
