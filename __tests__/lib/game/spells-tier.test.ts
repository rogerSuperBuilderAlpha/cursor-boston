/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  ALL_SPELLS,
  getHighestUnlockedSpell,
  getSpellForCasteAndType,
  getSpellsForCasteAndType,
  isSpellUnlocked,
} from "@/lib/game/content";
import {
  TIER_MIN_TILES,
  TIER_TURN_COST,
} from "@/lib/game/content/spells/tiers";
import type { Caste, SpellType } from "@/lib/game/types";

describe("spell content", () => {
  it("registers 75 spells (5 castes × 3 types × 5 tiers)", () => {
    expect(ALL_SPELLS.length).toBe(75);
  });

  it("spell ids are unique", () => {
    const ids = new Set(ALL_SPELLS.map((s) => s.id));
    expect(ids.size).toBe(ALL_SPELLS.length);
  });

  it("every (caste, type) has exactly five tiers", () => {
    const castes: Caste[] = ["white", "blue", "black", "red", "green"];
    const types: SpellType[] = ["defense", "offense", "production"];
    for (const c of castes) {
      for (const t of types) {
        const tiers = getSpellsForCasteAndType(c, t);
        expect(tiers.length).toBe(5);
        expect(tiers.map((s) => s.tier)).toEqual([1, 2, 3, 4, 5]);
      }
    }
  });

  it("tier 1 keeps its v1 id (no -t1 suffix)", () => {
    const t1 = getSpellForCasteAndType("white", "defense");
    expect(t1.id).toBe("white-defense-sanctuary");
    expect(t1.tier).toBe(1);
  });

  it("higher tiers carry the expected territory gates", () => {
    const tiers = getSpellsForCasteAndType("white", "defense");
    expect(tiers[0].minTilesRequired).toBe(TIER_MIN_TILES[1]);
    expect(tiers[1].minTilesRequired).toBe(TIER_MIN_TILES[2]);
    expect(tiers[2].minTilesRequired).toBe(TIER_MIN_TILES[3]);
    expect(tiers[3].minTilesRequired).toBe(TIER_MIN_TILES[4]);
    expect(tiers[4].minTilesRequired).toBe(TIER_MIN_TILES[5]);
  });

  it("higher tiers carry the expected turn costs", () => {
    const tiers = getSpellsForCasteAndType("white", "defense");
    for (let i = 0; i < tiers.length; i++) {
      expect(tiers[i].turnCost).toBe(TIER_TURN_COST[(i + 1) as 1 | 2 | 3 | 4 | 5]);
    }
  });

  it("baseStrength is monotonically non-decreasing across tiers", () => {
    const tiers = getSpellsForCasteAndType("blue", "production");
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].baseStrength).toBeGreaterThanOrEqual(
        tiers[i - 1].baseStrength
      );
    }
  });
});

describe("isSpellUnlocked / getHighestUnlockedSpell", () => {
  it("tier 1 is unlocked at 0 tiles", () => {
    const t1 = getSpellForCasteAndType("red", "offense");
    expect(isSpellUnlocked(t1, 0)).toBe(true);
  });

  it("tier 5 only unlocks at 20,000+ tiles", () => {
    const tiers = getSpellsForCasteAndType("red", "offense");
    const t5 = tiers[4];
    expect(isSpellUnlocked(t5, 19_999)).toBe(false);
    expect(isSpellUnlocked(t5, 20_000)).toBe(true);
  });

  it("getHighestUnlockedSpell picks the right tier per territory size", () => {
    const tiers = getSpellsForCasteAndType("red", "offense");
    expect(getHighestUnlockedSpell("red", "offense", 0).id).toBe(tiers[0].id);
    expect(getHighestUnlockedSpell("red", "offense", 500).id).toBe(tiers[1].id);
    expect(getHighestUnlockedSpell("red", "offense", 1500).id).toBe(tiers[2].id);
    expect(getHighestUnlockedSpell("red", "offense", 5000).id).toBe(tiers[3].id);
    expect(getHighestUnlockedSpell("red", "offense", 20_000).id).toBe(tiers[4].id);
  });
});
