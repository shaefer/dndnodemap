interface ToolbarProps {
  terrainVisible: boolean;
  factionsVisible: boolean;
  hasTerrainData: boolean;
  hasFactionData: boolean;
  onToggleTerrain: () => void;
  onToggleFactions: () => void;
}

const buttonStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  background: active ? "#e8e4d8" : "#fff",
  color: disabled ? "#bbb" : "#333",
  cursor: disabled ? "default" : "pointer",
});

// Spec Section 10b's layer toggle UI. Edges/Nodes are always on (shown
// disabled — there's no state to toggle since they're never hideable).
// Terrain/Factions are greyed out with a tooltip when that extension has no
// data yet, per spec. Toggling here is pure UI state — it never touches
// WorldMap data (mapStore's undo stack is unaffected).
export function Toolbar({
  terrainVisible,
  factionsVisible,
  hasTerrainData,
  hasFactionData,
  onToggleTerrain,
  onToggleFactions,
}: ToolbarProps) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderBottom: "1px solid #eee", background: "#fff" }}>
      <button type="button" disabled style={buttonStyle(true, true)}>
        ≡ Edges
      </button>
      <button type="button" disabled style={buttonStyle(true, true)}>
        ◉ Nodes
      </button>
      <button
        type="button"
        disabled={!hasTerrainData}
        onClick={onToggleTerrain}
        title={hasTerrainData ? undefined : "No terrain zones defined yet."}
        style={buttonStyle(terrainVisible, !hasTerrainData)}
      >
        ⬡ Terrain
      </button>
      <button
        type="button"
        disabled={!hasFactionData}
        onClick={onToggleFactions}
        title={hasFactionData ? undefined : "No factions defined yet."}
        style={buttonStyle(factionsVisible, !hasFactionData)}
      >
        ⚑ Factions
      </button>
    </div>
  );
}
