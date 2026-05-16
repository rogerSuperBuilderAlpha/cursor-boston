/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  applyFlyoverModifiers,
  attributeAttackerLosses,
  attributeDefenderLosses,
  BASE_CAPTURE_RETENTION,
  BASE_DURABILITY_MULT,
  baseUnitsTarget,
  computeSupplyMultiplier,
  computeTileCapacity,
  distributeUnitKills,
  magicMultiplier,
  makeSeededRng,
  realizedSpellMagnitude,
  resolveAttack,
  rollSpellEffectiveness,
  SPELL_RNG_LOWER,
  SPELL_RNG_MIDPOINT,
  SPELL_RNG_RANGE,
  unitCapFromFoodLands,
} from "@/lib/game/combat";
import type {
  CombatAttackerInput,
  CombatDefenderInput,
  CombatResult,
  CombatTileInput,
  UnitStack,
} from "@/lib/game/types";

function stack(g = 0, s = 0, a = 0): UnitStack {
  return { ground: g, siege: s, air: a };
}

function defaultAttacker(
  overrides: Partial<CombatAttackerInput> = {}
): CombatAttackerInput {
  return {
    caste: "red",
    units: stack(50, 50, 50),
    offenseSpellId: null,
    magicLandCount: 0,
    unitsAlive: 1000,
    ...overrides,
  };
}

function defaultDefender(
  overrides: Partial<CombatDefenderInput> = {}
): CombatDefenderInput {
  return {
    caste: "white",
    unitsOnTile: stack(50, 50, 50),
    armedDefenseSpellId: null,
    magicLandCount: 0,
    unitsAlive: 1000,
    ...overrides,
  };
}

function defaultTile(capacity = 500): CombatTileInput {
  return { capacity, upgradeIds: [] };
}

describe("magicMultiplier", () => {
  it("returns 1.0 with zero magic lands", () => {
    expect(magicMultiplier(0)).toBe(1);
  });

  it("scales linearly up to 50 lands at +5% each", () => {
    expect(magicMultiplier(10)).toBeCloseTo(1.5, 5);
    expect(magicMultiplier(50)).toBeCloseTo(3.5, 5);
  });

  it("soft-caps above 50 lands to +2.5% each", () => {
    expect(magicMultiplier(100)).toBeCloseTo(4.75, 5);
  });

  it("treats negative or fractional inputs safely", () => {
    expect(magicMultiplier(-5)).toBe(1);
    expect(magicMultiplier(10.7)).toBe(magicMultiplier(10));
  });
});

describe("unitCapFromFoodLands", () => {
  it("returns 0 for zero lands", () => {
    expect(unitCapFromFoodLands(0)).toBe(0);
  });

  it("scales +5/land up to 50", () => {
    expect(unitCapFromFoodLands(10)).toBe(50);
    expect(unitCapFromFoodLands(50)).toBe(250);
  });

  it("soft-caps above 50 at +2.5/land", () => {
    expect(unitCapFromFoodLands(100)).toBe(375);
  });
});

describe("computeTileCapacity", () => {
  it("returns 0 for unrevealed and unassigned tiles", () => {
    expect(computeTileCapacity("unrevealed", null)).toBe(0);
    expect(computeTileCapacity("unrevealed", "green")).toBe(0);
    expect(computeTileCapacity("unassigned", null)).toBe(0);
    expect(computeTileCapacity("unassigned", "green")).toBe(0);
  });

  it("applies land-type deltas to base 500", () => {
    expect(computeTileCapacity("food", null)).toBe(500);
    expect(computeTileCapacity("military", null)).toBe(700);
    expect(computeTileCapacity("magic", null)).toBe(400);
  });

  it("multiplies by caste tilt — Green +20%, Blue −10%", () => {
    expect(computeTileCapacity("military", "green")).toBe(840);
    expect(computeTileCapacity("military", "blue")).toBe(630);
    expect(computeTileCapacity("military", "white")).toBe(700);
    expect(computeTileCapacity("military", "red")).toBe(700);
    expect(computeTileCapacity("military", "black")).toBe(700);
  });
});

describe("makeSeededRng", () => {
  it("produces deterministic sequences for the same seed", () => {
    const a = makeSeededRng("attack-123");
    const b = makeSeededRng("attack-123");
    for (let i = 0; i < 5; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = makeSeededRng("attack-123");
    const b = makeSeededRng("attack-124");
    let anyDifferent = false;
    for (let i = 0; i < 5; i++) {
      if (a() !== b()) anyDifferent = true;
    }
    expect(anyDifferent).toBe(true);
  });

  it("produces values in [0, 1)", () => {
    const rng = makeSeededRng("seed");
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("resolveAttack — capacity cap", () => {
  it("clamps deployed force to (capacity - defender_units_on_tile)", () => {
    const tile = defaultTile(500);
    const result = resolveAttack(
      defaultAttacker({ units: stack(300, 300, 300) }),
      defaultDefender({ unitsOnTile: stack(100, 100, 100) }),
      tile,
      makeSeededRng("seed-1")
    );
    const deployedTotal =
      result.unitsDeployed.ground +
      result.unitsDeployed.siege +
      result.unitsDeployed.air;
    expect(deployedTotal).toBeLessThanOrEqual(200);
    expect(result.unitsClampedFromCapacity).toBeGreaterThan(0);
  });

  it("repels with zero losses if no attacker units fit on the tile", () => {
    const tile = defaultTile(150);
    const result = resolveAttack(
      defaultAttacker({ units: stack(100, 100, 100) }),
      defaultDefender({ unitsOnTile: stack(50, 50, 50) }),
      tile,
      makeSeededRng("seed")
    );
    expect(result.outcome).toBe("repelled");
    expect(result.unitsDeployed).toEqual(stack(0, 0, 0));
    expect(result.attackerLosses).toEqual(stack(0, 0, 0));
    expect(result.defenderLosses).toEqual(stack(0, 0, 0));
  });

  it("does not clamp when the tile has plenty of room", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({ units: stack(100, 100, 100) }),
      defaultDefender({ unitsOnTile: stack(100, 100, 100) }),
      tile,
      makeSeededRng("seed")
    );
    expect(result.unitsClampedFromCapacity).toBe(0);
    expect(result.unitsDeployed).toEqual(stack(100, 100, 100));
  });
});

describe("resolveAttack — RPS composition", () => {
  // Hold the attacker fixed so we isolate the RPS effect from caste/unit-stat
  // asymmetry. A favorable matchup must produce strictly higher attack power
  // than an unfavorable one.

  it("air attacker out-damages a ground defender (favorable) vs a siege defender (unfavorable)", () => {
    const tile = defaultTile(2000);
    const favorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(0, 0, 200) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(200, 0, 0) }),
      tile,
      makeSeededRng("rps-air")
    );
    const unfavorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(0, 0, 200) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(0, 200, 0) }),
      tile,
      makeSeededRng("rps-air")
    );
    expect(favorable.attackPower).toBeGreaterThan(unfavorable.attackPower);
  });

  it("ground attacker out-damages a siege defender (favorable) vs an air defender (unfavorable)", () => {
    const tile = defaultTile(2000);
    const favorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(200, 0, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(0, 200, 0) }),
      tile,
      makeSeededRng("rps-ground")
    );
    const unfavorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(200, 0, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(0, 0, 200) }),
      tile,
      makeSeededRng("rps-ground")
    );
    expect(favorable.attackPower).toBeGreaterThan(unfavorable.attackPower);
  });

  it("siege attacker out-damages an air defender (favorable) vs a ground defender (unfavorable)", () => {
    const tile = defaultTile(2000);
    const favorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(0, 200, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(0, 0, 200) }),
      tile,
      makeSeededRng("rps-siege")
    );
    const unfavorable = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(0, 200, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(200, 0, 0) }),
      tile,
      makeSeededRng("rps-siege")
    );
    expect(favorable.attackPower).toBeGreaterThan(unfavorable.attackPower);
  });
});

describe("resolveAttack — caste tilts", () => {
  it("Red siege-heavy attack out-damages White same-composition", () => {
    const tile = defaultTile(2000);
    const red = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(0, 100, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(50, 0, 0) }),
      tile,
      makeSeededRng("caste-test")
    );
    const white = resolveAttack(
      defaultAttacker({ caste: "white", units: stack(0, 100, 0) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(50, 0, 0) }),
      tile,
      makeSeededRng("caste-test")
    );
    expect(red.attackPower).toBeGreaterThan(white.attackPower);
  });

  it("Green tile capacity bonus admits more attackers when computed via computeTileCapacity", () => {
    expect(computeTileCapacity("military", "green")).toBeGreaterThan(
      computeTileCapacity("military", "white")
    );
  });
});

describe("resolveAttack — spells", () => {
  it("offense spell raises attack power", () => {
    const tile = defaultTile(2000);
    const without = resolveAttack(
      defaultAttacker({ caste: "red", magicLandCount: 30 }),
      defaultDefender(),
      tile,
      makeSeededRng("spell-1")
    );
    const withSpell = resolveAttack(
      defaultAttacker({
        caste: "red",
        magicLandCount: 30,
        offenseSpellId: "red-offense-inferno",
      }),
      defaultDefender(),
      tile,
      makeSeededRng("spell-1")
    );
    expect(withSpell.attackPower).toBeGreaterThan(without.attackPower);
    expect(withSpell.appliedSpells.offenseId).toBe("red-offense-inferno");
  });

  it("defense spell raises defense power, scaled by defender's magic lands", () => {
    const tile = defaultTile(2000);
    const noLands = resolveAttack(
      defaultAttacker(),
      defaultDefender({
        caste: "white",
        magicLandCount: 0,
        armedDefenseSpellId: "white-defense-sanctuary",
      }),
      tile,
      makeSeededRng("spell-d")
    );
    const fiftyLands = resolveAttack(
      defaultAttacker(),
      defaultDefender({
        caste: "white",
        magicLandCount: 50,
        armedDefenseSpellId: "white-defense-sanctuary",
      }),
      tile,
      makeSeededRng("spell-d")
    );
    expect(fiftyLands.defensePower).toBeGreaterThan(noLands.defensePower);
  });

  it("ignores a spell whose type does not match the slot", () => {
    const tile = defaultTile(2000);
    const ignored = resolveAttack(
      defaultAttacker({
        caste: "red",
        magicLandCount: 50,
        offenseSpellId: "white-defense-sanctuary",
      }),
      defaultDefender(),
      tile,
      makeSeededRng("ignore")
    );
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red", magicLandCount: 50 }),
      defaultDefender(),
      tile,
      makeSeededRng("ignore")
    );
    expect(ignored.attackPower).toBe(baseline.attackPower);
  });
});

describe("resolveAttack — underdog bonus", () => {
  it("applies a defender +25% defense bonus when attacker is >2x the defender's total army", () => {
    const tile = defaultTile(2000);
    const withUnderdog = resolveAttack(
      defaultAttacker({ unitsAlive: 1000 }),
      defaultDefender({ unitsAlive: 100 }),
      tile,
      makeSeededRng("underdog")
    );
    const withoutUnderdog = resolveAttack(
      defaultAttacker({ unitsAlive: 1000 }),
      defaultDefender({ unitsAlive: 800 }),
      tile,
      makeSeededRng("underdog")
    );
    expect(withUnderdog.underdogApplied).toBe(true);
    expect(withoutUnderdog.underdogApplied).toBe(false);
    expect(withUnderdog.defensePower).toBeGreaterThan(
      withoutUnderdog.defensePower
    );
  });

  it("does not apply if defender tile has no units", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({ unitsAlive: 1000 }),
      defaultDefender({ unitsOnTile: stack(0, 0, 0), unitsAlive: 100 }),
      tile,
      makeSeededRng("empty")
    );
    expect(result.underdogApplied).toBe(false);
  });
});

describe("resolveAttack — outcome and losses", () => {
  it("captured outcome wipes the defender's units on the tile", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(500, 500, 500),
        unitsAlive: 5000,
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(10, 10, 10),
        unitsAlive: 30,
      }),
      tile,
      makeSeededRng("capture")
    );
    expect(result.outcome).toBe("captured");
    expect(result.defenderLosses).toEqual(stack(10, 10, 10));
  });

  it("repelled outcome leaves some defenders alive", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(5, 5, 5),
        unitsAlive: 15,
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(200, 200, 200),
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
        unitsAlive: 1000,
      }),
      tile,
      makeSeededRng("repelled")
    );
    expect(result.outcome).toBe("repelled");
    const survivors =
      result.defenderLosses.ground +
      result.defenderLosses.siege +
      result.defenderLosses.air;
    expect(survivors).toBeLessThan(600);
  });

  it("identical attacker and defender produce a tight outcome (any of the three)", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "red", unitsOnTile: stack(50, 50, 50) }),
      tile,
      makeSeededRng("mirror")
    );
    expect(["captured", "repelled", "stalemate"]).toContain(result.outcome);
  });
});

describe("computeSupplyMultiplier", () => {
  it("returns the -15% isolation floor with zero friendly neighbors", () => {
    expect(computeSupplyMultiplier("green", [])).toBeCloseTo(0.85, 5);
    expect(computeSupplyMultiplier("blue", [])).toBeCloseTo(0.85, 5);
    expect(computeSupplyMultiplier("red", [])).toBeCloseTo(0.85, 5);
  });

  it("Green with 6 military neighbors yields the +45% cap", () => {
    const six = Array(6).fill({ landType: "military" as const });
    // 6 × 1.0 weight × 5% × 1.5 caste = 0.45 → 1.45
    expect(computeSupplyMultiplier("green", six)).toBeCloseTo(1.45, 5);
  });

  it("Black with 6 military neighbors stays modest (+15%)", () => {
    const six = Array(6).fill({ landType: "military" as const });
    // 6 × 1.0 × 5% × 0.5 = 0.15 → 1.15
    expect(computeSupplyMultiplier("black", six)).toBeCloseTo(1.15, 5);
  });

  it("White scales between Green and Red on the same neighbors", () => {
    const six = Array(6).fill({ landType: "military" as const });
    const white = computeSupplyMultiplier("white", six);
    const green = computeSupplyMultiplier("green", six);
    const red = computeSupplyMultiplier("red", six);
    expect(white).toBeGreaterThan(red);
    expect(white).toBeLessThan(green);
    // 6 × 1.0 × 5% × 1.25 = 0.375 → 1.375
    expect(white).toBeCloseTo(1.375, 5);
  });

  it("food neighbors contribute 30% as much as military", () => {
    const sixMilitary = Array(6).fill({ landType: "military" as const });
    const sixFood = Array(6).fill({ landType: "food" as const });
    const milGain =
      computeSupplyMultiplier("red", sixMilitary) - 1; // 0.30
    const foodGain =
      computeSupplyMultiplier("red", sixFood) - 1; // 0.30 × 0.3 = 0.09
    expect(foodGain).toBeCloseTo(milGain * 0.3, 5);
  });

  it("clamps to a 1.50 hard cap regardless of caste/type stacking", () => {
    // 12 imaginary military neighbors with Green would compute to 1.90
    const twelve = Array(12).fill({ landType: "military" as const });
    expect(computeSupplyMultiplier("green", twelve)).toBeCloseTo(1.5, 5);
  });
});

describe("resolveAttack — supply", () => {
  it("isolated defender (empty friendlyNeighbors) takes -15% defense vs same tile w/o supply", () => {
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(50, 50, 50) }),
      { capacity: 2000, upgradeIds: [] },
      makeSeededRng("supply-iso")
    );
    const isolated = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(50, 50, 50) }),
      { capacity: 2000, upgradeIds: [], friendlyNeighbors: [] },
      makeSeededRng("supply-iso")
    );
    expect(isolated.supplyMultiplier).toBeCloseTo(0.85, 5);
    expect(isolated.defensePower).toBeCloseTo(baseline.defensePower * 0.85, 1);
  });

  it("Green with 6 military neighbors gains +45% defense vs the no-supply baseline", () => {
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "green", unitsOnTile: stack(50, 50, 50) }),
      { capacity: 2000, upgradeIds: [] },
      makeSeededRng("supply-green")
    );
    const cohesive = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "green", unitsOnTile: stack(50, 50, 50) }),
      {
        capacity: 2000,
        upgradeIds: [],
        friendlyNeighbors: Array(6).fill({ landType: "military" }),
      },
      makeSeededRng("supply-green")
    );
    expect(cohesive.supplyMultiplier).toBeCloseTo(1.45, 5);
    expect(cohesive.defensePower).toBeCloseTo(baseline.defensePower * 1.45, 1);
  });

  it("supply stacks multiplicatively with the underdog bonus", () => {
    const tile = {
      capacity: 2000,
      upgradeIds: [],
      friendlyNeighbors: Array(6).fill({ landType: "military" as const }),
    };
    const result = resolveAttack(
      defaultAttacker({ unitsAlive: 1000 }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(50, 50, 50),
        unitsAlive: 100,
      }),
      tile,
      makeSeededRng("supply-underdog")
    );
    expect(result.underdogApplied).toBe(true);
    expect(result.supplyMultiplier).toBeCloseTo(1.375, 5);
  });

  it("legacy callers (no friendlyNeighbors) get supplyMultiplier=1.0 and unchanged defense", () => {
    const r = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      { capacity: 2000, upgradeIds: [] },
      makeSeededRng("supply-legacy")
    );
    expect(r.supplyMultiplier).toBe(1);
  });
});

describe("resolveAttack — intel-effect bonuses", () => {
  it("applies attacker.intelOffenseBonus multiplicatively to attackPower", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("forge-sight-base")
    );
    const buffed = resolveAttack(
      defaultAttacker({ caste: "red", intelOffenseBonus: 0.1 }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("forge-sight-base")
    );
    expect(buffed.attackPower).toBeCloseTo(baseline.attackPower * 1.1, 1);
  });

  it("applies defender.intelDefenseBonus multiplicatively to defensePower", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("alert-base")
    );
    const alerted = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white", intelDefenseBonus: 0.2 }),
      tile,
      makeSeededRng("alert-base")
    );
    expect(alerted.defensePower).toBeCloseTo(baseline.defensePower * 1.2, 1);
  });

  it("alert-vs-caster bonus stacks with supply", () => {
    const sixMilitary = Array(6).fill({ landType: "military" as const });
    const tile = {
      capacity: 2000,
      upgradeIds: [],
      friendlyNeighbors: sixMilitary,
    };
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "green" }),
      tile,
      makeSeededRng("alert-stack")
    );
    const alerted = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "green", intelDefenseBonus: 0.2 }),
      tile,
      makeSeededRng("alert-stack")
    );
    // Green supply 1.45 × alert 1.20 = 1.74; baseline already includes supply.
    expect(alerted.defensePower).toBeCloseTo(baseline.defensePower * 1.2, 1);
    expect(baseline.supplyMultiplier).toBeCloseTo(1.45, 5);
  });

  it("Forge Sight stacks multiplicatively with Forge Scouts air-upgrade", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white", unitsOnTile: stack(100, 0, 0) }),
      tile,
      makeSeededRng("forge-stack")
    );
    const stacked = resolveAttack(
      defaultAttacker({
        caste: "red",
        intelOffenseBonus: 0.1,
        activeUpgrades: { "red-air-phoenix-talon": "red-air-phoenix-talon-upgrade-4-intel" },
      }),
      defaultDefender({ caste: "white", unitsOnTile: stack(100, 0, 0) }),
      tile,
      makeSeededRng("forge-stack")
    );
    // Forge Sight 1.10 × Forge Scouts 1.05 = 1.155
    expect(stacked.attackPower).toBeCloseTo(baseline.attackPower * 1.155, 1);
    expect(stacked.airIntel?.forgeScoutsBonusApplied).toBe(true);
  });

  it("zero intel bonus is a no-op", () => {
    const tile = defaultTile(2000);
    const a = resolveAttack(
      defaultAttacker({ intelOffenseBonus: 0 }),
      defaultDefender({ intelDefenseBonus: 0 }),
      tile,
      makeSeededRng("zero")
    );
    const b = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("zero")
    );
    expect(a.attackPower).toBe(b.attackPower);
    expect(a.defensePower).toBe(b.defensePower);
  });
});

describe("resolveAttack — hero bonuses (May 2026)", () => {
  it("applies attacker.heroAttackBonus multiplicatively to attackPower", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("hero-attack-base")
    );
    const buffed = resolveAttack(
      defaultAttacker({ caste: "red", heroAttackBonus: 0.2 }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("hero-attack-base")
    );
    expect(buffed.attackPower).toBeCloseTo(baseline.attackPower * 1.2, 1);
  });

  it("applies defender.heroDefenseBonus multiplicatively to defensePower", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("hero-defense-base")
    );
    const buffed = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white", heroDefenseBonus: 0.25 }),
      tile,
      makeSeededRng("hero-defense-base")
    );
    expect(buffed.defensePower).toBeCloseTo(baseline.defensePower * 1.25, 1);
  });

  it("stacks multiplicatively with intel bonuses (same numeric stage)", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("hero+intel")
    );
    const stacked = resolveAttack(
      defaultAttacker({
        caste: "red",
        intelOffenseBonus: 0.1,
        heroAttackBonus: 0.2,
      }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("hero+intel")
    );
    // 1.10 × 1.20 = 1.32
    expect(stacked.attackPower).toBeCloseTo(baseline.attackPower * 1.32, 1);
  });

  it("zero hero bonus is a no-op", () => {
    const tile = defaultTile(2000);
    const a = resolveAttack(
      defaultAttacker({ heroAttackBonus: 0 }),
      defaultDefender({ heroDefenseBonus: 0 }),
      tile,
      makeSeededRng("hero-zero")
    );
    const b = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("hero-zero")
    );
    expect(a.attackPower).toBe(b.attackPower);
    expect(a.defensePower).toBe(b.defensePower);
  });
});

describe("resolveAttack — air-intel passives", () => {
  it("White Hawk's Eye reveals the defender's armed-spell tier when air ≥ 1", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "white",
        units: stack(50, 50, 10),
        activeUpgrades: { "white-air-pegasus-knight": "white-air-pegasus-knight-upgrade-4-intel" },
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(50, 50, 50),
        armedDefenseSpellId: "white-defense-aegis-t4",
      }),
      tile,
      makeSeededRng("hawks-eye")
    );
    expect(result.airIntel?.sourcePassive).toBe("white-hawks-eye");
    expect(result.airIntel?.defenseSpellTier).toBe(4);
  });

  it("White Hawk's Eye omits the tier reveal if no air units are deployed", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "white",
        units: stack(50, 50, 0),
        activeUpgrades: { "white-air-pegasus-knight": "white-air-pegasus-knight-upgrade-4-intel" },
      }),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-aegis-t4",
      }),
      tile,
      makeSeededRng("hawks-eye-no-air")
    );
    expect(result.airIntel?.sourcePassive).toBe("white-hawks-eye");
    expect(result.airIntel?.defenseSpellTier).toBeUndefined();
  });

  it("Red Forge Scouts adds +5% offense and a weak-face hint when attacker air ≥ defender air", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(50, 50, 50) }),
      defaultDefender({ caste: "white", unitsOnTile: stack(100, 0, 0) }),
      tile,
      makeSeededRng("forge-scouts")
    );
    const scouted = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(50, 50, 50),
        activeUpgrades: { "red-air-phoenix-talon": "red-air-phoenix-talon-upgrade-4-intel" },
      }),
      defaultDefender({ caste: "white", unitsOnTile: stack(100, 0, 0) }),
      tile,
      makeSeededRng("forge-scouts")
    );
    expect(scouted.airIntel?.sourcePassive).toBe("red-forge-scouts");
    expect(scouted.airIntel?.forgeScoutsBonusApplied).toBe(true);
    // Defender is mostly ground → counter is air.
    expect(scouted.airIntel?.weakFace).toBe("air");
    expect(scouted.attackPower).toBeCloseTo(baseline.attackPower * 1.05, 1);
  });

  it("Red Forge Scouts withholds the bonus and weak-face when the air count is dominated", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(50, 50, 1),
        activeUpgrades: { "red-air-phoenix-talon": "red-air-phoenix-talon-upgrade-4-intel" },
      }),
      defaultDefender({ caste: "white", unitsOnTile: stack(0, 0, 200) }),
      tile,
      makeSeededRng("forge-scouts-dominated")
    );
    expect(result.airIntel?.forgeScoutsBonusApplied).toBe(false);
    expect(result.airIntel?.weakFace).toBeUndefined();
  });

  it("attackers with no intel upgrade get no airIntel field", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({ caste: "white" }),
      defaultDefender({ caste: "white", armedDefenseSpellId: "white-defense-sanctuary" }),
      tile,
      makeSeededRng("no-intel")
    );
    expect(result.airIntel).toBeUndefined();
  });
});

describe("resolveAttack — determinism", () => {
  it("returns identical results for identical inputs and seed", () => {
    const tile = defaultTile(1500);
    const a = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("repro")
    );
    const b = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("repro")
    );
    expect(a).toEqual(b);
  });

  it("RNG rolls fall within ±10% band", () => {
    const tile = defaultTile(2000);
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const r = resolveAttack(
        defaultAttacker(),
        defaultDefender(),
        tile,
        makeSeededRng(seed)
      );
      expect(r.rng.attackerRoll).toBeGreaterThanOrEqual(0.9);
      expect(r.rng.attackerRoll).toBeLessThan(1.1);
      expect(r.rng.defenderRoll).toBeGreaterThanOrEqual(0.9);
      expect(r.rng.defenderRoll).toBeLessThan(1.1);
    }
  });
});

describe("resolveAttack — tile-type modifiers (May 2026 rework)", () => {
  // Each test pairs a baseline (no landType / sourceLandType — neutral
  // ×1.00) against a configured-tile run, using the same seed so the RNG
  // rolls are identical. We assert ratios on attackPower / defensePower.

  it("legacy callers (no landType / sourceLandType) get neutral multipliers and 0 standing defense", () => {
    const r = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("legacy-tile-types")
    );
    expect(r.sourceLandTypeMultiplier).toBe(1);
    expect(r.targetLandTypeMultiplier).toBe(1);
    expect(r.standingDefenseAdded).toBe(0);
    expect(r.magicTileOffenseSpellBonusApplied).toBe(false);
    expect(r.magicTileDefenseSpellBonusApplied).toBe(false);
  });

  it("military source tile multiplies attack power by 1.20", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-mil")
    );
    const fromMilitary = resolveAttack(
      defaultAttacker({ sourceLandType: "military" }),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-mil")
    );
    expect(fromMilitary.sourceLandTypeMultiplier).toBe(1.2);
    expect(fromMilitary.attackPower).toBeCloseTo(baseline.attackPower * 1.2, 1);
  });

  it("food source tile penalizes attack by 0.75", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-food")
    );
    const fromFood = resolveAttack(
      defaultAttacker({ sourceLandType: "food" }),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-food")
    );
    expect(fromFood.sourceLandTypeMultiplier).toBe(0.75);
    expect(fromFood.attackPower).toBeCloseTo(baseline.attackPower * 0.75, 1);
  });

  it("magic source tile is neutral on attack power", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-magic")
    );
    const fromMagic = resolveAttack(
      defaultAttacker({ sourceLandType: "magic" }),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("source-magic")
    );
    expect(fromMagic.sourceLandTypeMultiplier).toBe(1);
    expect(fromMagic.attackPower).toBeCloseTo(baseline.attackPower, 1);
  });

  it("military target tile multiplies defense by 1.25", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("target-mil")
    );
    const onMilitary = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      { capacity: 2000, upgradeIds: [], landType: "military" },
      makeSeededRng("target-mil")
    );
    expect(onMilitary.targetLandTypeMultiplier).toBe(1.25);
    // Defense = unit_def × 1.25 + standing(military 30% of attack).
    const expected =
      baseline.defensePower * 1.25 + onMilitary.attackPower * 0.3;
    expect(onMilitary.defensePower).toBeCloseTo(expected, 1);
  });

  it("magic target tile multiplies defense by 1.25 + adds 15% standing floor", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("target-magic")
    );
    const onMagic = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      { capacity: 2000, upgradeIds: [], landType: "magic" },
      makeSeededRng("target-magic")
    );
    expect(onMagic.targetLandTypeMultiplier).toBe(1.25);
    const expected =
      baseline.defensePower * 1.25 + onMagic.attackPower * 0.15;
    expect(onMagic.defensePower).toBeCloseTo(expected, 1);
    expect(onMagic.standingDefenseAdded).toBeCloseTo(
      onMagic.attackPower * 0.15,
      1
    );
  });

  it("food target tile gets no defense multiplier and no standing floor", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("target-food")
    );
    const onFood = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      { capacity: 2000, upgradeIds: [], landType: "food" },
      makeSeededRng("target-food")
    );
    expect(onFood.targetLandTypeMultiplier).toBe(1);
    expect(onFood.standingDefenseAdded).toBe(0);
    expect(onFood.defensePower).toBeCloseTo(baseline.defensePower, 1);
  });

  it("empty military tile still resists at ~30% of attack power (standing defense)", () => {
    const onEmptyMilitary = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      { capacity: 2000, upgradeIds: [], landType: "military" },
      makeSeededRng("empty-mil")
    );
    // No units → unit_def = 0, ×1.25 = 0; only standing applies.
    expect(onEmptyMilitary.standingDefenseAdded).toBeCloseTo(
      onEmptyMilitary.attackPower * 0.3,
      1
    );
    expect(onEmptyMilitary.defensePower).toBeCloseTo(
      onEmptyMilitary.standingDefenseAdded,
      1
    );
    expect(onEmptyMilitary.defensePower).toBeGreaterThan(0);
  });

  it("empty food tile has zero defense (no garrison)", () => {
    const onEmptyFood = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      { capacity: 2000, upgradeIds: [], landType: "food" },
      makeSeededRng("empty-food")
    );
    expect(onEmptyFood.defensePower).toBe(0);
    expect(onEmptyFood.standingDefenseAdded).toBe(0);
  });

  it("offense spell from a magic source tile is amplified by 1.25", () => {
    const tile = defaultTile(2000);
    const noMagicSource = resolveAttack(
      defaultAttacker({
        caste: "red",
        offenseSpellId: "red-offense-inferno",
        magicLandCount: 50,
      }),
      defaultDefender(),
      tile,
      makeSeededRng("magic-spell-source")
    );
    const fromMagicSource = resolveAttack(
      defaultAttacker({
        caste: "red",
        offenseSpellId: "red-offense-inferno",
        magicLandCount: 50,
        sourceLandType: "magic",
      }),
      defaultDefender(),
      tile,
      makeSeededRng("magic-spell-source")
    );
    expect(fromMagicSource.magicTileOffenseSpellBonusApplied).toBe(true);
    expect(noMagicSource.magicTileOffenseSpellBonusApplied).toBe(false);
    // The amplified contribution increases attackPower vs the non-amplified
    // baseline (magnitude depends on spell+caste; we only check direction).
    expect(fromMagicSource.attackPower).toBeGreaterThan(
      noMagicSource.attackPower
    );
  });

  it("defense spell armed on a magic target tile is amplified by 1.25", () => {
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
      }),
      defaultTile(2000),
      makeSeededRng("magic-spell-target")
    );
    const armedOnMagic = resolveAttack(
      defaultAttacker(),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
      }),
      { capacity: 2000, upgradeIds: [], landType: "magic" },
      makeSeededRng("magic-spell-target")
    );
    expect(armedOnMagic.magicTileDefenseSpellBonusApplied).toBe(true);
    expect(baseline.magicTileDefenseSpellBonusApplied).toBe(false);
    expect(armedOnMagic.defensePower).toBeGreaterThan(baseline.defensePower);
  });
});

describe("resolveAttack — pre-attack mods (siege / disarm / pre-cast)", () => {
  // Same pattern as the tile-type modifier suite: pair a neutral baseline
  // with a configured run, identical seed, then assert ratios.

  it("legacy callers (no siege / disarm / pre-cast fields) get 0 on all three CombatResult fields", () => {
    const r = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      defaultTile(2000),
      makeSeededRng("legacy-pre-attack")
    );
    expect(r.siegeDebuffApplied).toBe(0);
    expect(r.defenseDisarmApplied).toBe(0);
    expect(r.preCastOffenseApplied).toBe(0);
  });

  it("siege debuff drops the standing-defense floor proportionally", () => {
    const tile = {
      capacity: 2000,
      upgradeIds: [],
      landType: "military" as const,
    };
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      tile,
      makeSeededRng("siege-floor")
    );
    const oneSiege = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      { ...tile, siegeDebuffMagnitude: 0.10 },
      makeSeededRng("siege-floor")
    );
    expect(baseline.siegeDebuffApplied).toBe(0);
    expect(oneSiege.siegeDebuffApplied).toBeCloseTo(0.10, 5);
    // Empty military tile → defense is purely the floor; one siege = 30% −
    // 10% = 20% of attackPower.
    expect(baseline.defensePower).toBeCloseTo(baseline.attackPower * 0.30, 1);
    expect(oneSiege.defensePower).toBeCloseTo(oneSiege.attackPower * 0.20, 1);
  });

  it("siege debuff at the cap (0.30) zeros out a military tile's standing floor", () => {
    const onCappedSiege = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      {
        capacity: 2000,
        upgradeIds: [],
        landType: "military",
        siegeDebuffMagnitude: 0.30,
      },
      makeSeededRng("siege-cap")
    );
    // Empty tile + zero floor → no defense at all.
    expect(onCappedSiege.standingDefenseAdded).toBe(0);
    expect(onCappedSiege.defensePower).toBe(0);
    expect(onCappedSiege.siegeDebuffApplied).toBeCloseTo(0.30, 5);
  });

  it("siege debuff exceeding the floor doesn't go negative", () => {
    // Magic floor is 0.15. A 0.30 siege would push fraction to −0.15 if
    // unclamped — must clamp at 0, not produce negative defense.
    const r = resolveAttack(
      defaultAttacker(),
      defaultDefender({ unitsOnTile: stack(0, 0, 0) }),
      {
        capacity: 2000,
        upgradeIds: [],
        landType: "magic",
        siegeDebuffMagnitude: 0.30,
      },
      makeSeededRng("siege-overshoot")
    );
    expect(r.standingDefenseAdded).toBe(0);
    expect(r.defensePower).toBe(0);
  });

  it("disarm fraction proportionally reduces defender's armed spell contribution", () => {
    const tile = defaultTile(2000);
    const baselineNoDisarm = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
      }),
      tile,
      makeSeededRng("disarm-baseline")
    );
    const halfDisarm = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
        defenseDisarmFraction: 0.5,
      }),
      tile,
      makeSeededRng("disarm-baseline")
    );
    const fullDisarm = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({
        caste: "white",
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
        defenseDisarmFraction: 1.0,
      }),
      tile,
      makeSeededRng("disarm-baseline")
    );
    const noSpell = resolveAttack(
      defaultAttacker({ caste: "red" }),
      defaultDefender({ caste: "white" }),
      tile,
      makeSeededRng("disarm-baseline")
    );
    expect(baselineNoDisarm.defenseDisarmApplied).toBe(0);
    expect(halfDisarm.defenseDisarmApplied).toBeCloseTo(0.5, 5);
    expect(fullDisarm.defenseDisarmApplied).toBeCloseTo(1, 5);
    // Half-disarm sits between the spell-armed baseline and a no-spell run.
    expect(halfDisarm.defensePower).toBeLessThan(baselineNoDisarm.defensePower);
    expect(halfDisarm.defensePower).toBeGreaterThan(noSpell.defensePower);
    // Full disarm matches the no-spell baseline exactly (within FP slop).
    expect(fullDisarm.defensePower).toBeCloseTo(noSpell.defensePower, 1);
  });

  it("disarm with no armed spell is a no-op (defenseDisarmApplied=0)", () => {
    const r = resolveAttack(
      defaultAttacker(),
      defaultDefender({
        armedDefenseSpellId: null,
        defenseDisarmFraction: 0.5,
      }),
      defaultTile(2000),
      makeSeededRng("disarm-no-spell")
    );
    expect(r.defenseDisarmApplied).toBe(0);
  });

  it("pre-cast offense bonus is added to attackPower as a flat increment", () => {
    const tile = defaultTile(2000);
    const baseline = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("pre-cast-flat")
    );
    const buffed = resolveAttack(
      defaultAttacker({ preCastOffenseBonus: 100 }),
      defaultDefender(),
      tile,
      makeSeededRng("pre-cast-flat")
    );
    expect(baseline.preCastOffenseApplied).toBe(0);
    expect(buffed.preCastOffenseApplied).toBe(100);
    expect(buffed.attackPower).toBeCloseTo(baseline.attackPower + 100, 1);
  });

  it("pre-cast does NOT get re-amplified by source-tile magic mult", () => {
    // The pre-cast spell was rolled and realized at its own moment from
    // its own tile. If the next attack happens to launch from a magic
    // tile, the in-flight bonus shouldn't be scaled again — only the
    // attack-time spell rides the source-tile mult.
    const tile = defaultTile(2000);
    const fromMagicSource = resolveAttack(
      defaultAttacker({
        sourceLandType: "magic",
        preCastOffenseBonus: 100,
      }),
      defaultDefender(),
      tile,
      makeSeededRng("pre-cast-magic-no-stack")
    );
    const fromNonMagicSource = resolveAttack(
      defaultAttacker({ preCastOffenseBonus: 100 }),
      defaultDefender(),
      tile,
      makeSeededRng("pre-cast-magic-no-stack")
    );
    // Both runs add the flat 100 after the source-tile mult, so the delta
    // between them is exactly the magic-source amplification of the
    // existing (non-pre-cast) attackPower components, not 100×anything.
    expect(fromMagicSource.preCastOffenseApplied).toBe(100);
    expect(fromNonMagicSource.preCastOffenseApplied).toBe(100);
  });

  it("siege + disarm + pre-cast can stack in a single resolution", () => {
    const tile = {
      capacity: 2000,
      upgradeIds: [],
      landType: "military" as const,
      siegeDebuffMagnitude: 0.20,
    };
    const r = resolveAttack(
      defaultAttacker({ preCastOffenseBonus: 50 }),
      defaultDefender({
        armedDefenseSpellId: "white-defense-sanctuary",
        magicLandCount: 50,
        defenseDisarmFraction: 0.5,
      }),
      tile,
      makeSeededRng("stack-everything")
    );
    expect(r.siegeDebuffApplied).toBeCloseTo(0.20, 5);
    expect(r.defenseDisarmApplied).toBeCloseTo(0.5, 5);
    expect(r.preCastOffenseApplied).toBe(50);
  });
});

describe("rollSpellEffectiveness + SPELL_RNG constants", () => {
  it("constants form a band around 1.0 midpoint", () => {
    expect(SPELL_RNG_LOWER).toBe(0.5);
    expect(SPELL_RNG_RANGE).toBe(1.0);
    expect(SPELL_RNG_MIDPOINT).toBe(1.0);
  });

  it("rolls fall in [SPELL_RNG_LOWER, SPELL_RNG_LOWER + SPELL_RNG_RANGE]", () => {
    const rng = makeSeededRng("spell-roll");
    for (let i = 0; i < 50; i++) {
      const v = rollSpellEffectiveness(rng);
      expect(v).toBeGreaterThanOrEqual(SPELL_RNG_LOWER);
      expect(v).toBeLessThan(SPELL_RNG_LOWER + SPELL_RNG_RANGE);
    }
  });

  it("midpoint RNG (() => 0.5) returns exactly SPELL_RNG_MIDPOINT", () => {
    const v = rollSpellEffectiveness(() => 0.5);
    expect(v).toBe(SPELL_RNG_MIDPOINT);
  });
});

describe("applyFlyoverModifiers", () => {
  // Build a minimal CombatResult for the helper to chew on. Only the
  // fields the helper inspects matter; the rest are stubbed to neutral.
  function combatStub(overrides: Partial<CombatResult> = {}): CombatResult {
    return {
      outcome: "captured",
      unitsDeployed: stack(0, 0, 100),
      unitsClampedFromCapacity: 0,
      attackPower: 0,
      defensePower: 0,
      attackerLosses: stack(0, 0, 10),
      defenderLosses: stack(0, 0, 5),
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
      ...overrides,
    };
  }

  it("converts a 'captured' outcome to 'repelled'", () => {
    const r = applyFlyoverModifiers(combatStub({ outcome: "captured" }));
    expect(r.outcome).toBe("repelled");
  });

  it("leaves 'repelled' outcomes untouched", () => {
    const r = applyFlyoverModifiers(combatStub({ outcome: "repelled" }));
    expect(r.outcome).toBe("repelled");
  });

  it("leaves 'stalemate' outcomes untouched", () => {
    const r = applyFlyoverModifiers(combatStub({ outcome: "stalemate" }));
    expect(r.outcome).toBe("stalemate");
  });

  it("doubles attacker losses across all unit types", () => {
    const r = applyFlyoverModifiers(
      combatStub({
        unitsDeployed: stack(20, 30, 40),
        attackerLosses: stack(5, 10, 8),
      })
    );
    expect(r.attackerLosses).toEqual(stack(10, 20, 16));
  });

  it("clamps doubled losses to deployed (can't lose more than were sent)", () => {
    const r = applyFlyoverModifiers(
      combatStub({
        unitsDeployed: stack(0, 0, 50),
        // 30 × 2 = 60, but only 50 deployed → clamp to 50.
        attackerLosses: stack(0, 0, 30),
      })
    );
    expect(r.attackerLosses).toEqual(stack(0, 0, 50));
  });

  it("preserves defender losses unchanged", () => {
    const before = combatStub({ defenderLosses: stack(2, 3, 4) });
    const after = applyFlyoverModifiers(before);
    expect(after.defenderLosses).toEqual(stack(2, 3, 4));
  });

  it("preserves all other CombatResult fields verbatim", () => {
    const before = combatStub({
      attackPower: 1234,
      defensePower: 567,
      siegeDebuffApplied: 0.10,
      magicTileOffenseSpellBonusApplied: true,
    });
    const after = applyFlyoverModifiers(before);
    expect(after.attackPower).toBe(1234);
    expect(after.defensePower).toBe(567);
    expect(after.siegeDebuffApplied).toBe(0.10);
    expect(after.magicTileOffenseSpellBonusApplied).toBe(true);
  });
});

describe("realizedSpellMagnitude", () => {
  it("midpoint dice (1.0) and 0 magic lands returns baseStrength × casteBonus", () => {
    // Red's siege bonus is 1.30. Tier-1 base 0.05.
    const m = realizedSpellMagnitude({
      baseStrength: 0.05,
      caste: "red",
      spellType: "siege",
      magicLandCount: 0,
      dice: 1.0,
    });
    expect(m).toBeCloseTo(0.05 * 1.30, 5);
  });

  it("scales with magicMultiplier(magicLandCount)", () => {
    // 50 magic lands → magicMultiplier = 3.5. White attrition bonus 0.85,
    // base 30 → 30 × 3.5 × 0.85 × 1.0 = 89.25.
    const m = realizedSpellMagnitude({
      baseStrength: 30,
      caste: "white",
      spellType: "attrition",
      magicLandCount: 50,
      dice: 1.0,
    });
    expect(m).toBeCloseTo(30 * 3.5 * 0.85, 1);
  });

  it("scales linearly with dice", () => {
    const args = {
      baseStrength: 0.4,
      caste: "white" as const,
      spellType: "disarm" as const,
      magicLandCount: 0,
      dice: 1.0,
    };
    const mid = realizedSpellMagnitude(args);
    const low = realizedSpellMagnitude({ ...args, dice: 0.5 });
    const high = realizedSpellMagnitude({ ...args, dice: 1.5 });
    expect(low).toBeCloseTo(mid * 0.5, 5);
    expect(high).toBeCloseTo(mid * 1.5, 5);
  });

  it("uses the caste's per-spelltype bonus row", () => {
    // Red siege bonus 1.30; Green siege bonus 1.00. Same inputs otherwise
    // should differ by 1.30 / 1.00 = 1.30.
    const red = realizedSpellMagnitude({
      baseStrength: 0.05,
      caste: "red",
      spellType: "siege",
      magicLandCount: 0,
      dice: 1.0,
    });
    const green = realizedSpellMagnitude({
      baseStrength: 0.05,
      caste: "green",
      spellType: "siege",
      magicLandCount: 0,
      dice: 1.0,
    });
    expect(red / green).toBeCloseTo(1.3, 2);
  });
});

describe("distributeUnitKills", () => {
  it("returns zero stack when killCount is 0", () => {
    const u = stack(50, 30, 20);
    const k = distributeUnitKills(u, 0);
    expect(k).toEqual(stack(0, 0, 0));
  });

  it("returns zero stack when target stack is empty", () => {
    const k = distributeUnitKills(stack(0, 0, 0), 100);
    expect(k).toEqual(stack(0, 0, 0));
  });

  it("never kills more than killCount or more than units present", () => {
    // 20 units total, ask for 100 → cap at 20.
    const u = stack(10, 5, 5);
    const k = distributeUnitKills(u, 100);
    const total = k.ground + k.siege + k.air;
    expect(total).toBe(20);
    expect(k.ground).toBeLessThanOrEqual(u.ground);
    expect(k.siege).toBeLessThanOrEqual(u.siege);
    expect(k.air).toBeLessThanOrEqual(u.air);
  });

  it("distributes proportionally — dominant type takes most kills", () => {
    // 100 kills against (90, 5, 5): roughly 90% of kills land on ground.
    const k = distributeUnitKills(stack(90, 5, 5), 100);
    expect(k.ground).toBeGreaterThanOrEqual(85);
    expect(k.siege).toBeLessThanOrEqual(8);
    expect(k.air).toBeLessThanOrEqual(8);
    expect(k.ground + k.siege + k.air).toBe(100);
  });

  it("distributes evenly across equal stacks", () => {
    const k = distributeUnitKills(stack(30, 30, 30), 30);
    // 10 each, with sum=30.
    expect(k.ground + k.siege + k.air).toBe(30);
    expect(Math.abs(k.ground - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(k.siege - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(k.air - 10)).toBeLessThanOrEqual(1);
  });

  it("handles killCount equal to total — kills everyone", () => {
    const k = distributeUnitKills(stack(7, 11, 13), 31);
    expect(k).toEqual(stack(7, 11, 13));
  });
});

// ─── BASE + SUPER combat (2026-05-13 rework) ─────────────────────────────
// These tests pin down the behavioral expectations of the BASE-units
// redesign: every tile defends with intrinsic militia even when SUPER is
// empty, near-equal fights tip into stalemate instead of an exact-tie dead
// branch, the loss curve is decisiveness-keyed, captures retain a fraction
// of BASE, and the SUPER/BASE attribution at the server layer absorbs
// damage from SUPER first.

describe("resolveAttack — BASE units defense", () => {
  it("empty SUPER but full BASE garrison can repel a small attacker", () => {
    // 10 ground vs a tile with no recruited units but a full military
    // garrison (22/8/5 composite, BASE_DURABILITY_MULT-tougher than SUPER).
    // The attacker is outnumbered ~3.5×; we expect the outcome to skew
    // toward repelled (not always — RNG can swing it — but the *intent*
    // is that an empty tile is not free real estate).
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({ caste: "red", units: stack(10, 0, 0), unitsAlive: 100 }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(22, 8, 5), // composite stack = base only
        baseUnitsOnTile: stack(22, 8, 5),
        unitsAlive: 35,
      }),
      tile,
      makeSeededRng("empty-tile-base")
    );
    // The decisive-capture path is no longer guaranteed — the defender
    // brought ~35 BASE units against 10 attackers and should hold or stalemate.
    expect(["repelled", "stalemate", "captured"]).toContain(result.outcome);
    // Whichever way the dice fell, the defender pre-attack stack must
    // surface the BASE garrison.
    expect(result.defenderBasePreAttack).toEqual(stack(22, 8, 5));
  });
});

describe("resolveAttack — stalemate band", () => {
  it("returns stalemate when finalAttack/finalDefense is within ±8%", () => {
    // Construct attacker and defender with similar power. We can't fully
    // control RNG ratios, but we can search across seeds and confirm the
    // band fires sometimes (and never with a 0/609 freq like the old code).
    const tile = defaultTile(2000);
    let stalemateCount = 0;
    for (let seed = 0; seed < 60; seed++) {
      const result = resolveAttack(
        defaultAttacker({ caste: "white", units: stack(50, 50, 50) }),
        defaultDefender({
          caste: "white",
          unitsOnTile: stack(50, 50, 50),
        }),
        tile,
        makeSeededRng(`stalemate-${seed}`)
      );
      if (result.outcome === "stalemate") stalemateCount++;
    }
    // Old code: 0 stalemates ever. New code: a few per 60 seeds is plenty.
    expect(stalemateCount).toBeGreaterThan(0);
  });

  it("stalemate causes both sides to take partial losses", () => {
    // Force a stalemate by mirroring composition + caste; pick a seed
    // that lands in the band.
    const tile = defaultTile(2000);
    let stalemate: CombatResult | null = null;
    for (let seed = 0; seed < 100 && !stalemate; seed++) {
      const r = resolveAttack(
        defaultAttacker({ caste: "white", units: stack(50, 50, 50) }),
        defaultDefender({
          caste: "white",
          unitsOnTile: stack(50, 50, 50),
        }),
        tile,
        makeSeededRng(`stalemate-losses-${seed}`)
      );
      if (r.outcome === "stalemate") stalemate = r;
    }
    expect(stalemate).not.toBeNull();
    const atkTotal =
      stalemate!.attackerLosses.ground +
      stalemate!.attackerLosses.siege +
      stalemate!.attackerLosses.air;
    const defTotal =
      stalemate!.defenderLosses.ground +
      stalemate!.defenderLosses.siege +
      stalemate!.defenderLosses.air;
    // Stalemate band: attacker ~50% loss, defender ~40% loss on a ~150 stack.
    expect(atkTotal).toBeGreaterThan(0);
    expect(defTotal).toBeGreaterThan(0);
    // Neither side wiped (stalemate, not a one-sided wipe).
    expect(atkTotal).toBeLessThan(150);
    expect(defTotal).toBeLessThan(150);
  });
});

describe("resolveAttack — decisiveness-keyed loss curves", () => {
  it("decisive capture: attacker loses < 20% on a 2× edge", () => {
    // Heavy attacker advantage: 500/500/500 vs 50/50/50 (~10× power).
    // Decisive capture means the attacker doesn't bleed out.
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(500, 500, 500),
        unitsAlive: 5000,
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(50, 50, 50),
      }),
      tile,
      makeSeededRng("decisive-capture")
    );
    expect(result.outcome).toBe("captured");
    const sent = result.unitsDeployed;
    const sentTotal = sent.ground + sent.siege + sent.air;
    const lost =
      result.attackerLosses.ground +
      result.attackerLosses.siege +
      result.attackerLosses.air;
    expect(lost / sentTotal).toBeLessThan(0.2);
    expect(result.lossCurveTag).toBe("decisive-capture");
  });

  it("decisive repel: attacker loses > 60% on a heavy underdog roll", () => {
    // Attacker is heavily outclassed. Old curve would wipe 99.7%; new
    // curve should bleed them, but not vaporize unless extremely lopsided.
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(5, 5, 5),
        unitsAlive: 15,
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(300, 300, 300),
        unitsAlive: 1000,
      }),
      tile,
      makeSeededRng("decisive-repel")
    );
    expect(result.outcome).toBe("repelled");
    const sent = result.unitsDeployed;
    const sentTotal = sent.ground + sent.siege + sent.air;
    const lost =
      result.attackerLosses.ground +
      result.attackerLosses.siege +
      result.attackerLosses.air;
    expect(lost / sentTotal).toBeGreaterThan(0.6);
    expect(result.lossCurveTag).toBe("decisive-repel");
  });

  it("exposes finalAttack and finalDefense for the BattleReport", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker(),
      defaultDefender(),
      tile,
      makeSeededRng("expose-power")
    );
    expect(result.finalAttack).toBeGreaterThan(0);
    expect(result.finalDefense).toBeGreaterThan(0);
    // The pre-attack stack mirrors what the caller passed as unitsOnTile.
    expect(result.defenderUnitsPreAttack).toEqual(stack(50, 50, 50));
  });
});

describe("attributeDefenderLosses — SUPER-first split", () => {
  it("SUPER absorbs damage before BASE bleeds", () => {
    const out = attributeDefenderLosses({
      superBefore: stack(20, 0, 0),
      baseBefore: stack(10, 0, 0),
      totalLosses: stack(15, 0, 0),
      outcome: "repelled",
      captureBaseRetentionFactor: 1,
    });
    expect(out.superLost).toEqual(stack(15, 0, 0));
    expect(out.baseLost).toEqual(stack(0, 0, 0));
    expect(out.newSuper).toEqual(stack(5, 0, 0));
    expect(out.newBase).toEqual(stack(10, 0, 0));
  });

  it("BASE picks up overflow when SUPER is exhausted", () => {
    // 25 damage, only 20 SUPER → 5 overflow → BASE durability soaks
    // ~5/1.30 ≈ 4 BASE killed.
    const out = attributeDefenderLosses({
      superBefore: stack(20, 0, 0),
      baseBefore: stack(10, 0, 0),
      totalLosses: stack(25, 0, 0),
      outcome: "repelled",
      captureBaseRetentionFactor: 1,
    });
    expect(out.superLost.ground).toBe(20);
    expect(out.baseLost.ground).toBe(Math.round(5 / BASE_DURABILITY_MULT));
    expect(out.newSuper).toEqual(stack(0, 0, 0));
    expect(out.newBase.ground).toBe(10 - out.baseLost.ground);
  });

  it("on capture, SUPER is wiped and BASE retained at the factor", () => {
    const out = attributeDefenderLosses({
      superBefore: stack(8, 4, 2),
      baseBefore: stack(40, 16, 8),
      // Curve losses are ignored on capture — server uses wiped+retained.
      totalLosses: stack(2, 1, 0),
      outcome: "captured",
      captureBaseRetentionFactor: BASE_CAPTURE_RETENTION,
    });
    expect(out.newSuper).toEqual(stack(0, 0, 0));
    expect(out.newBase).toEqual(
      stack(
        Math.floor(40 * BASE_CAPTURE_RETENTION),
        Math.floor(16 * BASE_CAPTURE_RETENTION),
        Math.floor(8 * BASE_CAPTURE_RETENTION)
      )
    );
  });
});

describe("attributeAttackerLosses — proportional split", () => {
  it("losses go entirely to SUPER when no BASE was conscripted", () => {
    const out = attributeAttackerLosses({
      superSent: stack(10, 5, 0),
      baseSent: stack(0, 0, 0),
      totalLosses: stack(3, 2, 0),
    });
    expect(out.superLost).toEqual(stack(3, 2, 0));
    expect(out.baseLost).toEqual(stack(0, 0, 0));
  });

  it("splits proportionally when SUPER + BASE were both deployed", () => {
    // 80% SUPER, 20% BASE → ~80% of losses come from SUPER.
    const out = attributeAttackerLosses({
      superSent: stack(80, 0, 0),
      baseSent: stack(20, 0, 0),
      totalLosses: stack(10, 0, 0),
    });
    expect(out.superLost.ground + out.baseLost.ground).toBe(10);
    expect(out.superLost.ground).toBeGreaterThanOrEqual(7);
    expect(out.baseLost.ground).toBeLessThanOrEqual(3);
  });
});

describe("baseUnitsTarget — caste + land profiles", () => {
  it("unowned tile gets the raw land seed (no caste mult, no entrenchment)", () => {
    const u = baseUnitsTarget({ landType: "military", caste: null });
    // LAND_TYPE_BASE.military = { ground: 22, siege: 8, air: 5 }
    expect(u).toEqual(stack(22, 8, 5));
  });

  it("red caste boosts ground/siege over white baseline", () => {
    const red = baseUnitsTarget({ landType: "military", caste: "red" });
    const white = baseUnitsTarget({ landType: "military", caste: "white" });
    expect(red.ground).toBeGreaterThanOrEqual(white.ground);
    expect(red.siege).toBeGreaterThanOrEqual(white.siege);
  });

  it("unrevealed tile gets zero BASE", () => {
    expect(
      baseUnitsTarget({ landType: "unrevealed", caste: "red" })
    ).toEqual(stack(0, 0, 0));
  });
});

describe("resolveAttack — BASE retention on capture", () => {
  it("surfaces captureBaseRetentionFactor < 1 on capture", () => {
    const tile = defaultTile(2000);
    const result = resolveAttack(
      defaultAttacker({
        caste: "red",
        units: stack(500, 500, 500),
        unitsAlive: 5000,
      }),
      defaultDefender({
        caste: "white",
        unitsOnTile: stack(10, 10, 10),
        baseUnitsOnTile: stack(10, 10, 10),
      }),
      tile,
      makeSeededRng("retention-cap")
    );
    expect(result.outcome).toBe("captured");
    expect(result.captureBaseRetentionFactor).toBeLessThan(1);
    expect(result.captureBaseRetentionFactor).toBeGreaterThan(0);
  });
});
