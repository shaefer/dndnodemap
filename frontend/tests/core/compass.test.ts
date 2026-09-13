import { describe, expect, it } from "vitest";
import { ALL_DIRS, angleToDir, dirBetween, dirToVector, oppositeDir } from "../../src/core/compass";
import type { CompassDir } from "../../src/types/map";

describe("oppositeDir", () => {
  it("is its own inverse for all 8 directions", () => {
    for (const dir of ALL_DIRS) {
      expect(oppositeDir(oppositeDir(dir))).toBe(dir);
    }
  });

  it("never returns the same direction it was given", () => {
    for (const dir of ALL_DIRS) {
      expect(oppositeDir(dir)).not.toBe(dir);
    }
  });

  const pairs: [CompassDir, CompassDir][] = [
    ["N", "S"],
    ["NE", "SW"],
    ["E", "W"],
    ["SE", "NW"],
  ];
  it.each(pairs)("maps %s to %s", (a, b) => {
    expect(oppositeDir(a)).toBe(b);
    expect(oppositeDir(b)).toBe(a);
  });
});

describe("angleToDir", () => {
  it("maps the 8 quadrant midpoints correctly", () => {
    const cases: [number, CompassDir][] = [
      [0, "E"],
      [Math.PI / 4, "NE"],
      [Math.PI / 2, "N"],
      [(3 * Math.PI) / 4, "NW"],
      [Math.PI, "W"],
      [(5 * Math.PI) / 4, "SW"],
      [(3 * Math.PI) / 2, "S"],
      [(7 * Math.PI) / 4, "SE"],
    ];
    for (const [radians, expected] of cases) {
      expect(angleToDir(radians)).toBe(expected);
    }
  });

  it("wraps negative angles correctly", () => {
    expect(angleToDir(-Math.PI / 2)).toBe("S");
  });

  it("wraps angles beyond a full turn correctly", () => {
    expect(angleToDir(2 * Math.PI + Math.PI / 2)).toBe("N");
  });
});

describe("dirToVector", () => {
  it("returns the correct unit vector for each direction", () => {
    expect(dirToVector("N")).toEqual({ dx: 0, dy: -1 });
    expect(dirToVector("E")).toEqual({ dx: 1, dy: 0 });
    expect(dirToVector("S")).toEqual({ dx: 0, dy: 1 });
    expect(dirToVector("W")).toEqual({ dx: -1, dy: 0 });
    expect(dirToVector("NE")).toEqual({ dx: 1, dy: -1 });
    expect(dirToVector("SE")).toEqual({ dx: 1, dy: 1 });
    expect(dirToVector("SW")).toEqual({ dx: -1, dy: 1 });
    expect(dirToVector("NW")).toEqual({ dx: -1, dy: -1 });
  });
});

describe("dirBetween", () => {
  it("is correct for all 8 relative positions", () => {
    expect(dirBetween(0, 0, 1, 0)).toBe("E");
    expect(dirBetween(0, 0, 1, -1)).toBe("NE");
    expect(dirBetween(0, 0, 0, -1)).toBe("N");
    expect(dirBetween(0, 0, -1, -1)).toBe("NW");
    expect(dirBetween(0, 0, -1, 0)).toBe("W");
    expect(dirBetween(0, 0, -1, 1)).toBe("SW");
    expect(dirBetween(0, 0, 0, 1)).toBe("S");
    expect(dirBetween(0, 0, 1, 1)).toBe("SE");
  });

  it("agrees with dirToVector: moving one step in a direction reports that direction", () => {
    for (const dir of ALL_DIRS) {
      const { dx, dy } = dirToVector(dir);
      expect(dirBetween(5, 5, 5 + dx, 5 + dy)).toBe(dir);
    }
  });
});
