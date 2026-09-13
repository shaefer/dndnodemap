import type { MouseEvent, ReactNode } from "react";
import type { BoundaryReason, MapNode } from "../../types/map";
import { isOutpostBranch, isWaterBranch } from "../../store/mapStore";

// Fill/stroke per spec Section 10b, Layer 3.
const SETTLEMENT_COLOR = { fill: "#F2C14E", stroke: "#9C6B0A" };
const WATER_COLOR = { fill: "#185FA5", stroke: "#0F3D6B" };
const POI_COLOR = { fill: "#8B5FBF", stroke: "#5C3D80" };

// Wilderness land-branch color varies by Biome subtype — the one place color
// carries meaning within a Tier 1 type, since biome identity is exactly what
// a DM wants to read at a glance. Falls back to a plain green for a
// land-branch node with no subtype yet (shouldn't happen post-M4.6, but a
// hand-edited or imported map could have one).
const BIOME_COLOR: Record<string, { fill: string; stroke: string }> = {
  forest: { fill: "#3B6D11", stroke: "#24430A" },
  swamp: { fill: "#5F6B2A", stroke: "#3D4519" },
  desert: { fill: "#BA7517", stroke: "#8A5710" },
  plains: { fill: "#C9C93D", stroke: "#8F8F22" },
  tundra: { fill: "#A8A8A0", stroke: "#5F5E5A" },
  jungle: { fill: "#27500A", stroke: "#173206" },
};
const DEFAULT_LAND_COLOR = BIOME_COLOR.forest;

const BOUNDARY_GLYPH: Record<BoundaryReason, string> = {
  mountain_range: "▲",
  coastline: "〜",
  canyon_void: "⌇",
  magical_barrier: "✦",
};

interface NodeShapeProps {
  node: MapNode;
  x: number;
  y: number;
  onMouseEnter?: (e: MouseEvent<SVGGElement>) => void;
  onMouseLeave?: (e: MouseEvent<SVGGElement>) => void;
}

export function NodeShape({ node, x, y, onMouseEnter, onMouseLeave }: NodeShapeProps) {
  let shape: ReactNode;
  let r: number;
  let badgeColor: string;

  switch (node.type) {
    case "settlement": {
      const outpost = isOutpostBranch(node);
      const { fill, stroke } = SETTLEMENT_COLOR;
      badgeColor = stroke;
      if (outpost) {
        r = 8;
        shape = (
          <polygon
            points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.8}
          />
        );
      } else {
        r = 11;
        shape = <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={2} fill={fill} stroke={stroke} strokeWidth={1.8} />;
      }
      break;
    }
    case "wilderness": {
      if (isWaterBranch(node)) {
        r = 9;
        const { fill, stroke } = WATER_COLOR;
        badgeColor = stroke;
        shape = (
          <>
            <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1} />
            <circle cx={x} cy={y} r={5} fill="none" stroke={stroke} strokeWidth={1} />
          </>
        );
      } else {
        r = 7;
        const { fill, stroke } = (node.subtype && BIOME_COLOR[node.subtype]) || DEFAULT_LAND_COLOR;
        badgeColor = stroke;
        shape = <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.8} />;
      }
      break;
    }
    case "poi": {
      r = 10;
      const { fill, stroke } = POI_COLOR;
      badgeColor = stroke;
      shape = (
        <polygon
          points={`${x},${y - r} ${x + r * 0.9},${y + r * 0.6} ${x - r * 0.9},${y + r * 0.6}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.8}
        />
      );
      break;
    }
  }

  return (
    <g style={{ cursor: "pointer" }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {shape}
      {node.boundary && (
        <text
          x={x + r * 0.7}
          y={y - r * 0.7}
          textAnchor="middle"
          fontSize={9}
          fill={badgeColor}
          style={{ pointerEvents: "none" }}
        >
          {BOUNDARY_GLYPH[node.boundary.reason]}
        </text>
      )}
      <text
        x={x}
        y={y + r + 12}
        textAnchor="middle"
        fontSize={10}
        fontWeight={500}
        fill="#444"
        style={{ pointerEvents: "none" }}
      >
        {node.label}
      </text>
    </g>
  );
}
