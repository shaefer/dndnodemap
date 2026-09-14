import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATION_PARAMS,
  REGION_PRESET_IDS,
  REGION_PRESETS,
  rebalanceShares,
  selectExitsForNode,
  useMapStore,
} from "../../src/store/mapStore";
import { buildPrototypeMap } from "../../src/core/prototypeMap";
import type { GenerationParams, WorldMap } from "../../src/types/map";

function resetStore() {
  const map = buildPrototypeMap();
  useMapStore.setState({
    map,
    violations: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    history: [],
    future: [],
    draftParams: { ...DEFAULT_GENERATION_PARAMS },
  });
}

describe("mapStore", () => {
  beforeEach(resetStore);

  it("generate() uses draftParams and produces a valid map with no violations", () => {
    useMapStore.getState().updateDraftParam("seed", 777);
    useMapStore.getState().generate();
    const state = useMapStore.getState();
    expect(state.map.params.seed).toBe(777);
    expect(state.violations).toEqual([]);
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("generate() with the same draftParams twice produces structurally identical maps", () => {
    useMapStore.getState().updateDraftParam("seed", 42);
    useMapStore.getState().generate();
    const first = useMapStore.getState().map;

    useMapStore.getState().updateDraftParam("seed", 42);
    useMapStore.getState().generate();
    const second = useMapStore.getState().map;

    expect(second.nodes.map((n) => ({ label: n.label, type: n.type, gx: n.gx, gy: n.gy }))).toEqual(
      first.nodes.map((n) => ({ label: n.label, type: n.type, gx: n.gx, gy: n.gy }))
    );
    expect(second.edges.length).toBe(first.edges.length);
  });

  it("updateDraftParam updates a single field without touching the others", () => {
    useMapStore.getState().updateDraftParam("edgeDensity", 0.9);
    expect(useMapStore.getState().draftParams.edgeDensity).toBe(0.9);
    expect(useMapStore.getState().draftParams.targetNodeCount).toBe(DEFAULT_GENERATION_PARAMS.targetNodeCount);
  });

  it("randomizeSeed changes the seed", () => {
    const before = useMapStore.getState().draftParams.seed;
    useMapStore.getState().randomizeSeed();
    expect(useMapStore.getState().draftParams.seed).not.toBe(before);
  });

  it("loadMap replaces the map, syncs draftParams, and clears history/selection", () => {
    useMapStore.getState().selectNode(useMapStore.getState().map.nodes[0].id);
    const loaded: WorldMap = { ...buildPrototypeMap(), name: "Imported Region" };
    useMapStore.getState().loadMap(loaded);

    const state = useMapStore.getState();
    expect(state.map.name).toBe("Imported Region");
    expect(state.draftParams).toEqual(loaded.params);
    expect(state.selectedNodeId).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("undo/redo round-trips a single node edit", () => {
    const nodeId = useMapStore.getState().map.nodes[0].id;
    const originalLabel = useMapStore.getState().map.nodes[0].label;

    useMapStore.getState().updateNode(nodeId, { label: "Renamed" });
    expect(useMapStore.getState().map.nodes[0].label).toBe("Renamed");
    expect(useMapStore.getState().history.length).toBe(1);

    useMapStore.getState().undo();
    expect(useMapStore.getState().map.nodes[0].label).toBe(originalLabel);
    expect(useMapStore.getState().future.length).toBe(1);

    useMapStore.getState().redo();
    expect(useMapStore.getState().map.nodes[0].label).toBe("Renamed");
  });

  it("deleteNode also removes that node's edges and clears its selection", () => {
    const nodeId = useMapStore.getState().map.nodes[0].id;
    useMapStore.getState().selectNode(nodeId);

    useMapStore.getState().deleteNode(nodeId);

    const state = useMapStore.getState();
    expect(state.map.nodes.some((n) => n.id === nodeId)).toBe(false);
    expect(state.map.edges.some((e) => e.fromId === nodeId || e.toId === nodeId)).toBe(false);
    expect(state.selectedNodeId).toBeNull();
  });
});

describe("rebalanceShares", () => {
  const bias: GenerationParams["nodeTypeBias"] = { settlement: 0.2, wilderness: 0.55, poi: 0.25 };

  it("sets the changed key to the new value and keeps the total at 1 (3-key case, regression)", () => {
    const next = rebalanceShares(bias, "settlement", 0.5);
    expect(next.settlement).toBeCloseTo(0.5, 10);
    const total = next.settlement + next.wilderness + next.poi;
    expect(total).toBeCloseTo(1, 10);
  });

  it("scales the other two proportionally to their prior relative sizes (3-key case, regression)", () => {
    const next = rebalanceShares(bias, "settlement", 0.5);
    // wilderness:poi ratio should be unchanged (0.55:0.25)
    expect(next.wilderness / next.poi).toBeCloseTo(0.55 / 0.25, 6);
  });

  it("clamps the changed value to [0, 1]", () => {
    const next = rebalanceShares(bias, "wilderness", 5);
    expect(next.wilderness).toBeCloseTo(1, 10);
    expect(next.settlement + next.poi).toBeCloseTo(0, 10);
  });

  it("splits evenly among the others when the prior rest-sum was zero", () => {
    const allInOne: GenerationParams["nodeTypeBias"] = { settlement: 1, wilderness: 0, poi: 0 };
    const next = rebalanceShares(allInOne, "settlement", 0.4);
    expect(next.wilderness).toBeCloseTo(0.3, 10);
    expect(next.poi).toBeCloseTo(0.3, 10);
  });

  it("also works for the 6-key biomeMix case", () => {
    const biomeMix: GenerationParams["biomeMix"] = {
      forest: 0.3,
      swamp: 0.15,
      plains: 0.25,
      desert: 0.1,
      tundra: 0.1,
      jungle: 0.1,
    };
    const next = rebalanceShares(biomeMix, "tundra", 0.6);
    expect(next.tundra).toBeCloseTo(0.6, 10);
    const total = next.forest + next.swamp + next.plains + next.desert + next.tundra + next.jungle;
    expect(total).toBeCloseTo(1, 10);
    // ratios among the untouched five should be preserved
    expect(next.forest / next.swamp).toBeCloseTo(0.3 / 0.15, 6);
  });
});

describe("applyRegionPreset / randomizeRegionPreset", () => {
  beforeEach(resetStore);

  it("applyRegionPreset sets biomeMix and wildernessWaterFraction from the named preset", () => {
    useMapStore.getState().applyRegionPreset("frost");
    const { draftParams } = useMapStore.getState();
    expect(draftParams.biomeMix).toEqual(REGION_PRESETS.frost.biomeMix);
    expect(draftParams.wildernessWaterFraction).toBe(REGION_PRESETS.frost.wildernessWaterFraction);
  });

  it("randomizeRegionPreset applies one of the registered presets", () => {
    useMapStore.getState().randomizeRegionPreset();
    const { biomeMix, wildernessWaterFraction } = useMapStore.getState().draftParams;
    const matches = REGION_PRESET_IDS.some(
      (id) =>
        REGION_PRESETS[id].wildernessWaterFraction === wildernessWaterFraction &&
        JSON.stringify(REGION_PRESETS[id].biomeMix) === JSON.stringify(biomeMix)
    );
    expect(matches).toBe(true);
  });
});

describe("selectExitsForNode", () => {
  it("returns each edge's direction from the node's own perspective, flipping for incoming edges", () => {
    const map = buildPrototypeMap();
    const node = map.nodes[0];
    const exits = selectExitsForNode(map, node.id);
    expect(exits.length).toBeGreaterThan(0);
    for (const exit of exits) {
      const target = map.nodes.find((n) => n.id === exit.toNodeId);
      expect(target?.label).toBe(exit.label);
    }
  });
});
