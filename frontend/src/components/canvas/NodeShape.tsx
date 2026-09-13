import type { MouseEvent, ReactNode } from "react";
import type { BoundaryReason, MapNode, NodeType } from "../../types/map";
import { isOutpostBranch, isWaterBranch } from "../../store/mapStore";

// Fill/stroke per spec Section 10b, Layer 3. Shared across a NodeType's
// Tier 1.5 forks — only shape/size/stroke-style differs by fork, not color.
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
  const fill = TYPE_FILL[node.type];
  const stroke = TYPE_STROKE[node.type];

  let shape: ReactNode;
  let r: number;
  switch (node.type) {
    case "settlement": {
      const outpost = isOutpostBranch(node);
      r = outpost ? 8 : 11;
      shape = (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.8}
          strokeDasharray={outpost ? "3,2" : undefined}
        />
      );
      break;
    }
    case "wilderness": {
      if (isWaterBranch(node)) {
        r = 9;
        shape = (
          <>
            <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1} />
            <circle cx={x} cy={y} r={5} fill="none" stroke={stroke} strokeWidth={1} />
          </>
        );
      } else {
        r = 7;
        shape = <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.8} />;
      }
      break;
    }
    case "poi":
      r = 10;
      shape = (
        <polygon
          points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.8}
        />
      );
      break;
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
          fill={stroke}
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
