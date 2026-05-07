/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  computeTileThreat,
  rankTileIdsByThreat,
} from "@/lib/game/threat";
import type { ThreatOwnerInfo } from "@/lib/game/threat";
import type { MapTile, LandType } from "@/lib/game/types";
import { neighbors, tileIdFromAxial } from "@/lib/game/world-gen";

function tile(q: number, r: number, ownerId: string | null, type: LandType = "military"): MapTile {
  return {
    tileId: tileIdFromAxial(q, r),
    q,
    r,
    type,
    ownerId,
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };
}

const ME = "me";
const ENEMY_A = "enemyA";
const ENEMY_B = "enemyB";

const UNSHIELDED: ThreatOwnerInfo = { shielded: false };
const SHIELDED: ThreatOwnerInfo = { shielded: true };

describe("computeTileThreat", () => {
  it("returns an empty map when the player has no tiles", () => {
    const out = computeTileThreat({
      myTiles: [],
      worldTiles: [tile(5, 0, ENEMY_A)],
      owners: new Map([[ENEMY_A, UNSHIELDED]]),
      myUserId: ME,
    });
    expect(out.size).toBe(0);
  });

  it("scores 0 when the world has no enemies", () => {
    const me = tile(0, 0, ME);
    const out = computeTileThreat({
      myTiles: [me],
      worldTiles: [me],
      owners: new Map(),
      myUserId: ME,
    });
    expect(out.get(me.tileId)).toEqual({
      hostileNeighbors: 0,
      distanceToEnemy: Number.POSITIVE_INFINITY,
      score: 0,
    });
  });

  it("counts each unshielded enemy that sits in a hex neighbor slot", () => {
    const me = tile(0, 0, ME);
    // Two of the six neighbors are unshielded enemies.
    const ns = neighbors(0, 0);
    const enemy1 = tile(ns[0].q, ns[0].r, ENEMY_A);
    const enemy2 = tile(ns[1].q, ns[1].r, ENEMY_A);
    const out = computeTileThreat({
      myTiles: [me],
      worldTiles: [me, enemy1, enemy2],
      owners: new Map([[ENEMY_A, UNSHIELDED]]),
      myUserId: ME,
    });
    const t = out.get(me.tileId)!;
    expect(t.hostileNeighbors).toBe(2);
    expect(t.distanceToEnemy).toBe(1);
    // 2 * 1000 + 1 / (1 + 1) = 2000.5
    expect(t.score).toBeCloseTo(2000.5, 5);
  });

  it("ignores shielded enemies — they cannot attack", () => {
    const me = tile(0, 0, ME);
    const ns = neighbors(0, 0);
    const shieldedEnemy = tile(ns[0].q, ns[0].r, ENEMY_A);
    const out = computeTileThreat({
      myTiles: [me],
      worldTiles: [me, shieldedEnemy],
      owners: new Map([[ENEMY_A, SHIELDED]]),
      myUserId: ME,
    });
    const t = out.get(me.tileId)!;
    expect(t.hostileNeighbors).toBe(0);
    // No unshielded enemy at all → distance is infinity, term is 0.
    expect(t.distanceToEnemy).toBe(Number.POSITIVE_INFINITY);
    expect(t.score).toBe(0);
  });

  it("counts a tile bordering two enemies (different owners) correctly", () => {
    const me = tile(0, 0, ME);
    const ns = neighbors(0, 0);
    const enemyA = tile(ns[0].q, ns[0].r, ENEMY_A);
    const enemyB = tile(ns[2].q, ns[2].r, ENEMY_B);
    const out = computeTileThreat({
      myTiles: [me],
      worldTiles: [me, enemyA, enemyB],
      owners: new Map([
        [ENEMY_A, UNSHIELDED],
        [ENEMY_B, UNSHIELDED],
      ]),
      myUserId: ME,
    });
    expect(out.get(me.tileId)!.hostileNeighbors).toBe(2);
  });

  it("a bordering tile always outranks a non-bordering one that is merely close", () => {
    // Border tile: adjacent to enemyA at hex distance 1.
    const ns = neighbors(0, 0);
    const border = tile(0, 0, ME);
    const enemy = tile(ns[0].q, ns[0].r, ENEMY_A);
    // Non-border tile: 2 hexes from enemy (closer than infinity, but not adjacent).
    const offBy2 = tile(ns[1].q + ns[1].q, ns[1].r + ns[1].r, ME);
    // Sanity: offBy2 is not adjacent to enemy.
    const myTiles = [border, offBy2];
    const out = computeTileThreat({
      myTiles,
      worldTiles: [...myTiles, enemy],
      owners: new Map([[ENEMY_A, UNSHIELDED]]),
      myUserId: ME,
    });
    const borderScore = out.get(border.tileId)!.score;
    const offScore = out.get(offBy2.tileId)!.score;
    expect(borderScore).toBeGreaterThan(offScore);
    // And specifically: border's score is at least 1000 (one hostile neighbor),
    // off-tile's score is < 1 (no hostile neighbor).
    expect(borderScore).toBeGreaterThanOrEqual(1000);
    expect(offScore).toBeLessThan(1);
  });

  it("skips own-owned tiles when scanning the world for enemies", () => {
    // A tile owned by `me` should never count as an enemy neighbor.
    const me1 = tile(0, 0, ME);
    const ns = neighbors(0, 0);
    const me2 = tile(ns[0].q, ns[0].r, ME);
    const out = computeTileThreat({
      myTiles: [me1],
      worldTiles: [me1, me2],
      owners: new Map(),
      myUserId: ME,
    });
    expect(out.get(me1.tileId)!.hostileNeighbors).toBe(0);
  });

  it("treats unknown owners as unshielded (safer to over-count)", () => {
    const me = tile(0, 0, ME);
    const ns = neighbors(0, 0);
    const ghost = tile(ns[0].q, ns[0].r, "ghost-with-no-owner-record");
    const out = computeTileThreat({
      myTiles: [me],
      worldTiles: [me, ghost],
      // owners map omits "ghost-with-no-owner-record"
      owners: new Map(),
      myUserId: ME,
    });
    expect(out.get(me.tileId)!.hostileNeighbors).toBe(1);
  });
});

describe("rankTileIdsByThreat", () => {
  it("orders by descending score, with axial coord as a stable tiebreaker", () => {
    const ranked = rankTileIdsByThreat(
      ["1_0", "0_0", "2_-1"],
      new Map([
        ["1_0", { hostileNeighbors: 1, distanceToEnemy: 1, score: 1000.5 }],
        ["0_0", { hostileNeighbors: 0, distanceToEnemy: 5, score: 0.16 }],
        ["2_-1", { hostileNeighbors: 1, distanceToEnemy: 2, score: 1000.33 }],
      ])
    );
    expect(ranked).toEqual(["1_0", "2_-1", "0_0"]);
  });

  it("appends tiles with no threat record at the end (treated as score 0)", () => {
    const ranked = rankTileIdsByThreat(
      ["unknown_tile", "1_0"],
      new Map([
        ["1_0", { hostileNeighbors: 1, distanceToEnemy: 1, score: 1000.5 }],
      ])
    );
    expect(ranked).toEqual(["1_0", "unknown_tile"]);
  });

  it("uses axial coord (q then r) as the tiebreaker on equal scores", () => {
    const equalScore = { hostileNeighbors: 0, distanceToEnemy: 5, score: 0 };
    const ranked = rankTileIdsByThreat(
      ["3_2", "1_5", "1_4"],
      new Map([
        ["3_2", equalScore],
        ["1_5", equalScore],
        ["1_4", equalScore],
      ])
    );
    // q ascending: 1_4 (q=1, r=4) < 1_5 (q=1, r=5) < 3_2 (q=3, r=2)
    expect(ranked).toEqual(["1_4", "1_5", "3_2"]);
  });
});
