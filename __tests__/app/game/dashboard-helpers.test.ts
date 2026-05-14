/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  asDate,
  countUnshieldedNeighbors,
  deriveShieldStatus,
  describeShieldRemaining,
  formatCountdown,
} from "@/app/game/_lib/dashboard-helpers";
import type { OwnerSummary } from "@/app/game/_lib/dashboard-types";
import type { GamePlayer, MapTile } from "@/lib/game/types";

function makeTile(
  q: number,
  r: number,
  ownerId: string | null = null
): MapTile {
  return {
    tileId: `${q}_${r}`,
    q,
    r,
    type: "unassigned",
    ownerId,
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };
}

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: "me",
    displayName: "Test General",
    caste: null,
    phase: "play",
    turnsRemaining: 100,
    turnsSpentTotal: 0,
    shieldUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    shieldDropAtTurn: 50,
    activeUpgrades: {},
    artifacts: [],
    stats: { tilesHeld: 25, attacksWon: 0, attacksLost: 0 },
    lastWeeklyGrantWeekStart: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GamePlayer;
}

describe("asDate", () => {
  it("returns the same Date instance unchanged", () => {
    const d = new Date("2026-05-07T12:00:00Z");
    expect(asDate(d)).toBe(d);
  });

  it("parses Firestore admin Timestamp shape (`_seconds`)", () => {
    const d = asDate({ _seconds: 1_700_000_000, _nanoseconds: 500_000_000 });
    expect(d.getTime()).toBe(1_700_000_000_500);
  });

  it("calls .toDate() on a client Timestamp shape", () => {
    const inner = new Date("2026-01-01T00:00:00Z");
    expect(asDate({ toDate: () => inner }).getTime()).toBe(inner.getTime());
  });

  it("parses ISO strings and millis numbers", () => {
    expect(asDate("2026-05-07T00:00:00Z").getUTCFullYear()).toBe(2026);
    expect(asDate(123).getTime()).toBe(123);
  });

  it("returns epoch for null/undefined/unknown shapes", () => {
    expect(asDate(null).getTime()).toBe(0);
    expect(asDate(undefined).getTime()).toBe(0);
    expect(asDate({ random: "shape" }).getTime()).toBe(0);
  });
});

describe("deriveShieldStatus", () => {
  it("is shielded when both time and turn budget remain", () => {
    const p = makePlayer({
      shieldUntil: new Date(Date.now() + 5 * 86_400_000),
      shieldDropAtTurn: 100,
      turnsSpentTotal: 30,
    });
    const s = deriveShieldStatus(p);
    expect(s.shielded).toBe(true);
    expect(s.daysLeft).toBeGreaterThan(0);
    expect(s.turnsLeft).toBe(70);
    expect(s.bottleneck).toBe("both");
  });

  it("drops as soon as the time clock expires", () => {
    const p = makePlayer({
      shieldUntil: new Date(Date.now() - 1000),
      shieldDropAtTurn: 100,
      turnsSpentTotal: 30,
    });
    const s = deriveShieldStatus(p);
    expect(s.shielded).toBe(false);
    expect(s.bottleneck).toBe("turns");
  });

  it("drops as soon as the turn-spend cap is hit even with time remaining", () => {
    const p = makePlayer({
      shieldUntil: new Date(Date.now() + 5 * 86_400_000),
      shieldDropAtTurn: 50,
      turnsSpentTotal: 50,
    });
    const s = deriveShieldStatus(p);
    expect(s.shielded).toBe(false);
    expect(s.turnsLeft).toBe(0);
    expect(s.bottleneck).toBe("time");
  });
});

describe("describeShieldRemaining", () => {
  it("reads 'Down' when shield is down", () => {
    expect(
      describeShieldRemaining({
        shielded: false,
        daysLeft: 0,
        turnsLeft: 0,
        bottleneck: "none",
      })
    ).toBe("Down");
  });

  it("describes both bottlenecks when 'both'", () => {
    const out = describeShieldRemaining({
      shielded: true,
      daysLeft: 5,
      turnsLeft: 70,
      bottleneck: "both",
    });
    expect(out).toMatch(/5d left/);
    expect(out).toMatch(/70 more turns/);
  });
});

describe("countUnshieldedNeighbors", () => {
  // Layout (axial): me at (0,0). Neighbors at the 6 axial offsets.
  const myTiles = [makeTile(0, 0, "me")];

  it("returns zero when there are no border tiles", () => {
    const out = countUnshieldedNeighbors("me", myTiles, [], new Map());
    expect(out.unshieldedNeighbors).toBe(0);
    expect(out.totalForeignNeighbors).toBe(0);
  });

  it("counts unique unshielded foreign generals (not tiles)", () => {
    // Two tiles owned by enemyA touching me — should count as 1 general.
    const world = [
      makeTile(1, 0, "enemyA"),
      makeTile(0, 1, "enemyA"),
      makeTile(-1, 0, "enemyB"),
    ];
    const owners = new Map<string, OwnerSummary>([
      [
        "enemyA",
        { userId: "enemyA", displayName: "A", caste: null, shielded: false },
      ],
      [
        "enemyB",
        { userId: "enemyB", displayName: "B", caste: null, shielded: false },
      ],
    ]);
    const out = countUnshieldedNeighbors("me", myTiles, world, owners);
    expect(out.totalForeignNeighbors).toBe(2);
    expect(out.unshieldedNeighbors).toBe(2);
    expect(out.topNeighborNames).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("excludes shielded enemies from the unshielded count", () => {
    const world = [makeTile(1, 0, "enemyA"), makeTile(-1, 0, "enemyB")];
    const owners = new Map<string, OwnerSummary>([
      [
        "enemyA",
        { userId: "enemyA", displayName: "A", caste: null, shielded: true },
      ],
      [
        "enemyB",
        { userId: "enemyB", displayName: "B", caste: null, shielded: false },
      ],
    ]);
    const out = countUnshieldedNeighbors("me", myTiles, world, owners);
    expect(out.totalForeignNeighbors).toBe(2);
    expect(out.unshieldedNeighbors).toBe(1);
    expect(out.topNeighborNames).toEqual(["B"]);
  });

  it("ignores own and unowned tiles in the border ring", () => {
    const world = [
      makeTile(1, 0, "me"),
      makeTile(0, 1, null),
      makeTile(-1, 0, "enemyA"),
    ];
    const owners = new Map<string, OwnerSummary>([
      [
        "enemyA",
        { userId: "enemyA", displayName: "A", caste: null, shielded: false },
      ],
    ]);
    const out = countUnshieldedNeighbors("me", myTiles, world, owners);
    expect(out.totalForeignNeighbors).toBe(1);
  });

  it("caps top names at 3", () => {
    const world = [
      makeTile(1, 0, "e1"),
      makeTile(0, 1, "e2"),
      makeTile(-1, 1, "e3"),
      makeTile(-1, 0, "e4"),
      makeTile(0, -1, "e5"),
    ];
    const owners = new Map<string, OwnerSummary>(
      ["e1", "e2", "e3", "e4", "e5"].map((id) => [
        id,
        { userId: id, displayName: id.toUpperCase(), caste: null, shielded: false },
      ])
    );
    const out = countUnshieldedNeighbors("me", myTiles, world, owners);
    expect(out.topNeighborNames).toHaveLength(3);
  });
});

describe("formatCountdown", () => {
  it("reads 'any moment now' for zero or negative ms", () => {
    expect(formatCountdown(0)).toBe("any moment now");
    expect(formatCountdown(-5000)).toBe("any moment now");
  });

  it("formats days when >24h remain", () => {
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 5 * 60_000;
    expect(formatCountdown(ms)).toMatch(/^2d 3h 5m$/);
  });

  it("formats hours when <24h", () => {
    const ms = 4 * 3_600_000 + 12 * 60_000 + 30_000;
    expect(formatCountdown(ms)).toMatch(/^4h 12m 30s$/);
  });

  it("formats minutes+seconds when <1h", () => {
    expect(formatCountdown(95_000)).toBe("1m 35s");
  });
});
