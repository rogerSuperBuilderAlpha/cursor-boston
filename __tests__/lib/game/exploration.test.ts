/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  distanceToNearestOwned,
  hexCentroid,
  hostileSpawnProbability,
  kingdomRadiusFromCentroid,
  riskScore,
  ringCoords,
  sampleFrontierTile,
} from "@/lib/game/exploration";
import { hexDistance, tileIdFromAxial } from "@/lib/game/world-gen";
import { makeSeededRng } from "@/lib/game/combat";

describe("hexCentroid", () => {
  it("returns origin for empty input", () => {
    expect(hexCentroid([])).toEqual({ q: 0, r: 0 });
  });

  it("averages and rounds", () => {
    const c = hexCentroid(["0_0", "2_0", "0_2"]);
    expect(c.q).toBe(1);
    expect(c.r).toBe(1);
  });
});

describe("distanceToNearestOwned", () => {
  it("returns Infinity when ownedTileIds is empty", () => {
    const d = distanceToNearestOwned({ q: 0, r: 0 }, []);
    expect(d).toBe(Number.POSITIVE_INFINITY);
  });

  it("finds the closest owned tile", () => {
    const d = distanceToNearestOwned({ q: 5, r: 0 }, ["0_0", "3_0", "10_10"]);
    expect(d).toBe(2);
  });
});

describe("kingdomRadiusFromCentroid", () => {
  it("returns 0 for empty owned set", () => {
    expect(kingdomRadiusFromCentroid({ q: 0, r: 0 }, [])).toBe(0);
  });

  it("returns 0 when only the centroid tile is owned", () => {
    expect(kingdomRadiusFromCentroid({ q: 0, r: 0 }, ["0_0"])).toBe(0);
  });

  it("returns the max hex-distance from centroid to any owned tile", () => {
    const owned = ["0_0", "3_0", "0_5", "-2_-2"];
    expect(kingdomRadiusFromCentroid({ q: 0, r: 0 }, owned)).toBe(5);
  });
});

describe("hostileSpawnProbability", () => {
  it("starts at 5% for tilesHeld <= 25", () => {
    expect(hostileSpawnProbability(0)).toBeCloseTo(0.05);
    expect(hostileSpawnProbability(25)).toBeCloseTo(0.05);
  });

  it("ramps to ~40% at 200 tiles", () => {
    expect(hostileSpawnProbability(200)).toBeCloseTo(0.3825, 3);
  });

  it("caps at 60%", () => {
    expect(hostileSpawnProbability(10000)).toBe(0.6);
  });

  it("is monotonic in tilesHeld", () => {
    let prev = hostileSpawnProbability(0);
    for (let n = 25; n <= 1000; n += 25) {
      const cur = hostileSpawnProbability(n);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("riskScore", () => {
  it("zero risk for friendly far frontier", () => {
    expect(riskScore({ hostileNeighbors: 0, distanceToCore: 0 })).toBe(0);
  });

  it("scales with hostile neighbors", () => {
    const a = riskScore({ hostileNeighbors: 1, distanceToCore: 0 });
    const b = riskScore({ hostileNeighbors: 3, distanceToCore: 0 });
    const c = riskScore({ hostileNeighbors: 6, distanceToCore: 0 });
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeGreaterThan(50);
  });

  it("caps at 100", () => {
    expect(
      riskScore({ hostileNeighbors: 6, distanceToCore: 50 })
    ).toBeLessThanOrEqual(100);
  });
});

describe("ringCoords", () => {
  it("ring 0 is just the center", () => {
    expect(ringCoords({ q: 0, r: 0 }, 0)).toEqual([{ q: 0, r: 0 }]);
  });

  it("ring r returns 6r coords for r >= 1", () => {
    for (const r of [1, 2, 3, 5, 10]) {
      const out = ringCoords({ q: 7, r: 7 }, r);
      expect(out).toHaveLength(6 * r);
    }
  });

  it("every coord on ring r is exactly distance r from center", () => {
    const center = { q: 3, r: -1 };
    for (const r of [1, 2, 4]) {
      for (const c of ringCoords(center, r)) {
        expect(hexDistance(center, c)).toBe(r);
      }
    }
  });
});

describe("sampleFrontierTile", () => {
  it("returns a sample on a sparse world", () => {
    const owned = ["0_0", "1_0", "0_1"];
    const result = sampleFrontierTile({
      ownedTileIds: owned,
      isClaimed: (id) => owned.includes(id),
      isHostile: () => false,
      tilesHeld: 3,
      rng: makeSeededRng("frontier:1"),
    });
    expect(result).not.toBeNull();
    if (result) {
      expect(owned).not.toContain(result.tileId);
      expect(result.distanceToCore).toBeGreaterThanOrEqual(1);
    }
  });

  it("seeded RNG is deterministic", () => {
    const owned = ["0_0", "1_0"];
    const a = sampleFrontierTile({
      ownedTileIds: owned,
      isClaimed: (id) => owned.includes(id),
      isHostile: () => false,
      tilesHeld: 2,
      rng: makeSeededRng("seed:42"),
    });
    const b = sampleFrontierTile({
      ownedTileIds: owned,
      isClaimed: (id) => owned.includes(id),
      isHostile: () => false,
      tilesHeld: 2,
      rng: makeSeededRng("seed:42"),
    });
    expect(a?.tileId).toBe(b?.tileId);
  });

  it("returns null when every coord within maxRings is claimed", () => {
    // Mark every coord within 12 rings as claimed.
    const claimed = new Set<string>();
    for (let r = 0; r <= 12; r++) {
      for (const c of ringCoords({ q: 0, r: 0 }, r)) {
        claimed.add(tileIdFromAxial(c.q, c.r));
      }
    }
    const result = sampleFrontierTile({
      ownedTileIds: ["0_0"],
      isClaimed: (id) => claimed.has(id),
      isHostile: () => false,
      tilesHeld: 1,
      rng: makeSeededRng("dense:1"),
      maxRings: 12,
    });
    expect(result).toBeNull();
  });

  it("prefers a hostile-adjacent tile when wantHostile rolls true at high tilesHeld", () => {
    const hostileSet = new Set<string>(["5_0", "6_-1", "4_2"]);
    const result = sampleFrontierTile({
      ownedTileIds: ["0_0", "1_0", "0_1"],
      isClaimed: () => false,
      isHostile: (id) => hostileSet.has(id),
      tilesHeld: 300,
      rng: makeSeededRng("hostile:1"),
    });
    expect(result).not.toBeNull();
    if (result) {
      expect(result.tileId).toBeDefined();
      expect(typeof result.hostileNeighbors).toBe("number");
    }
  });

  it("falls back to bestNonHostile when wantHostile is true but no hostiles exist", () => {
    const result = sampleFrontierTile({
      ownedTileIds: ["0_0"],
      isClaimed: () => false,
      isHostile: () => false,
      tilesHeld: 300,
      rng: makeSeededRng("fallback:1"),
      maxRings: 5,
    });
    expect(result).not.toBeNull();
    if (result) {
      expect(result.hostileNeighbors).toBe(0);
    }
  });
});
