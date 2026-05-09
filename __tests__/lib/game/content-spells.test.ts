/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  ALL_SPELLS,
  SPELLS_BY_ID,
  getSpellsForCasteAndType,
} from "@/lib/game/content";
import type { Caste, SpellType } from "@/lib/game/types";

const CASTES: Caste[] = ["white", "blue", "black", "red", "green"];
const NEW_SPELL_KINDS: Array<"siege" | "disarm" | "attrition"> = [
  "siege",
  "disarm",
  "attrition",
];

describe("New spell content (May 2026 sim feature)", () => {
  it("ALL_SPELLS contains exactly one tier-1 spell per caste × new-kind = 15", () => {
    const newKindSpells = ALL_SPELLS.filter(
      (s) =>
        s.type === "siege" || s.type === "disarm" || s.type === "attrition"
    );
    expect(newKindSpells).toHaveLength(15);
    expect(newKindSpells.every((s) => s.tier === 1)).toBe(true);
  });

  it("every (caste, kind) pair has a tier-1 spell registered", () => {
    for (const caste of CASTES) {
      for (const kind of NEW_SPELL_KINDS) {
        const tiers = getSpellsForCasteAndType(caste, kind as SpellType);
        expect(tiers.length).toBeGreaterThanOrEqual(1);
        expect(tiers[0].tier).toBe(1);
        expect(tiers[0].caste).toBe(caste);
        expect(tiers[0].type).toBe(kind);
      }
    }
  });

  it("baseStrength is set to the kind's documented V1 default", () => {
    // siege → 0.05 fraction · disarm → 0.4 fraction · attrition → 30 units.
    for (const caste of CASTES) {
      const siege = getSpellsForCasteAndType(caste, "siege")[0];
      const disarm = getSpellsForCasteAndType(caste, "disarm")[0];
      const attrition = getSpellsForCasteAndType(caste, "attrition")[0];
      expect(siege.baseStrength).toBe(0.05);
      expect(disarm.baseStrength).toBe(0.4);
      expect(attrition.baseStrength).toBe(30);
    }
  });

  it("turn cost is 5 and minTilesRequired is 0 for all new tier-1 spells", () => {
    for (const caste of CASTES) {
      for (const kind of NEW_SPELL_KINDS) {
        const s = getSpellsForCasteAndType(caste, kind as SpellType)[0];
        expect(s.turnCost).toBe(5);
        expect(s.minTilesRequired).toBe(0);
      }
    }
  });

  it("every new spell id is unique and resolves via SPELLS_BY_ID", () => {
    const ids = new Set<string>();
    for (const caste of CASTES) {
      for (const kind of NEW_SPELL_KINDS) {
        const s = getSpellsForCasteAndType(caste, kind as SpellType)[0];
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        expect(SPELLS_BY_ID.get(s.id)).toBe(s);
      }
    }
    expect(ids.size).toBe(15);
  });
});
