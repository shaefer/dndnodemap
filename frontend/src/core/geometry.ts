// Generic 2D geometry helpers, used by both the live canvas (via a
// store/mapStore.ts re-export — components/ cannot import core/ directly,
// spec Section 2) and exporter.ts's toSVGString, so the two rendering paths
// share one implementation of "what's the hull around these points."

export interface Point {
  x: number;
  y: number;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Standard monotone-chain convex hull. Returns points in counter-clockwise
// order. Fewer than 3 distinct points just pass through unchanged (a hull
// isn't a meaningful polygon yet).
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// Expands a hull outward from its centroid by a fixed pixel amount — an
// approximation of a true polygon offset (Minkowski sum), simple and good
// enough at the small padding values Layer 1 (faction territory) needs so
// its border doesn't clip node shapes.
export function padHull(hull: Point[], padding: number): Point[] {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((sum, p) => sum + p.x, 0) / hull.length;
  const cy = hull.reduce((sum, p) => sum + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / dist) * padding, y: p.y + (dy / dist) * padding };
  });
}

export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

// "About double the linear dimension needed to just fit the nodes" — gives
// placement room to breathe so tight local clusters (a source of both the
// long-repair-edge and direction-collision bugs) are statistically rarer.
// Square only; aspect-ratio/shape control is a separate, not-yet-built idea.
const GRID_LINEAR_FACTOR = 2;

export function recommendedGridDimensions(targetNodeCount: number): { gridCols: number; gridRows: number } {
  const side = Math.ceil(Math.sqrt(targetNodeCount)) * GRID_LINEAR_FACTOR;
  return { gridCols: side, gridRows: side };
}

// The radial (core-out) placement algorithm's own grid-sizing formula (spec
// Section 7e). core/radialGenerator.ts is the sole consumer for actual
// generation; store/mapStore.ts re-exports this same function so
// GeneratePanel.tsx can show the *same* derived size read-only (radial mode
// doesn't expose gridCols/gridRows as tunable sliders — the grid is a
// consequence of node count, not an independent input) without UI and
// generator ever computing it two different ways.
//
// Sized by AREA, the same way recommendedGridDimensions is, rather than by
// "arms x steps outward": once the M4.8 correction replaced literal
// fixed-radius spokes with organic maze-style growth, arm count stopped
// having anything to do with how far the map spreads — total node count is
// what determines the area needed. An earlier arms-based formula badly
// over-sized the grid (the maze filled maybe a third of it, leaving dead
// margins on the canvas and keeping nodes from ever reaching the outer
// radius bands where boundary markers are placed).
//
// Forced odd so there's a true center cell for the core settlement to sit
// on — the one structural requirement the radial algorithm has of its grid.
export function recommendedRadialGridDimensions(targetNodeCount: number): { gridCols: number; gridRows: number } {
  const base = Math.ceil(Math.sqrt(Math.max(1, targetNodeCount))) * GRID_LINEAR_FACTOR;
  const side = base % 2 === 0 ? base + 1 : base;
  return { gridCols: side, gridRows: side };
}
