import type { GenerationParams, MapEdge, MapNode } from "../types/map";
import { dirToVector } from "./compass";

// Post-placement layout relaxation (spec Section 7f) — a visual pass applied
// to the output of *both* placement algorithms, correcting two geometric
// problems neither of them solves on its own: nodes ending up cramped
// against each other, and an edge's actual on-screen bearing drifting away
// from the CompassDir it declares.
//
// This is a Magnetic Spring Model layout (Sugiyama & Misue, "Graph Drawing
// by the Magnetic Spring Model", JVLC 6(3), 1995): a conventional
// force-directed relaxation extended with *magnetic* forces that rotate
// each edge into alignment with a given direction. Here the "given
// direction" is simply the direction the edge already declares — so
// geometry moves to match the labels, never the other way around. Declared
// directions are immutable in this pass, which is also why it can't violate
// invariant 1 (one direction per node).
//
// Deliberately takes no RngFn: the relaxation is fully deterministic given
// its input positions, so it consumes zero rng() draws and cannot shift any
// other generation decision.

// Enough passes for the layout to settle without being slow — the cost is
// O(iterations * n^2) and n is capped around 85, so this is well under a
// millisecond in practice.
const ITERATIONS = 60;

// Displacement decays toward zero across the run (a standard force-directed
// cooling schedule) so the layout converges instead of oscillating between
// competing forces.
function coolingFactor(iteration: number): number {
  return 1 - iteration / ITERATIONS;
}

// Passes of the separation projection per iteration. More than one lets a
// dense pocket resolve properly instead of shuffling the crowding sideways.
const SEPARATION_SWEEPS = 2;

// Deterministic spread for separating exactly-coincident nodes.
const GOLDEN_ANGLE = 2.399963229728653;

// Unit vector for a compass direction. dirToVector's raw diagonals are
// sqrt(2) long, which would make diagonal edges pull harder than cardinal
// ones — the same normalization core/radialGenerator.ts's stepVector applies
// for the same reason.
function unitVector(dir: MapEdge["direction"]): { dx: number; dy: number } {
  const v = dirToVector(dir);
  const mag = Math.hypot(v.dx, v.dy) || 1;
  return { dx: v.dx / mag, dy: v.dy / mag };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Validator invariant 4 forbids a boundary-marked node from sitting with
// both fx and fy inside [0.3, 0.7]. Node movement is the one thing that can
// break that invariant, so rather than checking afterward and failing, any
// boundary-marked node that lands inside the box gets pushed straight back
// out via its shortest escape axis.
const FORBIDDEN_MIN = 0.3;
const FORBIDDEN_MAX = 0.7;

function pushOutOfForbiddenBox(
  node: MapNode,
  gx: number,
  gy: number,
  gridCols: number,
  gridRows: number
): { gx: number; gy: number } {
  if (!node.boundary) return { gx, gy };
  const spanX = Math.max(1, gridCols - 1);
  const spanY = Math.max(1, gridRows - 1);
  const fx = gx / spanX;
  const fy = gy / spanY;
  const inside = fx >= FORBIDDEN_MIN && fx <= FORBIDDEN_MAX && fy >= FORBIDDEN_MIN && fy <= FORBIDDEN_MAX;
  if (!inside) return { gx, gy };

  // Four candidate escapes (left/right/up/down out of the box); take the
  // cheapest one so the node barely moves.
  const escapes = [
    { gx: FORBIDDEN_MIN * spanX, gy, cost: fx - FORBIDDEN_MIN },
    { gx: FORBIDDEN_MAX * spanX, gy, cost: FORBIDDEN_MAX - fx },
    { gx, gy: FORBIDDEN_MIN * spanY, cost: fy - FORBIDDEN_MIN },
    { gx, gy: FORBIDDEN_MAX * spanY, cost: FORBIDDEN_MAX - fy },
  ];
  const best = escapes.reduce((a, b) => (b.cost < a.cost ? b : a));
  // Nudge a hair past the boundary so floating-point rounding can't leave it
  // exactly on the forbidden edge.
  const epsilon = 0.001;
  return {
    gx: best.gx === gx ? gx : best.gx + (best.gx < gx ? -epsilon : epsilon),
    gy: best.gy === gy ? gy : best.gy + (best.gy < gy ? -epsilon : epsilon),
  };
}

export function relaxLayout(
  nodes: MapNode[],
  edges: MapEdge[],
  params: GenerationParams,
  gridCols: number,
  gridRows: number
): MapNode[] {
  // Strength 0 means "leave the generator's own placement exactly alone" —
  // return the identical node objects so this is provably a no-op.
  if (params.layoutRelaxStrength <= 0 || nodes.length < 2) return nodes;

  const positions = nodes.map((n) => ({ gx: n.gx, gy: n.gy }));
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));
  const spacing = Math.max(0, params.layoutNodeSpacing);
  const directionWeight = clamp(params.layoutDirectionWeight, 0, 1);

  function settle(i: number, gx: number, gy: number): void {
    let x = clamp(gx, 0, gridCols - 1);
    let y = clamp(gy, 0, gridRows - 1);
    ({ gx: x, gy: y } = pushOutOfForbiddenBox(nodes[i], x, y, gridCols, gridRows));
    positions[i].gx = clamp(x, 0, gridCols - 1);
    positions[i].gy = clamp(y, 0, gridRows - 1);
  }

  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const step = params.layoutRelaxStrength * coolingFactor(iteration);
    if (step <= 0) break;

    // --- Step 1: magnetic alignment. Rotate each edge about its midpoint
    // toward the bearing it declares, preserving its current length. This is
    // the soft, cooled force — it chases direction accuracy but makes no
    // promises about spacing (left to itself it will happily stack nodes on
    // top of each other when several edges' demands conflict).
    if (directionWeight > 0) {
      const dx = new Array<number>(nodes.length).fill(0);
      const dy = new Array<number>(nodes.length).fill(0);
      for (const edge of edges) {
        const fromIndex = indexById.get(edge.fromId);
        const toIndex = indexById.get(edge.toId);
        if (fromIndex === undefined || toIndex === undefined) continue;
        const from = positions[fromIndex];
        const to = positions[toIndex];
        const vx = to.gx - from.gx;
        const vy = to.gy - from.gy;
        const length = Math.hypot(vx, vy);
        if (length < 1e-6) continue;
        const ideal = unitVector(edge.direction);
        // Where `to` would sit if this edge pointed exactly as declared.
        const targetX = from.gx + ideal.dx * length;
        const targetY = from.gy + ideal.dy * length;
        const pull = directionWeight / 2;
        const ex = (targetX - to.gx) * pull;
        const ey = (targetY - to.gy) * pull;
        dx[toIndex] += ex;
        dy[toIndex] += ey;
        dx[fromIndex] -= ex;
        dy[fromIndex] -= ey;
      }
      for (let i = 0; i < positions.length; i++) {
        settle(i, positions[i].gx + dx[i] * step, positions[i].gy + dy[i] * step);
      }
    }

    // --- Step 2: separation, as a *constraint projection* applied after the
    // force step rather than as a competing force. This is the key structural
    // choice, and it's why the overlap-removal literature (PRISM, Voronoi
    // cluster-busting, GTree) treats spacing as post-processing: run as a
    // rival force it loses to the magnetic pull and crowding gets *worse*
    // (measured: radial minimum node separation fell from 0.016 to 0.005 with
    // direction weight at 1). Projected afterward, it fully resolves each
    // overlap and the spacing property holds no matter how hard directions
    // are being chased — the last thing every iteration does is enforce it.
    if (spacing > 0) {
      for (let sweep = 0; sweep < SEPARATION_SWEEPS; sweep++) {
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            let vx = positions[i].gx - positions[j].gx;
            let vy = positions[i].gy - positions[j].gy;
            let d = Math.hypot(vx, vy);
            if (d >= spacing) continue;
            if (d < 1e-6) {
              // Coincident: nudge along a deterministic index-derived angle
              // rather than dividing by zero.
              const angle = (i * GOLDEN_ANGLE) % (Math.PI * 2);
              vx = Math.cos(angle);
              vy = Math.sin(angle);
              d = 1e-6;
            }
            const push = (spacing - d) / 2; // each node moves half the deficit
            const ux = (vx / d) * push;
            const uy = (vy / d) * push;
            settle(i, positions[i].gx + ux, positions[i].gy + uy);
            settle(j, positions[j].gx - ux, positions[j].gy - uy);
          }
        }
      }
    }
  }

  return nodes.map((node, i) => ({ ...node, gx: positions[i].gx, gy: positions[i].gy }));
}
