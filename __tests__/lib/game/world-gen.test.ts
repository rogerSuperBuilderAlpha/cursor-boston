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

  it("places index 0 at the origin", () => {
    expect(spawnCenterForPlayerIndex(0)).toEqual({ q: 0, r: 0 });
  });

  it("places ring-1 indices (1..6) at hex-distance `spacing` from origin", () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 6; i++) {
      const c = spawnCenterForPlayerIndex(i, 50);
      expect(hexDistance({ q: 0, r: 0 }, c)).toBe(50);
      seen.add(tileIdFromAxial(c.q, c.r));
    }
    expect(seen.size).toBe(6);
  });

  it("places ring-2 indices (7..18) at hex-distance 2*spacing from origin", () => {
    const seen = new Set<string>();
    for (let i = 7; i <= 18; i++) {
      const c = spawnCenterForPlayerIndex(i, 50);
      expect(hexDistance({ q: 0, r: 0 }, c)).toBe(100);
      seen.add(tileIdFromAxial(c.q, c.r));
    }
    expect(seen.size).toBe(12);
  });

  it("places adjacent kingdoms at least `spacing` hexes apart", () => {
    const centers: ReturnType<typeof spawnCenterForPlayerIndex>[] = [];
    for (let i = 0; i < 19; i++) {
      centers.push(spawnCenterForPlayerIndex(i, 50));
    }
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        expect(hexDistance(centers[i], centers[j])).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it("does not march along a single axis (kingdoms span q AND r axes)", () => {
    // The old grid layout planted everyone with r=0 for the first 100 indices.
    // The hex spiral should populate both axes within the first ring.
    const qs = new Set<number>();
    const rs = new Set<number>();
    for (let i = 0; i < 7; i++) {
      const c = spawnCenterForPlayerIndex(i, 50);
      qs.add(c.q);
      rs.add(c.r);
    }
    // At least 2 distinct r values among the first 7 — proves we're not
    // clamped to r=0 like the old grid was.
    expect(rs.size).toBeGreaterThan(1);
    expect(qs.size).toBeGreaterThan(1);
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
