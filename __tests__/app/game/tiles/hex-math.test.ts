/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  axialToPixel,
  fitTilesToViewport,
  hexPoints,
} from "@/app/game/tiles/_lib/hex-math";
import type { MapTile } from "@/lib/game/types";

function makeTile(q: number, r: number): MapTile {
  return {
    tileId: `${q}_${r}`,
    q,
    r,
    type: "unassigned",
    ownerId: null,
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };
}

describe("axialToPixel", () => {
  it("places (0,0) at the origin", () => {
    expect(axialToPixel(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("returns positive y for positive r", () => {
    const { y } = axialToPixel(0, 1);
    expect(y).toBeGreaterThan(0);
  });

  it("is consistent for q vs r offsets (axial geometry)", () => {
    // q+1 should not collide with r+1 (axial coords are not square grid)
    const a = axialToPixel(1, 0);
    const b = axialToPixel(0, 1);
    expect(a.x).not.toBeCloseTo(b.x);
    expect(a.y).not.toBeCloseTo(b.y);
  });
});

describe("hexPoints", () => {
  it("returns 6 comma-pairs space-separated", () => {
    const out = hexPoints(0, 0);
    const pairs = out.split(" ");
    expect(pairs).toHaveLength(6);
    for (const p of pairs) expect(p.split(",")).toHaveLength(2);
  });

  it("is centered at the (cx,cy) it was given", () => {
    const out = hexPoints(100, 200);
    const points = out.split(" ").map((p) => p.split(",").map(Number));
    const avgX = points.reduce((s, [x]) => s + x, 0) / 6;
    const avgY = points.reduce((s, [, y]) => s + y, 0) / 6;
    expect(avgX).toBeCloseTo(100, 1);
    expect(avgY).toBeCloseTo(200, 1);
  });
});

describe("fitTilesToViewport", () => {
  it("returns null on empty input", () => {
    expect(fitTilesToViewport([])).toBeNull();
  });

  it("centers a single tile at origin", () => {
    const fit = fitTilesToViewport([makeTile(5, 5)]);
    expect(fit).not.toBeNull();
    const { tx, ty } = fit!;
    const { x, y } = axialToPixel(5, 5);
    // Translation should move (x,y) to origin.
    expect(tx).toBeCloseTo(-x, 1);
    expect(ty).toBeCloseTo(-y, 1);
  });

  it("never zooms past 1:1 on small kingdoms", () => {
    // Five tightly-packed tiles. Without the cap, fit would be ~6x.
    const tiles = [
      makeTile(0, 0),
      makeTile(1, 0),
      makeTile(0, 1),
      makeTile(-1, 0),
      makeTile(0, -1),
    ];
    const fit = fitTilesToViewport(tiles);
    expect(fit).not.toBeNull();
    expect(fit!.scale).toBeLessThanOrEqual(1);
  });

  it("zooms out for large worlds", () => {
    // Spread a grid of tiles so the bbox is wider than the viewbox.
    const tiles: MapTile[] = [];
    for (let q = -30; q <= 30; q += 5) {
      for (let r = -30; r <= 30; r += 5) tiles.push(makeTile(q, r));
    }
    const fit = fitTilesToViewport(tiles);
    expect(fit).not.toBeNull();
    expect(fit!.scale).toBeLessThan(1);
    expect(fit!.scale).toBeGreaterThan(0);
  });
});
