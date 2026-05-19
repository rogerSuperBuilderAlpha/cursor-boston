/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  applyRedistributionLoss,
  canDeclareLastStand,
  canExitDefensiveStance,
  computeZeroTurnDefenseBonus,
  countMeditatingHeroes,
  countRecentRedistributions,
  defaultLossPerturbations,
  hasActiveLastStand,
  isHeroMeditating,
  isTileInDefensiveStance,
  lastStandCooldownRemainingMs,
  maxDefensiveStanceTiles,
  oathbreakerAttackPenalty,
  redistributionsRemainingToday,
  runAutopsy,
} from "@/lib/game/zero-turn";
import {
  DEFENSIVE_STANCE_DEFENSE_BONUS,
  LAST_STAND_ADJACENT_PENALTY,
  LAST_STAND_COOLDOWN_MS,
  LAST_STAND_DEFENSE_BONUS,
  OATHBREAKER_ATTACK_PENALTY,
  REDISTRIBUTE_MAX_PER_DAY,
  REDISTRIBUTE_TRANSIT_LOSS,
} from "@/lib/game/types";
import type { GameHero, GamePlayer, GameTile } from "@/lib/game/types";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const PAST = new Date("2026-06-01T10:00:00.000Z");
const FUTURE = new Date("2026-06-02T12:00:00.000Z");

function hero(overrides: Partial<GameHero> = {}): GameHero {
  return {
    id: "h1",
    ownerId: "u1",
    tileId: "q0r0",
    class: "military",
    specialty: "ground",
    name: "Test",
    caste: "white",
    stamina: 100,
    staminaMax: 100,
    emergedAtTurn: 0,
    lastEngagedAtTurn: 0,
    ...overrides,
  };
}

function player(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: "u1",
    displayName: "Test",
    caste: "white",
    turnsRemaining: 0,
    turnsSpentTotal: 0,
    phase: "play",
    tilesExplored: 0,
    shieldUntil: new Date(0),
    shieldDropAtTurn: 0,
    productionSpellsActive: [],
    stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 0, unitsAlive: 0 },
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe("isHeroMeditating", () => {
  it("returns false when no meditatingUntil set", () => {
    expect(isHeroMeditating(hero(), NOW)).toBe(false);
  });
  it("returns true when meditatingUntil > now", () => {
    expect(isHeroMeditating(hero({ meditatingUntil: FUTURE }), NOW)).toBe(true);
  });
  it("returns false when meditatingUntil < now (expired)", () => {
    expect(isHeroMeditating(hero({ meditatingUntil: PAST }), NOW)).toBe(false);
  });
  it("returns false when hero is null", () => {
    expect(isHeroMeditating(null, NOW)).toBe(false);
  });
  it("accepts a Firestore Timestamp-like object via the toMillis branch", () => {
    const futureMillis = FUTURE.getTime();
    const timestampLike = { toMillis: () => futureMillis } as unknown as Date;
    expect(isHeroMeditating(hero({ meditatingUntil: timestampLike }), NOW)).toBe(true);
  });
  it("returns false for an unrecognised meditatingUntil shape (no Date, no toMillis)", () => {
    const garbage = { foo: "bar" } as unknown as Date;
    expect(isHeroMeditating(hero({ meditatingUntil: garbage }), NOW)).toBe(false);
  });
});

describe("countMeditatingHeroes", () => {
  it("counts only currently-meditating heroes", () => {
    const tiles = [
      { hero: hero({ meditatingUntil: FUTURE }) },
      { hero: hero({ meditatingUntil: PAST }) },
      { hero: hero() },
      { hero: undefined },
    ] as Pick<GameTile, "hero">[];
    expect(countMeditatingHeroes(tiles, NOW)).toBe(1);
  });
});

describe("oathbreakerAttackPenalty", () => {
  it("returns 0 when no mark set", () => {
    expect(oathbreakerAttackPenalty(player(), NOW)).toBe(0);
  });
  it("returns the penalty when mark is active", () => {
    expect(
      oathbreakerAttackPenalty(player({ oathbreakerUntil: FUTURE }), NOW)
    ).toBe(OATHBREAKER_ATTACK_PENALTY);
  });
  it("returns 0 when mark has expired", () => {
    expect(
      oathbreakerAttackPenalty(player({ oathbreakerUntil: PAST }), NOW)
    ).toBe(0);
  });
});

describe("maxDefensiveStanceTiles", () => {
  it("returns at least 1 even for small empires", () => {
    expect(maxDefensiveStanceTiles(player())).toBe(1);
  });
  it("scales with empire size (floor(tilesHeld / 100))", () => {
    expect(
      maxDefensiveStanceTiles(
        player({
          stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 250, unitsAlive: 0 },
        })
      )
    ).toBe(2);
    expect(
      maxDefensiveStanceTiles(
        player({
          stats: {
            attacksWon: 0,
            attacksLost: 0,
            tilesHeld: 10000,
            unitsAlive: 0,
          },
        })
      )
    ).toBe(100);
  });
});

describe("isTileInDefensiveStance", () => {
  it("returns false when no stance set", () => {
    expect(isTileInDefensiveStance({}, NOW)).toBe(false);
  });
  it("returns true when active and since <= now", () => {
    expect(
      isTileInDefensiveStance(
        {
          defensiveStance: { active: true, since: PAST, lockedUntil: FUTURE },
        },
        NOW
      )
    ).toBe(true);
  });
  it("returns false when active=false (toggled off)", () => {
    expect(
      isTileInDefensiveStance(
        {
          defensiveStance: { active: false, since: PAST, lockedUntil: PAST },
        },
        NOW
      )
    ).toBe(false);
  });
});

describe("canExitDefensiveStance", () => {
  it("allows exit when no stance", () => {
    expect(canExitDefensiveStance({}, NOW)).toBe(true);
  });
  it("allows exit when lockedUntil < now", () => {
    expect(
      canExitDefensiveStance(
        {
          defensiveStance: { active: true, since: PAST, lockedUntil: PAST },
        },
        NOW
      )
    ).toBe(true);
  });
  it("blocks exit when lockedUntil > now", () => {
    expect(
      canExitDefensiveStance(
        {
          defensiveStance: { active: true, since: PAST, lockedUntil: FUTURE },
        },
        NOW
      )
    ).toBe(false);
  });
});

describe("hasActiveLastStand", () => {
  it("returns false with no last stand", () => {
    expect(hasActiveLastStand({}, NOW)).toBe(false);
  });
  it("returns true when expires > now", () => {
    expect(
      hasActiveLastStand(
        { activeLastStand: { declaredAt: PAST, expiresAt: FUTURE } },
        NOW
      )
    ).toBe(true);
  });
  it("returns false when expired", () => {
    expect(
      hasActiveLastStand(
        { activeLastStand: { declaredAt: PAST, expiresAt: PAST } },
        NOW
      )
    ).toBe(false);
  });
});

describe("canDeclareLastStand + cooldown", () => {
  it("allows when never used", () => {
    expect(canDeclareLastStand(player(), NOW)).toBe(true);
    expect(lastStandCooldownRemainingMs(player(), NOW)).toBe(0);
  });
  it("blocks within cooldown", () => {
    const used = new Date(NOW.getTime() - 1 * 60 * 60 * 1000); // 1h ago
    expect(canDeclareLastStand(player({ lastStandUsedAt: used }), NOW)).toBe(false);
    const remaining = lastStandCooldownRemainingMs(
      player({ lastStandUsedAt: used }),
      NOW
    );
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(LAST_STAND_COOLDOWN_MS);
  });
  it("allows past cooldown", () => {
    const used = new Date(NOW.getTime() - LAST_STAND_COOLDOWN_MS - 1000);
    expect(canDeclareLastStand(player({ lastStandUsedAt: used }), NOW)).toBe(true);
  });
});

describe("computeZeroTurnDefenseBonus", () => {
  it("returns 0 with no effects", () => {
    expect(computeZeroTurnDefenseBonus({ tile: {}, now: NOW })).toBe(0);
  });
  it("stacks stance + last stand", () => {
    const bonus = computeZeroTurnDefenseBonus({
      tile: {
        defensiveStance: { active: true, since: PAST, lockedUntil: FUTURE },
        activeLastStand: { declaredAt: PAST, expiresAt: FUTURE },
      },
      now: NOW,
    });
    expect(bonus).toBeCloseTo(
      DEFENSIVE_STANCE_DEFENSE_BONUS + LAST_STAND_DEFENSE_BONUS,
      10
    );
  });
  it("applies adjacent-rally penalty", () => {
    const bonus = computeZeroTurnDefenseBonus({
      tile: {},
      adjacentRallyPenaltyActive: true,
      now: NOW,
    });
    expect(bonus).toBe(-LAST_STAND_ADJACENT_PENALTY);
  });
});

describe("applyRedistributionLoss", () => {
  it("trims each unit type by REDISTRIBUTE_TRANSIT_LOSS", () => {
    const moved = applyRedistributionLoss({ ground: 100, siege: 50, air: 0 });
    expect(moved.ground).toBe(Math.floor(100 * (1 - REDISTRIBUTE_TRANSIT_LOSS)));
    expect(moved.siege).toBe(Math.floor(50 * (1 - REDISTRIBUTE_TRANSIT_LOSS)));
    expect(moved.air).toBe(0);
  });
});

describe("countRecentRedistributions + remainingToday", () => {
  it("counts only entries within the last 24h", () => {
    const recent = [
      new Date(NOW.getTime() - 1 * 60 * 60 * 1000), // 1h ago
      new Date(NOW.getTime() - 23 * 60 * 60 * 1000), // 23h ago
      new Date(NOW.getTime() - 25 * 60 * 60 * 1000), // 25h ago (outside window)
    ];
    expect(countRecentRedistributions(recent, NOW)).toBe(2);
  });
  it("remainingToday = max - count", () => {
    const recent = [new Date(NOW.getTime() - 1 * 60 * 60 * 1000)];
    expect(redistributionsRemainingToday(recent, NOW)).toBe(
      REDISTRIBUTE_MAX_PER_DAY - 1
    );
  });
});

describe("runAutopsy", () => {
  it("calls the resolver for each perturbation with the SAME seed", () => {
    const seeds: string[] = [];
    const resolveAttackFn = jest.fn(() => ({
      outcome: "captured" as const,
      // Minimal CombatResult fields needed by the autopsy summarizer.
      unitsDeployed: { ground: 0, siege: 0, air: 0 },
      unitsClampedFromCapacity: 0,
      attackPower: 0,
      defensePower: 0,
      attackerLosses: { ground: 0, siege: 0, air: 0 },
      defenderLosses: { ground: 0, siege: 0, air: 0 },
      underdogApplied: false,
      supplyMultiplier: 1,
      sourceLandTypeMultiplier: 1,
      targetLandTypeMultiplier: 1,
      standingDefenseAdded: 0,
      magicTileOffenseSpellBonusApplied: false,
      magicTileDefenseSpellBonusApplied: false,
      siegeDebuffApplied: 0,
      defenseDisarmApplied: 0,
      preCastOffenseApplied: 0,
      rng: { attackerRoll: 0.5, defenderRoll: 0.5 },
      appliedSpells: { offenseId: null, defenseId: null },
      finalAttack: 0,
      finalDefense: 0,
      defenderUnitsPreAttack: { ground: 0, siege: 0, air: 0 },
      defenderBasePreAttack: { ground: 0, siege: 0, air: 0 },
      decisiveness: 0,
      lossCurveTag: "decisive-capture" as const,
      captureBaseRetentionFactor: 1,
    }));
    const rngFactory = jest.fn((seed: string) => {
      seeds.push(seed);
      return () => 0.5;
    });
    const outcomes = runAutopsy({
      attacker: {
        caste: "white",
        units: { ground: 100, siege: 0, air: 0 },
        offenseSpellId: null,
        magicLandCount: 0,
        unitsAlive: 100,
      },
      defender: {
        caste: "red",
        unitsOnTile: { ground: 50, siege: 0, air: 0 },
        armedDefenseSpellId: null,
        magicLandCount: 0,
        unitsAlive: 50,
      },
      tile: { capacity: 100, upgradeIds: [] },
      rngSeed: "attack-1",
      originalOutcome: "repelled",
      perturbations: [
        { label: "+25 ground", unitsDelta: { ground: 25 } },
        { label: "+50 siege", unitsDelta: { siege: 50 } },
      ],
      resolveAttackFn,
      rngFactory,
    });
    expect(outcomes).toHaveLength(2);
    expect(seeds).toEqual(["attack-1", "attack-1"]);
    expect(outcomes[0].outcomeFlipped).toBe(true);
    expect(outcomes[0].summary).toContain("flipped");
  });
});

describe("defaultLossPerturbations", () => {
  it("emits one perturbation per unit type", () => {
    const perts = defaultLossPerturbations({ ground: 100, siege: 60, air: 40 });
    expect(perts).toHaveLength(3);
    expect(perts[0].unitsDelta).toEqual({ ground: 25 });
    expect(perts[1].unitsDelta).toEqual({ siege: 25 });
    expect(perts[2].unitsDelta).toEqual({ air: 25 });
  });
});
