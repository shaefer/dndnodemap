interface ToolbarProps {
  terrainVisible: boolean;
  factionsVisible: boolean;
  hasTerrainData: boolean;
  hasFactionData: boolean;
  onToggleTerrain: () => void;
  onToggleFactions: () => void;
  directionLabelsVisible: boolean;
  onToggleDirectionLabels: () => void;
  onDownloadImage: () => void;
  imageExportError?: string | null;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToViewport: () => void;
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
  directionLabelsVisible,
  onToggleDirectionLabels,
  onDownloadImage,
  imageExportError,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToViewport,
}: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderBottom: "1px solid #eee",
        background: "#fff",
      }}
    >
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
      <button
        type="button"
        onClick={onToggleDirectionLabels}
        title="Show/hide the compass-direction label on each path"
        style={buttonStyle(directionLabelsVisible, false)}
      >
        ⇢ Directions
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
        <button
          type="button"
          onClick={onDownloadImage}
          title="Download a PNG picture of the map, matching what's currently shown"
          style={buttonStyle(false, false)}
        >
          ⬇ Image
        </button>
        {imageExportError && <span style={{ color: "#D85A30", fontSize: 11 }}>{imageExportError}</span>}
        <button type="button" onClick={onFitToViewport} title="Fit the whole map to the viewport" style={buttonStyle(false, false)}>
          ⛶ Fit
        </button>
        <button type="button" onClick={onZoomOut} title="Zoom out" style={buttonStyle(false, false)}>
          −
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Reset zoom to 100%"
          style={{ ...buttonStyle(false, false), minWidth: 48, textAlign: "center" }}
        >
          {zoomPercent}%
        </button>
        <button type="button" onClick={onZoomIn} title="Zoom in" style={buttonStyle(false, false)}>
          +
        </button>
      </div>
    </div>
  );
}
