import { MapCanvas } from "../components/canvas/MapCanvas";
import { GeneratePanel } from "../components/panels/GeneratePanel";

export function MapApp() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex" }}>
      <GeneratePanel />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MapCanvas />
      </div>
    </div>
  );
}
