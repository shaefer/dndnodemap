import type { MouseEvent, ReactNode } from "react";
import type { MapNode, NodeType } from "../../types/map";

// Fill/stroke and shape per spec Section 10b, Layer 3.
const TYPE_FILL: Record<NodeType, string> = {
  settlement: "#5DCAA5",
  wilderness: "#85B7EB",
  mountain: "#B4B2A9",
  ruin: "#EF9F27",
  water: "#7EC8E3",
};
const TYPE_STROKE: Record<NodeType, string> = {
  settlement: "#0F6E56",
  wilderness: "#185FA5",
  mountain: "#5F5E5A",
  ruin: "#BA7517",
  water: "#0F6E56",
};

// Half-extent of each shape, used both for drawing and for offsetting the
// label below it.
const RADIUS: Record<NodeType, number> = {
  settlement: 11,
  wilderness: 7,
  mountain: 9,
  ruin: 10,
  water: 9,
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
  const r = RADIUS[node.type];

  let shape: ReactNode;
  switch (node.type) {
    case "settlement":
    case "wilderness":
      shape = <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.8} />;
      break;
    case "mountain":
      shape = (
        <rect
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
          rx={2}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      );
      break;
    case "ruin":
      shape = (
        <polygon
          points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.8}
        />
      );
      break;
    case "water":
      shape = (
        <>
          <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1} />
          <circle cx={x} cy={y} r={5} fill="none" stroke={stroke} strokeWidth={1} />
        </>
      );
      break;
  }

  return (
    <g style={{ cursor: "pointer" }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {shape}
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
