/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { deriveThreatEntries } from "@/app/game/threats/_lib/threats-derive";
import type { OwnerSummary } from "@/app/game/_lib/dashboard-types";
import type { LandType, MapTile } from "@/lib/game/types";

function tile(args: {
  q: number;
  r: number;
  ownerId: string | null;
  type?: LandType;
  ground?: number;
  siege?: number;
  air?: number;
}): MapTile {
  return {
    tileId: `${args.q}_${args.r}`,
    q: args.q,
    r: args.r,
    type: args.type ?? "military",
    ownerId: args.ownerId,
    units: {
      ground: args.ground ?? 0,
      siege: args.siege ?? 0,
      air: args.air ?? 0,
    },
    armedDefenseSpellId: null,
  };
}

function owner(userId: string, displayName: string, shielded = false): OwnerSummary {
  return { userId, displayName, caste: null, shielded };
}

describe("deriveThreatEntries", () => {
  it("returns empty for empty inputs", () => {
    expect(
      deriveThreatEntries({
        myUserId: "me",
        myCaste: null,
        myTiles: [],
        worldTiles: [],
        worldOwners: new Map(),
      })
    ).toEqual([]);
  });

  it("returns empty when no enemy tile borders any of mine", () => {
    const mine = [tile({ q: 0, r: 0, ownerId: "me" })];
    // Enemy is two tiles away (not a neighbor).
    const enemy = [tile({ q: 5, r: 5, ownerId: "foe", ground: 5 })];
    const owners = new Map<string, OwnerSummary>([["foe", owner("foe", "Foe")]]);
    expect(
      deriveThreatEntries({
        myUserId: "me",
        myCaste: null,
        myTiles: mine,
        worldTiles: enemy,
        worldOwners: owners,
      })
    ).toEqual([]);
  });

  it("creates one entry per enemy tile bordering my territory", () => {
    // me: (0,0)
    // enemyA: (1,0) — adjacent to me
    // enemyB: (-1,0) — adjacent to me, different owner
    // enemyC: (5,5) — far away
    const mine = [tile({ q: 0, r: 0, ownerId: "me", ground: 50 })];
    const world = [
      tile({ q: 1, r: 0, ownerId: "foeA", ground: 10 }),
      tile({ q: -1, r: 0, ownerId: "foeB", ground: 20 }),
      tile({ q: 5, r: 5, ownerId: "foeC", ground: 30 }),
    ];
    const owners = new Map<string, OwnerSummary>([
      ["foeA", owner("foeA", "FoeA")],
      ["foeB", owner("foeB", "FoeB")],
      ["foeC", owner("foeC", "FoeC")],
    ]);
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: null,
      myTiles: mine,
      worldTiles: world,
      worldOwners: owners,
    });
    expect(result).toHaveLength(2);
    const ids = result.map((e) => e.enemyTile.tileId).sort();
    expect(ids).toEqual(["-1_0", "1_0"]);
  });

  it("picks the strongest source when multiple of mine border the same enemy", () => {
    // mine A at (0,0) — 50 units; mine B at (2,-1) — 100 units
    // enemy at (1,0) — borders both. B should win (larger total).
    const weak = tile({ q: 0, r: 0, ownerId: "me", ground: 50 });
    const strong = tile({ q: 2, r: -1, ownerId: "me", ground: 100 });
    const enemy = tile({ q: 1, r: 0, ownerId: "foe", ground: 10 });
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: null,
      myTiles: [weak, strong],
      worldTiles: [enemy],
      worldOwners: new Map([["foe", owner("foe", "Foe")]]),
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.bestSource.tileId).toBe(strong.tileId);
    expect(result[0]!.candidateSources).toHaveLength(2);
  });

  it("sorts entries by myAdvantage descending (easiest first)", () => {
    // Two enemies both bordering my one tile (50 units).
    // weak enemy at (1,0): 5 units → advantage 10
    // tough enemy at (-1,0): 50 units → advantage 1
    const mine = tile({ q: 0, r: 0, ownerId: "me", ground: 50 });
    const weakEnemy = tile({ q: 1, r: 0, ownerId: "weak", ground: 5 });
    const toughEnemy = tile({ q: -1, r: 0, ownerId: "tough", ground: 50 });
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: null,
      myTiles: [mine],
      worldTiles: [weakEnemy, toughEnemy],
      worldOwners: new Map([
        ["weak", owner("weak", "Weak")],
        ["tough", owner("tough", "Tough")],
      ]),
    });
    expect(result.map((e) => e.enemyTile.tileId)).toEqual(["1_0", "-1_0"]);
    expect(result[0]!.myAdvantage).toBeGreaterThan(result[1]!.myAdvantage);
  });

  it("uses supply multiplier when caste is set (boosting source strength)", () => {
    // Two equal-unit candidate sources; one has a friendly military neighbor,
    // the other is isolated. Caste is "green" (highest supplyMultiplier).
    // Supply-boosted source must win.
    const supplied = tile({ q: 0, r: 0, ownerId: "me", ground: 50 });
    const friendlyNeighbor = tile({ q: 1, r: 0, ownerId: "me", type: "military" });
    const isolated = tile({ q: 5, r: 5, ownerId: "me", ground: 50 });
    // enemy at (2,0) borders only `friendlyNeighbor` (a military tile owned by me),
    // so we need an enemy adjacent to BOTH supplied and isolated. Place enemy at
    // (-1,0) (adjacent to supplied) and another enemy at (4,5) (adjacent to isolated).
    // Then run them through derive separately to assert supply impact.
    const enemyA = tile({ q: -1, r: 0, ownerId: "foe", ground: 5 });
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: "green",
      myTiles: [supplied, friendlyNeighbor, isolated],
      worldTiles: [enemyA],
      worldOwners: new Map([["foe", owner("foe", "Foe")]]),
    });
    expect(result).toHaveLength(1);
    // The supplied tile is the only one bordering enemyA.
    expect(result[0]!.bestSource.tileId).toBe(supplied.tileId);
    // Supply multiplier > 1 because of the friendly military neighbor.
    expect(result[0]!.bestSourceSupply).toBeGreaterThan(1);
  });

  it("filters out unassigned/unrevealed tiles from friendly neighbor supply", () => {
    // mine: (0,0) military, (1,0) unassigned. Enemy at (2,0) borders (1,0) only.
    // Even with caste set, the friendly neighbor (0,0) is filtered out because
    // (1,0) isn't supplying anything (it's the source itself), and there's no
    // contributing neighbor — so supply == isolation floor.
    const source = tile({ q: 1, r: 0, ownerId: "me", ground: 30 });
    const unassigned = tile({ q: 0, r: 0, ownerId: "me", type: "unassigned" });
    const enemy = tile({ q: 2, r: 0, ownerId: "foe", ground: 5 });
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: "red",
      myTiles: [source, unassigned],
      worldTiles: [enemy],
      worldOwners: new Map([["foe", owner("foe", "Foe")]]),
    });
    expect(result).toHaveLength(1);
    // Supply <= 1 because the unassigned neighbor doesn't contribute.
    expect(result[0]!.bestSourceSupply).toBeLessThan(1);
  });

  it("ignores tiles owned by me even if they share a border with an enemy", () => {
    // me has two tiles; one adjacent enemy. Should never include my own as enemy.
    const mineA = tile({ q: 0, r: 0, ownerId: "me", ground: 30 });
    const mineB = tile({ q: 1, r: 0, ownerId: "me", ground: 60 });
    const enemy = tile({ q: 2, r: 0, ownerId: "foe", ground: 10 });
    const result = deriveThreatEntries({
      myUserId: "me",
      myCaste: null,
      myTiles: [mineA, mineB],
      worldTiles: [enemy],
      worldOwners: new Map([["foe", owner("foe", "Foe")]]),
    });
    expect(result).toHaveLength(1);
    // Only mineB borders the enemy — must be the chosen source.
    expect(result[0]!.bestSource.tileId).toBe(mineB.tileId);
    expect(result[0]!.candidateSources).toHaveLength(1);
  });
});
