/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { makeSeededRng } from "@/lib/game/combat";
import {
  axialFromTileId,
  hexDistance,
  neighbors,
  neighborTileIds,
  spawnCenterForPlayerIndex,
  spawnPlayerLands,
  tileIdFromAxial,
} from "@/lib/game/world-gen";

describe("axial helpers", () => {
  it("round-trips tileId ↔ axial", () => {
    const id = tileIdFromAxial(3, -7);
    expect(id).toBe("3_-7");
    expect(axialFromTileId(id)).toEqual({ q: 3, r: -7 });
  });

  it("rejects malformed tileIds", () => {
    expect(() => axialFromTileId("not-a-tile")).toThrow();
  });

  it("returns 6 unique neighbors that are all 1 hex away", () => {
    const ns = neighbors(0, 0);
    expect(ns).toHaveLength(6);
    const ids = ns.map((n) => tileIdFromAxial(n.q, n.r));
    expect(new Set(ids).size).toBe(6);
    for (const n of ns) {
      expect(hexDistance({ q: 0, r: 0 }, n)).toBe(1);
    }
  });

  it("neighborTileIds returns the same 6 in tileId form", () => {
    const ids = neighborTileIds(2, 3);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it("hexDistance is symmetric and zero on identity", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(
      hexDistance({ q: 3, r: -2 }, { q: 0, r: 0 })
    );
  });
});

describe("spawnCenterForPlayerIndex", () => {
  it("returns distinct centers for distinct indices", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = spawnCenterForPlayerIndex(i);
      seen.add(tileIdFromAxial(c.q, c.r));
    }
    expect(seen.size).toBe(50);
  });

  it("places centers at the configured spacing", () => {
    const a = spawnCenterForPlayerIndex(0, 50);
    const b = spawnCenterForPlayerIndex(1, 50);
    expect(b.q - a.q).toBe(50);
  });
});

describe("spawnPlayerLands", () => {
  function gen(seed: string, claimed: ReadonlySet<string> = new Set()) {
    return spawnPlayerLands({
      center: { q: 0, r: 0 },
      claimedTileIds: claimed,
      rng: makeSeededRng(seed),
    });
  }

  it("returns exactly 100 tiles by default", () => {
    const r = gen("seed-1");
    expect(r.tileIds).toHaveLength(100);
  });

  it("splits into 85 contiguous + 10–15 exclaves by default (sums to 100)", () => {
    const r = gen("seed-1");
    expect(r.contiguousTileIds).toHaveLength(85);
    expect(r.exclaveTileIds.length).toBeGreaterThanOrEqual(10);
    expect(r.exclaveTileIds.length).toBeLessThanOrEqual(15);
    expect(r.contiguousTileIds.length + r.exclaveTileIds.length).toBe(100);
  });

  it("produces unique tiles (no internal duplicates)", () => {
    const r = gen("seed-2");
    expect(new Set(r.tileIds).size).toBe(r.tileIds.length);
  });

  it("avoids tiles in the claimed set", () => {
    const claimed = new Set([
      tileIdFromAxial(1, 0),
      tileIdFromAxial(0, 1),
      tileIdFromAxial(-1, 1),
    ]);
    const r = gen("seed-3", claimed);
    for (const id of r.tileIds) {
      expect(claimed.has(id)).toBe(false);
    }
  });

  it("contiguous tiles form a connected subgraph", () => {
    const r = gen("seed-1");
    const ownSet = new Set(r.contiguousTileIds);
    // Pick any contiguous tile, BFS within ownSet, expect we cover all of them.
    const start = r.contiguousTileIds[0];
    const seen = new Set<string>([start]);
    const queue = [axialFromTileId(start)];
    while (queue.length > 0) {
      const c = queue.shift() as { q: number; r: number };
      for (const n of neighbors(c.q, c.r)) {
        const nid = tileIdFromAxial(n.q, n.r);
        if (ownSet.has(nid) && !seen.has(nid)) {
          seen.add(nid);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(r.contiguousTileIds.length);
  });

  it("is deterministic for the same seed and inputs", () => {
    const a = gen("repro-seed");
    const b = gen("repro-seed");
    expect(a.tileIds).toEqual(b.tileIds);
    expect(a.centerTileId).toBe(b.centerTileId);
  });

  it("produces different layouts for different seeds", () => {
    const a = gen("seed-A");
    const b = gen("seed-B");
    expect(a.tileIds).not.toEqual(b.tileIds);
  });

  it("relocates the start when the requested center is already claimed", () => {
    const claimed = new Set([tileIdFromAxial(0, 0)]);
    const r = gen("relocate", claimed);
    expect(r.centerTileId).not.toBe("0_0");
    expect(r.tileIds).toHaveLength(100);
  });

  it("respects custom contiguousTarget and exclave bounds", () => {
    const r = spawnPlayerLands({
      center: { q: 100, r: 100 },
      claimedTileIds: new Set(),
      rng: makeSeededRng("custom"),
      totalTiles: 50,
      contiguousTarget: 40,
      exclavesMin: 10,
      exclavesMax: 10,
    });
    expect(r.tileIds).toHaveLength(50);
    expect(r.contiguousTileIds).toHaveLength(40);
    expect(r.exclaveTileIds).toHaveLength(10);
  });
});
