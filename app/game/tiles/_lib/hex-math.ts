/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { MapTile } from "@/lib/game/types";
import {
  FIT_MARGIN,
  HEX_SIZE,
  MIN_SCALE,
  SQRT3,
  VIEWBOX_H,
  VIEWBOX_W,
  VIEWPORT_PADDING,
} from "./constants";

export function axialToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    y: HEX_SIZE * (3 / 2) * r,
  };
}

export function hexPoints(cx: number, cy: number): string {
  const dx = (HEX_SIZE * SQRT3) / 2;
  const dy = HEX_SIZE / 2;
  return [
    [cx, cy - HEX_SIZE],
    [cx + dx, cy - dy],
    [cx + dx, cy + dy],
    [cx, cy + HEX_SIZE],
    [cx - dx, cy + dy],
    [cx - dx, cy - dy],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

/**
 * Compute pan/zoom values that fit `tiles` inside the SVG viewBox with a
 * small margin. Returns `null` if `tiles` is empty.
 *
 * The viewBox is centered at (0, 0) with extent VIEWBOX_W × VIEWBOX_H. After
 * applying `scale * translate(tx, ty)` to the inner <g>, an axial-pixel
 * point `(x, y)` maps to SVG `(scale * (x + tx), scale * (y + ty))`. We
 * pick `tx, ty` to center the bbox at the origin and `scale` so the bbox
 * fits.
 *
 * Important: we only zoom *out* to fit — never zoom *in* past 1:1 on
 * recenter. For small kingdoms (e.g. a 5-tile cluster) the natural fit
 * scale is ~6×, which pegs to MAX_SCALE and pushes the surrounding world
 * off-screen — leaving the user staring at one hex. Capping the fit at 1
 * keeps neighboring tiles visible for context; the user can still wheel-
 * zoom in afterward.
 */
export function fitTilesToViewport(
  tiles: ReadonlyArray<MapTile>
): { scale: number; tx: number; ty: number } | null {
  if (tiles.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const t of tiles) {
    const { x, y } = axialToPixel(t.q, t.r);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 2 * VIEWPORT_PADDING;
  const h = maxY - minY + 2 * VIEWPORT_PADDING;
  const fit = Math.min(VIEWBOX_W / w, VIEWBOX_H / h) * FIT_MARGIN;
  // Clamp to [MIN_SCALE, 1] — never zoom in past 1:1 on recenter, only
  // zoom out enough to make the kingdom fit.
  const scale = Math.max(MIN_SCALE, Math.min(1, fit));
  return {
    scale,
    tx: -(minX + maxX) / 2,
    ty: -(minY + maxY) / 2,
  };
}
