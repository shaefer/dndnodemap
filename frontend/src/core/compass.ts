import type { CompassDir } from "../types/map";

export const ALL_DIRS: CompassDir[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Order walking counter-clockwise starting at East (angle 0), matching the
// Math.atan2 convention: angle increases counter-clockwise from the +x axis.
const CCW_FROM_EAST: CompassDir[] = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];

const TWO_PI = Math.PI * 2;
const EIGHTH_TURN = Math.PI / 4;

// Returns the exact opposite direction
export function oppositeDir(dir: CompassDir): CompassDir {
  const index = ALL_DIRS.indexOf(dir);
  return ALL_DIRS[(index + 4) % 8];
}

// Converts an angle in radians to the nearest CompassDir
// angle 0 = East, increases counter-clockwise (standard Math.atan2 convention)
export function angleToDir(radians: number): CompassDir {
  let normalized = radians % TWO_PI;
  if (normalized < 0) normalized += TWO_PI;
  const index = Math.round(normalized / EIGHTH_TURN) % 8;
  return CCW_FROM_EAST[index];
}

// Returns the dx,dy unit vector for a compass direction
// (N = dy:-1, E = dx:1, NE = dx:1 dy:-1, etc.)
export function dirToVector(dir: CompassDir): { dx: number; dy: number } {
  const vectors: Record<CompassDir, { dx: number; dy: number }> = {
    N: { dx: 0, dy: -1 },
    NE: { dx: 1, dy: -1 },
    E: { dx: 1, dy: 0 },
    SE: { dx: 1, dy: 1 },
    S: { dx: 0, dy: 1 },
    SW: { dx: -1, dy: 1 },
    W: { dx: -1, dy: 0 },
    NW: { dx: -1, dy: -1 },
  };
  return vectors[dir];
}

// Given two grid positions, returns the compass direction from a to b.
// Grid y increases downward (matches MapNode.gy), so the y term is negated
// before feeding into angleToDir's math-convention angle.
export function dirBetween(
  ax: number, ay: number,
  bx: number, by: number
): CompassDir {
  return angleToDir(Math.atan2(-(by - ay), bx - ax));
}
