import type { MapNode } from "../../types/map";
import type { NodeExit } from "../../store/mapStore";

interface TooltipProps {
  node: MapNode;
  exits: NodeExit[];
  x: number;
  y: number;
  containerWidth: number;
}

const WIDTH = 220;

// Pure display — exits are computed by the store's selectExitsForNode, not
// here, per spec Section 2 (UI must not derive map data inline).
export function Tooltip({ node, exits, x, y, containerWidth }: TooltipProps) {
  let left = x + 14;
  if (left + WIDTH > containerWidth) left = x - WIDTH - 14;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: y + 14,
        width: WIDTH,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 12,
        color: "#333",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}
    >
      <strong style={{ fontSize: 13, display: "block", marginBottom: 2 }}>{node.label}</strong>
      <div style={{ color: "#888", fontSize: 11, marginBottom: 5 }}>{node.type}</div>
      {exits.length > 0 && (
        <div style={{ borderTop: "1px solid #eee", marginTop: 5, paddingTop: 5 }}>
          {exits.map((exit, i) => (
            <div key={i}>
              {exit.direction} → {exit.label}
              {exit.checkRequired ? " ⚠" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
