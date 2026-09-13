import { describe, expect, it } from "vitest";
import {
  edgesForNode,
  freeDirections,
  hopCount,
  isConnected,
  maxHopsFrom,
  unreachableFrom,
  usedDirections,
} from "../../src/core/graph";
import type { MapEdge, MapNode } from "../../src/types/map";

function node(id: string): MapNode {
  return { id, label: id, type: "wilderness", gx: 0, gy: 0 };
}

function edge(fromId: string, toId: string, direction: MapEdge["direction"]): MapEdge {
  return {
    id: `${fromId}->${toId}`,
    fromId,
    toId,
    direction,
    connectionType: "trail",
    checkRequired: false,
  };
}

describe("isConnected", () => {
  it("is true for a path graph", () => {
    const nodes = ["a", "b", "c", "d"].map(node);
    const edges = [edge("a", "b", "E"), edge("b", "c", "E"), edge("c", "d", "E")];
    expect(isConnected(nodes, edges)).toBe(true);
  });

  it("is false for a disconnected graph", () => {
    const nodes = ["a", "b", "c", "d"].map(node);
    const edges = [edge("a", "b", "E"), edge("c", "d", "E")];
    expect(isConnected(nodes, edges)).toBe(false);
  });

  it("is true for a single node with no edges", () => {
    expect(isConnected([node("a")], [])).toBe(true);
  });
});

describe("unreachableFrom", () => {
  it("returns the ids not reachable from the start node", () => {
    const nodes = ["a", "b", "c", "d"].map(node);
    const edges = [edge("a", "b", "E"), edge("c", "d", "E")];
    expect(unreachableFrom("a", nodes, edges).sort()).toEqual(["c", "d"]);
  });

  it("returns an empty array when the graph is fully connected", () => {
    const nodes = ["a", "b", "c"].map(node);
    const edges = [edge("a", "b", "E"), edge("b", "c", "E")];
    expect(unreachableFrom("a", nodes, edges)).toEqual([]);
  });
});

describe("hopCount", () => {
  it("is correct on a known graph", () => {
    const edges = [edge("a", "b", "E"), edge("b", "c", "E"), edge("c", "d", "E")];
    expect(hopCount("a", "d", edges)).toBe(3);
    expect(hopCount("a", "a", edges)).toBe(0);
    // Edges are undirected for travel — reverse direction is still one hop.
    expect(hopCount("d", "a", edges)).toBe(3);
  });

  it("returns -1 when there is no path", () => {
    const edges = [edge("a", "b", "E"), edge("c", "d", "E")];
    expect(hopCount("a", "d", edges)).toBe(-1);
  });
});

describe("maxHopsFrom", () => {
  it("returns the farthest reachable hop count", () => {
    const edges = [edge("a", "b", "E"), edge("b", "c", "E"), edge("c", "d", "E")];
    expect(maxHopsFrom("a", edges)).toBe(3);
  });

  it("returns 0 for a node with no edges", () => {
    expect(maxHopsFrom("a", [])).toBe(0);
  });
});

describe("edgesForNode", () => {
  it("returns edges regardless of which end the node is on", () => {
    const edges = [edge("a", "b", "E"), edge("c", "a", "N")];
    expect(edgesForNode("a", edges)).toHaveLength(2);
    expect(edgesForNode("b", edges)).toHaveLength(1);
  });
});

describe("usedDirections", () => {
  it("uses the stored direction when the node is fromId", () => {
    const edges = [edge("a", "b", "E")];
    expect(usedDirections("a", edges)).toEqual(["E"]);
  });

  it("uses the opposite direction when the node is toId", () => {
    const edges = [edge("a", "b", "E")];
    expect(usedDirections("b", edges)).toEqual(["W"]);
  });
});

describe("freeDirections", () => {
  it("never returns a direction already used", () => {
    const edges = [edge("a", "b", "E"), edge("a", "c", "N")];
    const free = freeDirections("a", edges);
    expect(free).not.toContain("E");
    expect(free).not.toContain("N");
    expect(free).toHaveLength(6);
  });

  it("returns all 8 directions for an isolated node", () => {
    expect(freeDirections("a", [])).toHaveLength(8);
  });
});
