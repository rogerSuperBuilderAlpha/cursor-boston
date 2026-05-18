/**
 * @jest-environment node
 */
import {
  ALL_ARTIFACTS,
  ALL_BUILDINGS,
  ALL_SPELLS,
  ALL_UNITS,
  ALL_UPGRADES,
  ARTIFACTS_BY_ID,
  ARTIFACTS_BY_RARITY,
  BUILDINGS_BY_ID,
  CASTE_PROFILES,
  SPELLS_BY_ID,
  UNITS_BY_ID,
  UPGRADES_BY_ID,
  buildingForCasteAndLand,
  getCasteProfile,
  getHighestUnlockedSpell,
  getSpellForCasteAndType,
  getSpellsForCasteAndType,
  getUnitForCasteAndType,
  isSpellUnlocked,
  upgradesForTarget,
} from "@/lib/game/content";

const CASTES = ["white", "blue", "black", "red", "green"] as const;
const UNIT_TYPES = ["ground", "siege", "air"] as const;
const SPELL_TYPES = [
  "defense",
  "offense",
  "production",
  "intel",
  "siege",
  "disarm",
  "attrition",
] as const;

describe("lib/game/content (index)", () => {
  describe("registries", () => {
    it("ALL_UNITS contains exactly 15 entries (5 castes × 3 types)", () => {
      expect(ALL_UNITS).toHaveLength(15);
    });

    it("UNITS_BY_ID is keyed by id and recovers every unit", () => {
      expect(UNITS_BY_ID.size).toBe(ALL_UNITS.length);
      for (const u of ALL_UNITS) {
        expect(UNITS_BY_ID.get(u.id)).toBe(u);
      }
    });

    it("SPELLS_BY_ID is keyed by id and includes every spell from ALL_SPELLS", () => {
      expect(SPELLS_BY_ID.size).toBe(ALL_SPELLS.length);
      for (const s of ALL_SPELLS) {
        expect(SPELLS_BY_ID.get(s.id)).toBe(s);
      }
    });

    it("BUILDINGS_BY_ID is keyed by id", () => {
      expect(BUILDINGS_BY_ID.size).toBe(ALL_BUILDINGS.length);
    });

    it("UPGRADES_BY_ID is keyed by id", () => {
      expect(UPGRADES_BY_ID.size).toBe(ALL_UPGRADES.length);
    });

    it("ALL_SPELLS includes the armageddon spell catalog", () => {
      const armageddon = ALL_SPELLS.filter((s) => s.type === "armageddon");
      expect(armageddon.length).toBeGreaterThan(0);
    });

    it("CASTE_PROFILES + getCasteProfile expose all 5 castes", () => {
      for (const c of CASTES) {
        expect(getCasteProfile(c)).toBe(CASTE_PROFILES[c]);
      }
    });

    it("ARTIFACTS_BY_ID + ARTIFACTS_BY_RARITY mirror ALL_ARTIFACTS", () => {
      for (const a of ALL_ARTIFACTS) {
        expect(ARTIFACTS_BY_ID.get(a.id)).toBe(a);
      }
      expect(ARTIFACTS_BY_RARITY).toBeDefined();
    });
  });

  describe("getUnitForCasteAndType", () => {
    it("returns a unit for every (caste, type) combination", () => {
      for (const caste of CASTES) {
        for (const type of UNIT_TYPES) {
          const u = getUnitForCasteAndType(caste, type);
          expect(u.caste).toBe(caste);
          expect(u.type).toBe(type);
        }
      }
    });

    it("throws when an unknown caste/type pair is requested", () => {
      expect(() =>
        getUnitForCasteAndType("white", "mystery" as unknown as typeof UNIT_TYPES[number]),
      ).toThrow(/No unit registered/);
    });
  });

  describe("getSpellForCasteAndType", () => {
    it("returns the tier-1 spell for caste/types that have one", () => {
      let resolved = 0;
      for (const caste of CASTES) {
        for (const type of SPELL_TYPES) {
          try {
            const s = getSpellForCasteAndType(caste, type);
            expect(s.caste).toBe(caste);
            expect(s.type).toBe(type);
            expect(s.tier).toBe(1);
            resolved++;
          } catch {
            // Some caste/type pairs may not have a tier-1 registered.
          }
        }
      }
      // Sanity: at least the canonical "white defense" tier-1 is registered.
      expect(resolved).toBeGreaterThan(0);
    });

    it("throws when no tier-1 spell exists for a (caste, type)", () => {
      expect(() =>
        getSpellForCasteAndType("white", "armageddon"),
      ).toThrow(/No tier-1 spell/);
    });
  });

  describe("getSpellsForCasteAndType", () => {
    it("returns all tiers sorted ascending", () => {
      const spells = getSpellsForCasteAndType("white", "defense");
      expect(spells.length).toBeGreaterThan(0);
      const tiers = spells.map((s) => s.tier);
      const sorted = [...tiers].sort((a, b) => a - b);
      expect(tiers).toEqual(sorted);
    });
  });

  describe("getHighestUnlockedSpell / isSpellUnlocked", () => {
    it("returns the tier-1 spell when tilesHeld is 0", () => {
      const s = getHighestUnlockedSpell("white", "defense", 0);
      expect(s.tier).toBe(1);
    });

    it("returns a higher tier as tilesHeld grows past minTilesRequired", () => {
      const tiers = getSpellsForCasteAndType("white", "defense");
      const top = tiers[tiers.length - 1]!;
      const out = getHighestUnlockedSpell("white", "defense", top.minTilesRequired);
      expect(out.id).toBe(top.id);
    });

    it("isSpellUnlocked is true iff tilesHeld >= minTilesRequired", () => {
      const tiers = getSpellsForCasteAndType("white", "defense");
      const last = tiers[tiers.length - 1]!;
      expect(isSpellUnlocked(last, last.minTilesRequired - 1)).toBe(false);
      expect(isSpellUnlocked(last, last.minTilesRequired)).toBe(true);
    });
  });

  describe("buildingForCasteAndLand", () => {
    it("returns a building for known caste+landType pairs", () => {
      const first = ALL_BUILDINGS[0];
      if (!first) return;
      const b = buildingForCasteAndLand(first.caste, first.landType);
      expect(b).toBeDefined();
      expect(b?.caste).toBe(first.caste);
    });

    it("returns undefined for unknown landType", () => {
      expect(
        buildingForCasteAndLand(
          "white",
          "moon" as unknown as ReturnType<typeof buildingForCasteAndLand> extends infer R ? R extends { landType: infer L } ? L : never : never,
        ),
      ).toBeUndefined();
    });
  });

  describe("upgradesForTarget", () => {
    it("returns upgrades whose targetId matches", () => {
      const known = ALL_UPGRADES[0];
      if (!known) return;
      const out = upgradesForTarget(known.targetId);
      expect(out.length).toBeGreaterThan(0);
      for (const u of out) expect(u.targetId).toBe(known.targetId);
    });

    it("returns [] when no upgrades match", () => {
      expect(upgradesForTarget("nonexistent-target-id")).toEqual([]);
    });
  });
});
