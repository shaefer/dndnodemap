import { describe, expect, it } from "vitest";
import { centroid, convexHull, padHull } from "../../src/core/geometry";

describe("convexHull", () => {
  it("passes through fewer than 3 points unchanged", () => {
    expect(convexHull([])).toEqual([]);
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    expect(convexHull([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  });

  it("returns exactly the 4 corners for a square, dropping interior/edge points", () => {
    const points = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior — must be dropped
      { x: 5, y: 0 }, // on an edge — must be dropped (collinear)
    ];
    const hull = convexHull(points);
    expect(hull).toHaveLength(4);
    for (const corner of [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]) {
      expect(hull).toContainEqual(corner);
    }
  });

  it("is invariant to input order", () => {
    const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const shuffled = [points[2], points[0], points[3], points[1]];
    const a = convexHull(points).slice().sort((p, q) => p.x - q.x || p.y - q.y);
    const b = convexHull(shuffled).slice().sort((p, q) => p.x - q.x || p.y - q.y);
    expect(a).toEqual(b);
  });

  it("produces a polygon with positive (counter-clockwise) signed area", () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]);
    let signedArea = 0;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      signedArea += a.x * b.y - b.x * a.y;
    }
    expect(signedArea).toBeGreaterThan(0);
  });
});

describe("padHull", () => {
  it("expands every point away from the centroid", () => {
    const hull = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const center = centroid(hull);
    const padded = padHull(hull, 5);
    for (let i = 0; i < hull.length; i++) {
      const before = Math.hypot(hull[i].x - center.x, hull[i].y - center.y);
      const after = Math.hypot(padded[i].x - center.x, padded[i].y - center.y);
      expect(after).toBeGreaterThan(before);
    }
  });

  it("returns an empty array unchanged", () => {
    expect(padHull([], 5)).toEqual([]);
  });
});

describe("centroid", () => {
  it("computes the average position", () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }])).toEqual({ x: 5, y: 10 / 3 });
  });

  it("returns the origin for an empty array", () => {
    expect(centroid([])).toEqual({ x: 0, y: 0 });
  });
});
