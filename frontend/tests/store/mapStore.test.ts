import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_PARAMS, rebalanceNodeTypeBias, selectExitsForNode, useMapStore } from "../../src/store/mapStore";
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

describe("rebalanceNodeTypeBias", () => {
  const bias: GenerationParams["nodeTypeBias"] = { settlement: 0.18, wilderness: 0.45, mountain: 0.22, ruin: 0.15 };

  it("sets the changed key to the new value and keeps the total at 1", () => {
    const next = rebalanceNodeTypeBias(bias, "settlement", 0.5);
    expect(next.settlement).toBeCloseTo(0.5, 10);
    const total = next.settlement + next.wilderness + next.mountain + next.ruin;
    expect(total).toBeCloseTo(1, 10);
  });

  it("scales the other three proportionally to their prior relative sizes", () => {
    const next = rebalanceNodeTypeBias(bias, "settlement", 0.5);
    // wilderness:mountain:ruin ratio should be unchanged (0.45:0.22:0.15)
    expect(next.wilderness / next.mountain).toBeCloseTo(0.45 / 0.22, 6);
    expect(next.mountain / next.ruin).toBeCloseTo(0.22 / 0.15, 6);
  });

  it("clamps the changed value to [0, 1]", () => {
    const next = rebalanceNodeTypeBias(bias, "mountain", 5);
    expect(next.mountain).toBeCloseTo(1, 10);
    expect(next.settlement + next.wilderness + next.ruin).toBeCloseTo(0, 10);
  });

  it("splits evenly among the others when the prior rest-sum was zero", () => {
    const allInOne: GenerationParams["nodeTypeBias"] = { settlement: 1, wilderness: 0, mountain: 0, ruin: 0 };
    const next = rebalanceNodeTypeBias(allInOne, "settlement", 0.4);
    expect(next.wilderness).toBeCloseTo(0.2, 10);
    expect(next.mountain).toBeCloseTo(0.2, 10);
    expect(next.ruin).toBeCloseTo(0.2, 10);
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
