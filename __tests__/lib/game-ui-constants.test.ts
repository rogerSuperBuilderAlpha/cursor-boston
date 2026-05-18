/**
 * @jest-environment node
 *
 * Smoke test for the game-UI helper modules under app/game/*\/_lib/.
 * Importing executes module-scope code (typed const tables, helper
 * functions, color maps) — bumping these previously-0%-statement
 * files into coverage. The shallow assertions also catch accidental
 * deletes of the public surface.
 */

import {
  MIN_UNITS_PER_CYCLE_RECRUITABLE,
  RARITY_TEXT as RECRUIT_RARITY_TEXT,
  TURNS_PER_CYCLE,
  UNITS_PER_CYCLE,
  UNITS_PER_CYCLE_BY_LAND,
  unitsPerCycleForLand,
} from "@/app/game/recruit/_lib/constants";
import {
  CASTES,
  CASTE_PRESENTATION,
  DISTRIBUTABLE,
  RARITY_COLORS,
} from "@/app/game/setup/_lib/constants";
import {
  RARITY_TEXT as SPELLS_RARITY_TEXT,
  TIERS,
  TYPE_COLUMNS,
  TYPE_LABEL,
} from "@/app/game/spells/_lib/constants";

describe("app/game/*/_lib/constants", () => {
  describe("recruit/_lib/constants", () => {
    it("UNITS_PER_CYCLE = 10 (military baseline)", () => {
      expect(UNITS_PER_CYCLE).toBe(10);
    });

    it("TURNS_PER_CYCLE = 5", () => {
      expect(TURNS_PER_CYCLE).toBe(5);
    });

    it("MIN_UNITS_PER_CYCLE_RECRUITABLE = 5 (conservative lower bound)", () => {
      expect(MIN_UNITS_PER_CYCLE_RECRUITABLE).toBe(5);
    });

    it("UNITS_PER_CYCLE_BY_LAND has the documented per-type yield", () => {
      expect(UNITS_PER_CYCLE_BY_LAND.military).toBe(10);
      expect(UNITS_PER_CYCLE_BY_LAND.food).toBe(5);
      expect(UNITS_PER_CYCLE_BY_LAND.magic).toBe(5);
      expect(UNITS_PER_CYCLE_BY_LAND.unrevealed).toBe(0);
      expect(UNITS_PER_CYCLE_BY_LAND.unassigned).toBe(0);
    });

    it("unitsPerCycleForLand mirrors the table", () => {
      expect(unitsPerCycleForLand("military")).toBe(10);
      expect(unitsPerCycleForLand("food")).toBe(5);
      expect(unitsPerCycleForLand("magic")).toBe(5);
      expect(unitsPerCycleForLand("unrevealed")).toBe(0);
    });

    it("RARITY_TEXT covers the 4 rarity tiers", () => {
      expect(RECRUIT_RARITY_TEXT.common).toBeTruthy();
      expect(RECRUIT_RARITY_TEXT.rare).toBeTruthy();
      expect(RECRUIT_RARITY_TEXT.epic).toBeTruthy();
      expect(RECRUIT_RARITY_TEXT.legendary).toBeTruthy();
    });
  });

  describe("setup/_lib/constants", () => {
    it("CASTES lists 5 castes", () => {
      expect(CASTES).toHaveLength(5);
      expect(new Set(CASTES)).toEqual(new Set(["white", "blue", "black", "red", "green"]));
    });

    it("DISTRIBUTABLE lists the 3 distributable land types", () => {
      expect(new Set(DISTRIBUTABLE)).toEqual(new Set(["military", "food", "magic"]));
    });

    it("CASTE_PRESENTATION has a swatch + tagline for every caste", () => {
      for (const caste of CASTES) {
        const p = CASTE_PRESENTATION[caste];
        expect(p.swatch).toMatch(/^#[0-9a-fA-F]{3,8}$/);
        expect(p.tagline.length).toBeGreaterThan(0);
      }
    });

    it("RARITY_COLORS covers the 4 rarity tiers", () => {
      expect(Object.keys(RARITY_COLORS)).toEqual(
        expect.arrayContaining(["common", "rare", "epic", "legendary"])
      );
    });
  });

  describe("spells/_lib/constants", () => {
    it("TIERS lists 5 ascending tiers with non-decreasing minTiles", () => {
      expect(TIERS).toHaveLength(5);
      for (let i = 1; i < TIERS.length; i++) {
        expect(TIERS[i].tier).toBe(TIERS[i - 1].tier + 1);
        expect(TIERS[i].minTiles).toBeGreaterThan(TIERS[i - 1].minTiles);
      }
    });

    it("TYPE_COLUMNS lists the table's column order", () => {
      expect(TYPE_COLUMNS).toEqual(["defense", "offense", "production"]);
    });

    it("TYPE_LABEL has a label for every column type + extras", () => {
      for (const t of TYPE_COLUMNS) {
        expect(TYPE_LABEL[t]).toBeTruthy();
      }
      // Extra spell types not in the table column list still get a label.
      expect(TYPE_LABEL.intel).toBeTruthy();
      expect(TYPE_LABEL.armageddon).toBeTruthy();
    });

    it("RARITY_TEXT covers the 4 rarity tiers", () => {
      expect(Object.keys(SPELLS_RARITY_TEXT)).toEqual(
        expect.arrayContaining(["common", "rare", "epic", "legendary"])
      );
    });
  });
});
