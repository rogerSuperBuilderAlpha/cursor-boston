/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { makeSeededRng } from "@/lib/game/combat";
import {
  CONVERSION_SUCCESS_CEILING,
  EMERGE_CHANCE_FARM,
  EMERGE_CHANCE_MAGIC,
  EMERGE_CHANCE_MILITARY,
  HERO_ATTACK_BONUS,
  MAGIC_HERO_VIRTUAL_LANDS,
  STAMINA_CONVERSION_THRESHOLD,
  STAMINA_DECAY_PER_ENGAGEMENT,
  STAMINA_MAX,
  STAMINA_REGEN_PER_TURN,
  conversionSuccessChance,
  heroClassForLandType,
  landTypeForHeroClass,
  specialtyArmageddonMult,
  specialtyAttackMult,
  specialtyCastingMult,
  specialtyDefenseMult,
  specialtyKingdomBuffMult,
  specialtyRecruitMult,
  specialtyTypeRecruitMult,
  staminaScale,
} from "@/lib/game/content/heroes";
import {
  applyEngagement,
  applyStaminaRegen,
  maybeEmergeHero,
  pickHeroName,
} from "@/lib/game/heroes";
import type { GameHero, HeroClass } from "@/lib/game/types";

function fixedRng(value: number): () => number {
  return () => value;
}

function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function defaultHero(overrides: Partial<GameHero> = {}): GameHero {
  return {
    id: "test-hero-1",
    ownerId: "user-a",
    tileId: "q0r0",
    class: "military",
    specialty: "ground",
    name: "Test Hero",
    caste: "white",
    stamina: STAMINA_MAX,
    staminaMax: STAMINA_MAX,
    emergedAtTurn: 0,
    lastEngagedAtTurn: 0,
    ...overrides,
  };
}

describe("staminaScale", () => {
  it("returns 1 at full stamina, 0 at zero stamina", () => {
    expect(staminaScale({ stamina: STAMINA_MAX, staminaMax: STAMINA_MAX })).toBe(
      1
    );
    expect(staminaScale({ stamina: 0, staminaMax: STAMINA_MAX })).toBe(0);
  });

  it("scales linearly between", () => {
    expect(
      staminaScale({ stamina: 50, staminaMax: 100 })
    ).toBeCloseTo(0.5, 5);
  });

  it("clamps negative or over-cap values safely", () => {
    expect(staminaScale({ stamina: -10, staminaMax: 100 })).toBe(0);
    expect(staminaScale({ stamina: 200, staminaMax: 100 })).toBe(1);
  });
});

describe("conversionSuccessChance", () => {
  it("returns 0 when stamina is above threshold", () => {
    expect(
      conversionSuccessChance({
        stamina: STAMINA_CONVERSION_THRESHOLD + 1,
        staminaMax: STAMINA_MAX,
      })
    ).toBe(0);
  });

  it("rises as stamina drops below threshold, capped at ceiling", () => {
    const atThreshold = conversionSuccessChance({
      stamina: STAMINA_CONVERSION_THRESHOLD,
      staminaMax: STAMINA_MAX,
    });
    const exhausted = conversionSuccessChance({
      stamina: 0,
      staminaMax: STAMINA_MAX,
    });
    expect(atThreshold).toBeGreaterThan(0);
    expect(exhausted).toBeGreaterThan(atThreshold);
    expect(exhausted).toBeLessThanOrEqual(CONVERSION_SUCCESS_CEILING);
  });
});

describe("specialty multipliers", () => {
  it("military attack: raid is straight buff, siege is contextual", () => {
    const raidHero = defaultHero({ specialty: "raid" });
    const siegeHero = defaultHero({ specialty: "siege" });
    expect(specialtyAttackMult(raidHero, "food")).toBeGreaterThan(1);
    expect(specialtyAttackMult(siegeHero, "military")).toBeGreaterThan(1);
    expect(specialtyAttackMult(siegeHero, "food")).toBe(1);
  });

  it("military defense: garrison is the strongest pure-defense specialty", () => {
    const garrison = defaultHero({ specialty: "garrison" });
    const supply = defaultHero({ specialty: "supply" });
    expect(specialtyDefenseMult(garrison, undefined)).toBeGreaterThan(
      specialtyDefenseMult(supply, undefined)
    );
  });

  it("magic casting: matching specialty + spell type stacks ×1.5", () => {
    const offensiveSpec = defaultHero({
      class: "magic",
      specialty: "offense-spells",
    });
    expect(specialtyCastingMult(offensiveSpec, { type: "offense" })).toBe(
      1.5
    );
    expect(specialtyCastingMult(offensiveSpec, { type: "intel" })).toBe(1);
  });

  it("magic armageddon: armageddon specialty doubles the virtual-land contribution", () => {
    const arma = defaultHero({ class: "magic", specialty: "armageddon" });
    const other = defaultHero({ class: "magic", specialty: "spying" });
    expect(specialtyArmageddonMult(arma)).toBe(2);
    expect(specialtyArmageddonMult(other)).toBe(1);
  });

  it("farm summoner doubles special-unit roll, kingdom-buff doubles global recruit", () => {
    const summoner = defaultHero({ class: "farm", specialty: "summoner" });
    const buffer = defaultHero({ class: "farm", specialty: "kingdom-buff" });
    expect(specialtyRecruitMult(summoner)).toBe(2);
    expect(specialtyKingdomBuffMult(buffer)).toBe(2);
  });

  it("farm per-unit-type recruit specialty matches only the corresponding unit type", () => {
    const groundFarmer = defaultHero({
      class: "farm",
      specialty: "ground-recruit",
    });
    expect(specialtyTypeRecruitMult(groundFarmer, "ground")).toBeGreaterThan(1);
    expect(specialtyTypeRecruitMult(groundFarmer, "air")).toBe(1);
  });
});

describe("landType ↔ heroClass adapters", () => {
  it("round-trips for the three combat-relevant land types", () => {
    expect(heroClassForLandType("military")).toBe("military");
    expect(heroClassForLandType("food")).toBe("farm");
    expect(heroClassForLandType("magic")).toBe("magic");
  });

  it("returns null for non-buildable land types", () => {
    expect(heroClassForLandType("unrevealed")).toBeNull();
    expect(heroClassForLandType("unassigned")).toBeNull();
  });

  it("reverses to the right land type for each hero class", () => {
    expect(landTypeForHeroClass("military")).toBe("military");
    expect(landTypeForHeroClass("farm")).toBe("food");
    expect(landTypeForHeroClass("magic")).toBe("magic");
  });
});

describe("applyStaminaRegen", () => {
  it("returns the same hero when no turns have elapsed", () => {
    const hero = defaultHero({ stamina: 40, lastEngagedAtTurn: 10 });
    expect(applyStaminaRegen(hero, 10)).toBe(hero);
  });

  it("regenerates STAMINA_REGEN_PER_TURN per elapsed turn, capped at staminaMax", () => {
    const hero = defaultHero({ stamina: 40, lastEngagedAtTurn: 10 });
    const after1 = applyStaminaRegen(hero, 11);
    expect(after1.stamina).toBe(40 + STAMINA_REGEN_PER_TURN);
    expect(after1.lastEngagedAtTurn).toBe(11);
    const afterMany = applyStaminaRegen(hero, 100);
    expect(afterMany.stamina).toBe(STAMINA_MAX);
  });
});

describe("applyEngagement", () => {
  it("drops stamina by STAMINA_DECAY_PER_ENGAGEMENT × intensity", () => {
    const hero = defaultHero({ stamina: 80 });
    const normal = applyEngagement(hero, 5, 1);
    expect(normal.stamina).toBe(80 - STAMINA_DECAY_PER_ENGAGEMENT);
    expect(normal.lastEngagedAtTurn).toBe(5);
    const spare = applyEngagement(hero, 5, 2);
    expect(spare.stamina).toBe(80 - STAMINA_DECAY_PER_ENGAGEMENT * 2);
  });

  it("clamps stamina at 0", () => {
    const hero = defaultHero({ stamina: 10 });
    expect(applyEngagement(hero, 1, 5).stamina).toBe(0);
  });
});

describe("pickHeroName", () => {
  it("returns a name from the caste's pool", () => {
    const name = pickHeroName("white", "deadbeef-cafe");
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same id", () => {
    expect(pickHeroName("red", "abc")).toBe(pickHeroName("red", "abc"));
  });

  it("returns different names across castes for the same id (in practice)", () => {
    const w = pickHeroName("white", "12345");
    const b = pickHeroName("black", "12345");
    // Pools share no overlap, so the names should differ.
    expect(w).not.toBe(b);
  });
});

describe("maybeEmergeHero", () => {
  it("returns null when the tile already has a hero", () => {
    const out = maybeEmergeHero({
      class: "military",
      tile: { tileId: "q0r0", hero: defaultHero() },
      ownerId: "user-a",
      ownerCaste: "white",
      turnIndex: 5,
      rng: fixedRng(0),
    });
    expect(out).toBeNull();
  });

  it("returns null when the rng roll exceeds the class chance", () => {
    const out = maybeEmergeHero({
      class: "farm",
      tile: { tileId: "q0r0", hero: undefined },
      ownerId: "user-a",
      ownerCaste: "green",
      turnIndex: 5,
      rng: fixedRng(EMERGE_CHANCE_FARM + 0.01),
    });
    expect(out).toBeNull();
  });

  it("returns a hero with the right class + caste when the roll succeeds", () => {
    const out = maybeEmergeHero({
      class: "magic",
      tile: { tileId: "q1r1", hero: undefined },
      ownerId: "user-a",
      ownerCaste: "blue",
      turnIndex: 12,
      rng: sequenceRng([0, 0.5]),
    });
    expect(out).not.toBeNull();
    expect(out!.class).toBe("magic");
    expect(out!.caste).toBe("blue");
    expect(out!.ownerId).toBe("user-a");
    expect(out!.tileId).toBe("q1r1");
    expect(out!.stamina).toBe(STAMINA_MAX);
    expect(out!.emergedAtTurn).toBe(12);
  });

  it("emerges at expected rate over many trials (seeded rng)", () => {
    let emerged = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const rng = makeSeededRng(`emerge-trial-${i}`);
      const h = maybeEmergeHero({
        class: "military",
        tile: { tileId: "q0r0", hero: undefined },
        ownerId: "user-a",
        ownerCaste: "white",
        turnIndex: 0,
        rng,
      });
      if (h) emerged++;
    }
    // Allow ±2σ wiggle room: stddev for p=0.04 over 1000 trials ≈ 6.2.
    expect(emerged).toBeGreaterThan(trials * EMERGE_CHANCE_MILITARY - 25);
    expect(emerged).toBeLessThan(trials * EMERGE_CHANCE_MILITARY + 25);
  });
});

describe("emerge-chance constants are conservative", () => {
  it("all three are under 10%", () => {
    expect(EMERGE_CHANCE_MILITARY).toBeLessThan(0.1);
    expect(EMERGE_CHANCE_FARM).toBeLessThan(0.1);
    expect(EMERGE_CHANCE_MAGIC).toBeLessThan(0.1);
  });
});

describe("effect tuning constants are sensible", () => {
  it.each<[HeroClass, number]>([
    ["military", HERO_ATTACK_BONUS],
    ["magic", MAGIC_HERO_VIRTUAL_LANDS],
  ])("%s tuning is positive", (_, value) => {
    expect(value).toBeGreaterThan(0);
  });
});
