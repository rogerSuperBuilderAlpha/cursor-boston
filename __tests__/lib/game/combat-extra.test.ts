/**
 * Coverage sprint 80 — additional branches in lib/game/combat.ts not
 * exercised by combat.test.ts (zero-turn bonuses, oathbreaker, BASE helpers).
 */
import {
  applyBaseRegen,
  applyFlyoverModifiers,
  baseUnitsTarget,
  computeSupplyMultiplier,
  resolveAttack,
  makeSeededRng,
} from "@/lib/game/combat";
import type { CombatResult, UnitStack } from "@/lib/game/types";

function stack(g = 0, s = 0, a = 0): UnitStack {
  return { ground: g, siege: s, air: a };
}

function defaultAttacker(overrides: Record<string, unknown> = {}) {
  return {
    caste: "red" as const,
    units: stack(80, 40, 20),
    offenseSpellId: null,
    magicLandCount: 0,
    unitsAlive: 500,
    ...overrides,
  };
}

function defaultDefender(overrides: Record<string, unknown> = {}) {
  return {
    caste: "white" as const,
    unitsOnTile: stack(40, 20, 10),
    armedDefenseSpellId: null,
    magicLandCount: 0,
    unitsAlive: 200,
    ...overrides,
  };
}

function defaultTile(overrides: Record<string, unknown> = {}) {
  return { capacity: 500, upgradeIds: [], ...overrides };
}

function combatStub(overrides: Partial<CombatResult> = {}): CombatResult {
  return {
    outcome: "repelled",
    unitsDeployed: stack(10, 0, 0),
    unitsClampedFromCapacity: stack(0, 0, 0),
    attackPower: 100,
    defensePower: 120,
    attackerLosses: stack(2, 0, 0),
    defenderLosses: stack(1, 0, 0),
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
    rng: { attackerRoll: 1, defenderRoll: 1 },
    appliedSpells: { offenseId: null, defenseId: null },
    finalAttack: 100,
    finalDefense: 120,
    defenderUnitsPreAttack: stack(40, 20, 10),
    defenderBasePreAttack: stack(0, 0, 0),
    decisiveness: 0.2,
    lossCurveTag: "close-repel",
    captureBaseRetentionFactor: 1,
    ...overrides,
  };
}

describe("resolveAttack — zero-turn and oathbreaker modifiers", () => {
  it("boosts defense with a positive zeroTurnDefenseBonus", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(),
      makeSeededRng("zero-turn-baseline"),
    );
    const boosted = resolveAttack(
      defaultAttacker(),
      defaultDefender({ zeroTurnDefenseBonus: 0.25 }),
      defaultTile(),
      makeSeededRng("zero-turn-baseline"),
    );
    expect(boosted.defensePower).toBeGreaterThan(baseline.defensePower);
  });

  it("penalizes defense with a negative zeroTurnDefenseBonus", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(),
      makeSeededRng("zero-turn-penalty"),
    );
    const penalized = resolveAttack(
      defaultAttacker(),
      defaultDefender({ zeroTurnDefenseBonus: -0.2 }),
      defaultTile(),
      makeSeededRng("zero-turn-penalty"),
    );
    expect(penalized.defensePower).toBeLessThan(baseline.defensePower);
  });

  it("reduces attack power when oathbreakerPenalty is active", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(),
      makeSeededRng("oathbreaker-off"),
    );
    const penalized = resolveAttack(
      defaultAttacker({ oathbreakerPenalty: 0.3 }),
      defaultDefender(),
      defaultTile(),
      makeSeededRng("oathbreaker-off"),
    );
    expect(penalized.attackPower).toBeLessThan(baseline.attackPower);
  });
});

describe("computeSupplyMultiplier — neighbor land types", () => {
  it("returns the isolation floor with no neighbors", () => {
    expect(computeSupplyMultiplier("white", [])).toBeCloseTo(0.85, 5);
  });

  it("weights food neighbors lower than military neighbors", () => {
    const military = computeSupplyMultiplier(
      "white",
      Array(4).fill({ landType: "military" as const }),
    );
    const food = computeSupplyMultiplier(
      "white",
      Array(4).fill({ landType: "food" as const }),
    );
    expect(military).toBeGreaterThan(food);
  });
});

describe("baseUnitsTarget — entrenchment, buffs, production spells", () => {
  const oldNow = new Date("2026-06-01T12:00:00Z");

  it("applies entrenchment for aged owned tiles", () => {
    const young = baseUnitsTarget({
      landType: "military",
      caste: "red",
      createdAt: new Date("2026-05-30T12:00:00Z"),
      now: oldNow,
    });
    const entrenched = baseUnitsTarget({
      landType: "military",
      caste: "red",
      createdAt: new Date("2025-01-01T12:00:00Z"),
      now: oldNow,
    });
    expect(entrenched.ground).toBeGreaterThan(young.ground);
  });

  it("ignores expired intrinsic buffs but counts active ones", () => {
    const without = baseUnitsTarget({
      landType: "military",
      caste: "red",
      now: oldNow,
    });
    const withActive = baseUnitsTarget({
      landType: "military",
      caste: "red",
      now: oldNow,
      intrinsicBuffs: [
        {
          baseCountBonus: { ground: 5, siege: 0, air: 0 },
          expiresAt: new Date("2026-07-01T12:00:00Z"),
        },
        {
          baseCountBonus: { ground: 99, siege: 0, air: 0 },
          expiresAt: new Date("2026-01-01T12:00:00Z"),
        },
      ],
    });
    expect(withActive.ground).toBeGreaterThan(without.ground);
    expect(withActive.ground).toBe(without.ground + 5);
  });

  it("boosts counts when production spells are active", () => {
    const baseline = baseUnitsTarget({
      landType: "military",
      caste: "green",
      now: oldNow,
    });
    const boosted = baseUnitsTarget({
      landType: "military",
      caste: "green",
      now: oldNow,
      productionSpellsActive: [{ spellId: "growth", expiresAtMs: oldNow.getTime() + 60_000 }],
    });
    expect(boosted.ground).toBeGreaterThanOrEqual(baseline.ground);
  });

  it("accepts Firestore-style createdAt seconds timestamps", () => {
    const fromSeconds = baseUnitsTarget({
      landType: "military",
      caste: "red",
      createdAt: { seconds: Math.floor(new Date("2024-01-01").getTime() / 1000) },
      now: oldNow,
    });
    expect(fromSeconds.ground).toBeGreaterThan(0);
  });
});

describe("applyBaseRegen — timestamp shapes", () => {
  it("reads baseRegenedAt from seconds-based timestamps", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const result = applyBaseRegen({
      currentBase: stack(0, 0, 0),
      target: stack(20, 0, 0),
      landType: "military",
      baseRegenedAt: { seconds: Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000) },
      now,
    });
    expect(result.deltaUnits).toBeGreaterThan(0);
  });
});

describe("applyFlyoverModifiers — repelled raids", () => {
  it("doubles attacker losses without changing a repelled outcome", () => {
    const before = combatStub({ outcome: "repelled", attackerLosses: stack(3, 1, 0) });
    const after = applyFlyoverModifiers(before);
    expect(after.outcome).toBe("repelled");
    expect(after.attackerLosses.ground).toBe(6);
    expect(after.attackerLosses.siege).toBe(0);
  });
});
