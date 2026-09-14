import { useRef, useState } from "react";
import { toJSON } from "../../core/exporter";
import {
  REGION_PRESET_IDS,
  REGION_PRESETS,
  rebalanceShares,
  useMapStore,
  type RegionPresetId,
} from "../../store/mapStore";
import type { GenerationParams } from "../../types/map";

interface RangeRowProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
}

function RangeRow({ label, min, max, step = 1, value, displayValue, onChange }: RangeRowProps) {
  return (
    <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: "#888" }}>{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}

const BIAS_LABELS: Record<keyof GenerationParams["nodeTypeBias"], string> = {
  settlement: "Settlements",
  wilderness: "Wilderness",
  poi: "Points of Interest",
};

const BIOME_LABELS: Record<keyof GenerationParams["biomeMix"], string> = {
  forest: "Forest",
  swamp: "Swamp",
  plains: "Plains",
  desert: "Desert",
  tundra: "Tundra",
  jungle: "Jungle",
};

export function GeneratePanel() {
  const draftParams = useMapStore((s) => s.draftParams);
  const map = useMapStore((s) => s.map);
  const generate = useMapStore((s) => s.generate);
  const loadMap = useMapStore((s) => s.loadMap);
  const updateDraftParam = useMapStore((s) => s.updateDraftParam);
  const randomizeSeed = useMapStore((s) => s.randomizeSeed);
  const applyRegionPreset = useMapStore((s) => s.applyRegionPreset);
  const randomizeRegionPreset = useMapStore((s) => s.randomizeRegionPreset);
  const applyRecommendedGridSize = useMapStore((s) => s.applyRecommendedGridSize);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  function handleBiasChange(key: keyof GenerationParams["nodeTypeBias"], percent: number) {
    const rebalanced = rebalanceShares(draftParams.nodeTypeBias, key, percent / 100);
    updateDraftParam("nodeTypeBias", rebalanced);
  }

  function handleBiomeChange(key: keyof GenerationParams["biomeMix"], percent: number) {
    const rebalanced = rebalanceShares(draftParams.biomeMix, key, percent / 100);
    updateDraftParam("biomeMix", rebalanced);
  }

  function handleDownloadJSON() {
    const blob = new Blob([toJSON(map)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyLink() {
    // The address bar already reflects the current map (generate()/loadMap()
    // call writeShareCodeToUrl) — this just copies it. Direct browser API
    // call here, not routed through the store, matching handleDownloadJSON's
    // precedent: a one-shot UI-triggered side effect, not app state.
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setLinkError(null);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => setLinkError("Couldn't copy the link — copy it from the address bar instead."));
  }

  function handleImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file twice in a row
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges) || !parsed?.params) {
          throw new Error("File does not look like an Overworld Node Map export.");
        }
        loadMap(parsed);
        setImportError(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Could not parse that file.");
      }
    };
    reader.onerror = () => setImportError("Could not read that file.");
    reader.readAsText(file);
  }

  return (
    <div style={{ padding: 16, width: 300, boxSizing: "border-box", overflowY: "auto", height: "100%", borderRight: "1px solid #eee" }}>
      <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Generate</h2>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Map shape</div>
        <RangeRow
          label="Node count"
          min={20}
          max={80}
          value={draftParams.targetNodeCount}
          displayValue={String(draftParams.targetNodeCount)}
          onChange={(v) => updateDraftParam("targetNodeCount", v)}
        />
        <RangeRow
          label="Grid cols"
          min={6}
          max={20}
          value={draftParams.gridCols}
          displayValue={String(draftParams.gridCols)}
          onChange={(v) => updateDraftParam("gridCols", v)}
        />
        <RangeRow
          label="Grid rows"
          min={5}
          max={20}
          value={draftParams.gridRows}
          displayValue={String(draftParams.gridRows)}
          onChange={(v) => updateDraftParam("gridRows", v)}
        />
        <button type="button" onClick={applyRecommendedGridSize} style={{ fontSize: 12 }}>
          Auto-size grid
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Node type frequency</div>
        {(Object.keys(BIAS_LABELS) as (keyof GenerationParams["nodeTypeBias"])[]).map((key) => (
          <RangeRow
            key={key}
            label={BIAS_LABELS[key]}
            min={0}
            max={100}
            value={Math.round(draftParams.nodeTypeBias[key] * 100)}
            displayValue={`${Math.round(draftParams.nodeTypeBias[key] * 100)}%`}
            onChange={(v) => handleBiasChange(key, v)}
          />
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Traversal</div>
        <RangeRow
          label="Edge density (Sparse → Dense)"
          min={0}
          max={100}
          value={Math.round(draftParams.edgeDensity * 100)}
          displayValue={`${Math.round(draftParams.edgeDensity * 100)}%`}
          onChange={(v) => updateDraftParam("edgeDensity", v / 100)}
        />
        <RangeRow
          label="Difficulty (Easy → Hard)"
          min={0}
          max={100}
          value={Math.round(draftParams.checkRequiredFraction * 100)}
          displayValue={`${Math.round(draftParams.checkRequiredFraction * 100)}%`}
          onChange={(v) => updateDraftParam("checkRequiredFraction", v / 100)}
        />
        <RangeRow
          label="Boundary containment (Open → Closed)"
          min={0}
          max={100}
          value={Math.round(draftParams.boundaryFraction * 100)}
          displayValue={`${Math.round(draftParams.boundaryFraction * 100)}%`}
          onChange={(v) => updateDraftParam("boundaryFraction", v / 100)}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Tier 1.5 forks</div>
        <RangeRow
          label="Water (of Wilderness)"
          min={0}
          max={100}
          value={Math.round(draftParams.wildernessWaterFraction * 100)}
          displayValue={`${Math.round(draftParams.wildernessWaterFraction * 100)}%`}
          onChange={(v) => updateDraftParam("wildernessWaterFraction", v / 100)}
        />
        <RangeRow
          label="Outpost (of Settlement)"
          min={0}
          max={100}
          value={Math.round(draftParams.settlementOutpostFraction * 100)}
          displayValue={`${Math.round(draftParams.settlementOutpostFraction * 100)}%`}
          onChange={(v) => updateDraftParam("settlementOutpostFraction", v / 100)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={draftParams.generateTerrainZones}
            onChange={(e) => updateDraftParam("generateTerrainZones", e.target.checked)}
          />
          Generate terrain zones
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Biome mix</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyRegionPreset(e.target.value as RegionPresetId);
              e.target.value = "";
            }}
            style={{ flex: 1, fontSize: 12 }}
          >
            <option value="" disabled>
              Region preset…
            </option>
            {REGION_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {REGION_PRESETS[id].label}
              </option>
            ))}
          </select>
          <button type="button" onClick={randomizeRegionPreset} style={{ fontSize: 12 }}>
            Randomize
          </button>
        </div>
        {(Object.keys(BIOME_LABELS) as (keyof GenerationParams["biomeMix"])[]).map((key) => (
          <RangeRow
            key={key}
            label={BIOME_LABELS[key]}
            min={0}
            max={100}
            value={Math.round(draftParams.biomeMix[key] * 100)}
            displayValue={`${Math.round(draftParams.biomeMix[key] * 100)}%`}
            onChange={(v) => handleBiomeChange(key, v)}
          />
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Seed</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            type="number"
            min={0}
            max={4294967295}
            value={draftParams.seed}
            onChange={(e) => {
              const v = Math.max(0, Math.min(4294967295, Number(e.target.value) || 0));
              updateDraftParam("seed", v);
            }}
            style={{ flex: 1, fontSize: 12 }}
          />
          <button type="button" onClick={randomizeSeed} style={{ fontSize: 12 }}>
            Randomize
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={generate}
        style={{ width: "100%", padding: "8px 0", fontSize: 13, fontWeight: 600, marginBottom: 8 }}
      >
        Generate
      </button>

      <div style={{ marginBottom: 20 }}>
        <button type="button" onClick={handleCopyLink} style={{ width: "100%", padding: "6px 0", fontSize: 12 }}>
          {linkCopied ? "Copied!" : "Copy Link"}
        </button>
        {linkError && <div style={{ color: "#D85A30", fontSize: 11, marginTop: 4 }}>{linkError}</div>}
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Export / Import</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <button type="button" onClick={handleDownloadJSON} style={{ flex: 1, fontSize: 12 }}>
            Download JSON
          </button>
          <button type="button" onClick={handleImportClick} style={{ flex: 1, fontSize: 12 }}>
            Import JSON
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: "none" }} />
        {importError && <div style={{ color: "#D85A30", fontSize: 11, marginTop: 4 }}>{importError}</div>}
      </div>
    </div>
  );
}
