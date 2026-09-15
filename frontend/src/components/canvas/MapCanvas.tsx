import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { selectExitsForNode, useMapStore } from "../../store/mapStore";
import type { MapNode } from "../../types/map";
import { Toolbar } from "../toolbar/Toolbar";
import { EdgeLine } from "./EdgeLine";
import { FactionTerritory } from "./FactionTerritory";
import { NodeShape } from "./NodeShape";
import { TerrainWash } from "./TerrainWash";
import { Tooltip } from "./Tooltip";

// Base SVG canvas size and margins, matching docs/overworld-map.html's layout
// so the rendered output stays a close visual match to the prototype.
const SVG_W = 1200;
const SVG_H = 800;
const MARGIN = { l: 60, r: 60, t: 40, b: 40 };
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
// Wheel/trackpad zoom was reported as "too sensitive" — the old handler
// applied a flat 12%/11% multiplicative jump per wheel *event*, not per unit
// of scroll. A trackpad fires many small-deltaY events per physical gesture
// (unlike a notched mouse wheel's few large-deltaY ones), so that flat jump
// compounded into a runaway zoom for exactly the input device where fine
// control matters most. Scaling the exponent by the actual (clamped) deltaY
// makes a light trackpad nudge a light zoom step, while a hard mouse-wheel
// notch still zooms a sensible amount.
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_CLAMP = 100;
// Discrete step for the +/- zoom buttons (Toolbar) — independent of wheel
// sensitivity, since a button click should always move a fixed, predictable
// amount.
const BUTTON_ZOOM_STEP = 1.25;
// Extra room (in un-scaled SVG units) around the node bounding box for "Fit
// to viewport" — nodes render up to ~11px radius with a label centered up to
// ~12px below that, and long labels can extend a fair bit sideways past the
// node center too, so the box needs slack beyond the raw node-center bounds
// or a fit would clip labels at the edges.
const FIT_PADDING = 60;

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  dragging: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export function MapCanvas() {
  const map = useMapStore((s) => s.map);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Layer visibility is pure UI state (spec Section 10b) — it never touches
  // WorldMap data, so it lives here, not in the store.
  const [terrainVisible, setTerrainVisible] = useState(false);
  const [factionsVisible, setFactionsVisible] = useState(false);
  const [directionLabelsVisible, setDirectionLabelsVisible] = useState(true);

  const gridCols = map.params.gridCols;
  const gridRows = map.params.gridRows;
  const cellW = (SVG_W - MARGIN.l - MARGIN.r) / Math.max(1, gridCols - 1);
  const cellH = (SVG_H - MARGIN.t - MARGIN.b) / Math.max(1, gridRows - 1);
  const nx = (node: MapNode) => MARGIN.l + node.gx * cellW;
  const ny = (node: MapNode) => MARGIN.t + node.gy * cellH;

  // Dragging is tracked on window, not just the wrapper, so a fast drag that
  // slips past the element's bounds doesn't get stuck "stuck down".
  useEffect(() => {
    function onMouseMove(e: globalThis.MouseEvent) {
      const drag = dragRef.current;
      if (!drag.dragging) return;
      setTransform((t) => ({
        ...t,
        x: drag.originX + (e.clientX - drag.startX),
        y: drag.originY + (e.clientY - drag.startY),
      }));
    }
    function onMouseUp() {
      dragRef.current.dragging = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleMouseDown(e: MouseEvent<HTMLDivElement>) {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.x,
      originY: transform.y,
    };
  }

  // Shared by wheel zoom and the +/- toolbar buttons: apply a zoom factor
  // around a fixed point (cx, cy in wrapper-local coordinates) so whatever's
  // under that point stays under it as the scale changes.
  function zoomAround(cx: number, cy: number, factor: number) {
    setTransform((t) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
      const applied = scale / t.scale;
      return { scale, x: cx - applied * (cx - t.x), y: cy - applied * (cy - t.y) };
    });
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const delta = Math.max(-WHEEL_DELTA_CLAMP, Math.min(WHEEL_DELTA_CLAMP, e.deltaY));
    const factor = Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY);
    zoomAround(e.clientX - rect.left, e.clientY - rect.top, factor);
  }

  function zoomAtCenter(factor: number) {
    const wrap = wrapRef.current;
    const cx = wrap ? wrap.clientWidth / 2 : SVG_W / 2;
    const cy = wrap ? wrap.clientHeight / 2 : SVG_H / 2;
    zoomAround(cx, cy, factor);
  }

  function handleZoomIn() {
    zoomAtCenter(BUTTON_ZOOM_STEP);
  }

  function handleZoomOut() {
    zoomAtCenter(1 / BUTTON_ZOOM_STEP);
  }

  function handleZoomReset() {
    setTransform({ x: 0, y: 0, scale: 1 });
  }

  // Sets scale+pan directly from the current map's node bounding box, rather
  // than leaving the user to hunt for the right zoom level by hand — an
  // absolute placement, unlike zoomAround's relative "scale from here."
  function handleFitToViewport() {
    const wrap = wrapRef.current;
    if (!wrap || map.nodes.length === 0) return;

    const xs = map.nodes.map(nx);
    const ys = map.nodes.map(ny);
    const minX = Math.min(...xs) - FIT_PADDING;
    const maxX = Math.max(...xs) + FIT_PADDING;
    const minY = Math.min(...ys) - FIT_PADDING;
    const maxY = Math.max(...ys) + FIT_PADDING;

    const viewportW = wrap.clientWidth;
    const viewportH = wrap.clientHeight;
    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(viewportW / (maxX - minX), viewportH / (maxY - minY)))
    );
    setTransform({
      scale,
      x: viewportW / 2 - scale * ((minX + maxX) / 2),
      y: viewportH / 2 - scale * ((minY + maxY) / 2),
    });
  }

  function handleNodeEnter(node: MapNode, e: MouseEvent<SVGGElement>) {
    setHoveredNodeId(node.id);
    const wrap = wrapRef.current;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }

  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const hoveredNode = hoveredNodeId ? (nodeById.get(hoveredNodeId) ?? null) : null;
  const terrainZones = map.extensions.terrainZones ?? [];
  const factions = map.extensions.factions ?? [];
  const project = (node: MapNode) => ({ x: nx(node), y: ny(node) });

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      <Toolbar
        terrainVisible={terrainVisible}
        factionsVisible={factionsVisible}
        hasTerrainData={terrainZones.length > 0}
        hasFactionData={factions.length > 0}
        onToggleTerrain={() => setTerrainVisible((v) => !v)}
        onToggleFactions={() => setFactionsVisible((v) => !v)}
        directionLabelsVisible={directionLabelsVisible}
        onToggleDirectionLabels={() => setDirectionLabelsVisible((v) => !v)}
        zoomPercent={Math.round(transform.scale * 100)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onFitToViewport={handleFitToViewport}
      />
      <div
        ref={wrapRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          cursor: "grab",
          background: "#faf9f6",
        }}
      >
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <rect width={SVG_W} height={SVG_H} fill="#faf9f6" />
          {terrainVisible && terrainZones.length > 0 && (
            <TerrainWash zones={terrainZones} nodeById={nodeById} project={project} />
          )}
          {factionsVisible && factions.length > 0 && (
            <FactionTerritory factions={factions} nodeById={nodeById} project={project} />
          )}
          <g>
            {map.edges.map((edge) => {
              const from = nodeById.get(edge.fromId);
              const to = nodeById.get(edge.toId);
              if (!from || !to) return null;
              return (
                <EdgeLine
                  key={edge.id}
                  edge={edge}
                  x1={nx(from)}
                  y1={ny(from)}
                  x2={nx(to)}
                  y2={ny(to)}
                  showDirection={directionLabelsVisible}
                />
              );
            })}
          </g>
          <g>
            {map.nodes.map((node) => (
              <NodeShape
                key={node.id}
                node={node}
                x={nx(node)}
                y={ny(node)}
                onMouseEnter={(e) => handleNodeEnter(node, e)}
                onMouseLeave={() => setHoveredNodeId(null)}
              />
            ))}
          </g>
        </svg>
        {hoveredNode && (
          <Tooltip
            node={hoveredNode}
            exits={selectExitsForNode(map, hoveredNode.id)}
            x={tooltipPos.x}
            y={tooltipPos.y}
            containerWidth={wrapRef.current?.clientWidth ?? SVG_W}
          />
        )}
      </div>
    </div>
  );
}
