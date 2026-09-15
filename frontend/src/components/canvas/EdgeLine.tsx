import type { ConnectionType, MapEdge } from "../../types/map";

// Per spec Section 10b, Layer 2.
const CONNECTION_STYLE: Record<ConnectionType, { stroke: string; width: number; dash?: string; opacity: number }> = {
  road: { stroke: "#888780", width: 1.5, opacity: 1 },
  trail: { stroke: "#888780", width: 1, opacity: 0.7 },
  pass: { stroke: "#888780", width: 1.5, opacity: 1 },
  river_ford: { stroke: "#185FA5", width: 1.5, opacity: 1 },
  sea_route: { stroke: "#185FA5", width: 1.5, dash: "6,3", opacity: 1 },
  seasonal: { stroke: "#888780", width: 1, dash: "2,3", opacity: 1 },
};

const CHECK_OVERLAY_COLOR = "#D85A30";

interface EdgeLineProps {
  edge: MapEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  showDirection: boolean;
}

export function EdgeLine({ edge, x1, y1, x2, y2, showDirection }: EdgeLineProps) {
  const style = CONNECTION_STYLE[edge.connectionType];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={style.stroke}
        strokeWidth={style.width}
        strokeDasharray={style.dash}
        opacity={style.opacity}
      />
      {edge.checkRequired && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={CHECK_OVERLAY_COLOR}
          strokeWidth={style.width}
          strokeDasharray="6,5"
          opacity={0.85}
        />
      )}
      {edge.connectionType === "pass" && (
        <text
          x={mx}
          y={my - 14}
          textAnchor="middle"
          fontSize={9}
          fill={style.stroke}
          style={{ pointerEvents: "none" }}
        >
          ▲
        </text>
      )}
      {showDirection && (
        <text
          x={mx}
          y={my - 5}
          textAnchor="middle"
          fontSize={9}
          fill={edge.checkRequired ? CHECK_OVERLAY_COLOR : style.stroke}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          {edge.direction}
        </text>
      )}
    </g>
  );
}
