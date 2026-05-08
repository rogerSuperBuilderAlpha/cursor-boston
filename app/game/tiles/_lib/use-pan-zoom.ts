/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MAX_SCALE, MIN_SCALE, ZOOM_STEP } from "./constants";

/**
 * Owns the SVG pan/zoom state (scale, tx, ty) plus the wheel-zoom and
 * drag-pan event wiring. Returns a `svgRef` to attach to the SVG and the
 * pointer-down handler — the inner <g transform=...> is built from the
 * returned `scale/tx/ty`.
 *
 * `lastDragMovedRef` is exposed so the per-tile click handler can
 * suppress clicks that ended a drag (a drag-then-release shouldn't open
 * the tile actions modal).
 */
export function usePanZoom() {
  // Pan/zoom state — applied as an SVG transform on the rendered group.
  // Initial values are recomputed from the world bounding box on first load.
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [didFit, setDidFit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // dragRef tracks the active drag (null when not dragging). `moved` is the
  // total Manhattan distance the pointer has travelled since pointerdown,
  // and `lastMoved` mirrors it through pointerup so the click handler can
  // distinguish a tap from a drag-that-ended-here.
  const dragRef = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: number;
  } | null>(null);
  const lastDragMovedRef = useRef(0);

  // Wheel zoom around the cursor.
  //
  // Attached via `addEventListener({ passive: false })` in an effect below
  // — React's synthetic `onWheel` listener is passive by default, so
  // `e.preventDefault()` is silently dropped and the page scrolls behind
  // the map when the user tries to zoom. Stored in a ref so the effect's
  // attach/detach doesn't depend on the latest closure.
  const wheelStateRef = useRef({ scale, tx, ty });
  useEffect(() => {
    wheelStateRef.current = { scale, tx, ty };
  }, [scale, tx, ty]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: s, tx: ttx, ty: tty } = wheelStateRef.current;
      // macOS pinch-to-zoom on trackpads also fires wheel events with
      // ctrlKey=true; same handler covers both.
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor));
      if (next === s) return;
      const rect = svg.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = (cx - rect.width / 2) / s - ttx;
      const worldY = (cy - rect.height / 2) / s - tty;
      const newTx = (cx - rect.width / 2) / next - worldX;
      const newTy = (cy - rect.height / 2) / next - worldY;
      setScale(next);
      setTx(newTx);
      setTy(newTy);
    };
    svg.addEventListener("wheel", onWheelNative, { passive: false });
    return () => svg.removeEventListener("wheel", onWheelNative);
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx,
        ty,
        moved: 0,
      };
      lastDragMovedRef.current = 0;
      setDragging(true);
      // Intentionally NOT calling setPointerCapture here. Pointer capture
      // would redirect the subsequent `click` event to the SVG, which
      // bypasses the per-tile <g onClick> handlers — which means clicks
      // never register on tiles. We rely on document-level pointermove /
      // pointerup listeners (attached in the effect below) so the drag
      // survives the cursor leaving the SVG without needing capture.
    },
    [tx, ty]
  );

  // While `dragging`, listen on the document so the drag survives the
  // cursor leaving the SVG. Clearing dragRef happens in pointerup; the
  // last-known movement is mirrored to lastDragMovedRef so the per-tile
  // click handler can suppress clicks that ended a drag.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dxRaw = e.clientX - drag.x;
      const dyRaw = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dxRaw) + Math.abs(dyRaw));
      lastDragMovedRef.current = drag.moved;
      setTx(drag.tx + dxRaw / scale);
      setTy(drag.ty + dyRaw / scale);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, scale]);

  const zoomIn = useCallback(
    () => setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP)),
    []
  );
  const zoomOut = useCallback(
    () => setScale((s) => Math.max(MIN_SCALE, s / ZOOM_STEP)),
    []
  );

  return {
    scale,
    setScale,
    tx,
    setTx,
    ty,
    setTy,
    didFit,
    setDidFit,
    dragging,
    svgRef,
    handlePointerDown,
    lastDragMovedRef,
    zoomIn,
    zoomOut,
  };
}

export type PanZoom = ReturnType<typeof usePanZoom>;
