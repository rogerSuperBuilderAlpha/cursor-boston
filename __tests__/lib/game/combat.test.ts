/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  computeTileCapacity,
  magicMultiplier,
  makeSeededRng,
  resolveAttack,
  unitCapFromFoodLands,
} from "@/lib/game/combat";
import type {
  CombatAttackerInput,
  CombatDefenderInput,
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
