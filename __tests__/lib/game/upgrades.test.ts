/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  ALL_BUILDINGS,
  ALL_UPGRADES,
  UPGRADES_BY_ID,
  buildingForCasteAndLand,
  upgradesForTarget,
} from "@/lib/game/content";
import {
  UPGRADE_TURN_COST,
  UpgradeAlreadyActiveError,
  UpgradeNotActiveError,
  UpgradeNotFoundError,
  UpgradeWrongCasteError,
  buildingCapacityBonus,
  effectiveUnitStats,
  getActiveUpgrades,
  magicMultiplierBonusFromUpgrades,
  validateApplyUpgrade,
  validateRemoveUpgrade,
} from "@/lib/game/upgrades";
import { newPlayer } from "@/lib/game/turns";
import type { GamePlayer } from "@/lib/game/types";

describe("upgrade content", () => {
  it("registers exactly 95 upgrades (45 unit + 45 building + 5 air-intel)", () => {
    // Each caste gets a 4th 'intel' option on its air unit; 5 castes → 5 extra.
    expect(ALL_UPGRADES.length).toBe(95);
    expect(ALL_UPGRADES.filter((u) => u.targetKind === "unit").length).toBe(50);
    expect(ALL_UPGRADES.filter((u) => u.targetKind === "building").length).toBe(
      45
    );
    expect(ALL_UPGRADES.filter((u) => u.intelPassive).length).toBe(5);
  });

  it("non-air targets have exactly three options; air units have four", () => {
    const byTarget = new Map<string, number>();
    for (const u of ALL_UPGRADES) {
      byTarget.set(u.targetId, (byTarget.get(u.targetId) ?? 0) + 1);
    }
    for (const [targetId, count] of byTarget) {
      const expected = targetId.includes("-air-") ? 4 : 3;
      expect(count).toBe(expected);
    }
  });

  it("registers 15 buildings, one per (caste, landType)", () => {
    expect(ALL_BUILDINGS.length).toBe(15);
    for (const caste of ["white", "blue", "black", "red", "green"] as const) {
      for (const land of ["military", "food", "magic"] as const) {
        const b = buildingForCasteAndLand(caste, land);
        expect(b).toBeDefined();
        expect(b!.caste).toBe(caste);
        expect(b!.landType).toBe(land);
      }
    }
  });

  it("upgrade ids are unique", () => {
    const ids = new Set(ALL_UPGRADES.map((u) => u.id));
    expect(ids.size).toBe(ALL_UPGRADES.length);
  });
});

describe("effectiveUnitStats", () => {
  it("returns base stats when no upgrade is active", () => {
    const u = UPGRADES_BY_ID.values().next().value!;
    const unit = {
      id: u.targetId,
      caste: u.caste,
      type: "ground" as const,
      name: "x",
      attack: 10,
      defense: 10,
      hp: 10,
      description: "",
    };
    const stats = effectiveUnitStats(unit, {});
    expect(stats.attack).toBe(10);
    expect(stats.defense).toBe(10);
    expect(stats.hp).toBe(10);
  });

  it("applies upgrade deltas", () => {
    const upgrade = ALL_UPGRADES.find(
      (u) =>
        u.targetKind === "unit" && u.optionIndex === 1 && u.targetId === "white-ground-pikeman"
    )!;
    const unit = {
      id: "white-ground-pikeman",
      caste: "white" as const,
      type: "ground" as const,
      name: "Pikeman",
      attack: 9,
      defense: 14,
      hp: 11,
      description: "",
    };
    const stats = effectiveUnitStats(unit, { [unit.id]: upgrade.id });
    expect(stats.attack).toBe(9 + (upgrade.effects.attackDelta ?? 0));
    expect(stats.defense).toBe(14 + (upgrade.effects.defenseDelta ?? 0));
    expect(stats.hp).toBe(11 + (upgrade.effects.hpDelta ?? 0));
  });

  it("never lets a stat fall below 1", () => {
    const upgrade = ALL_UPGRADES.find(
      (u) => u.targetKind === "unit" && u.targetId === "white-ground-pikeman"
    )!;
    const unit = {
      id: "white-ground-pikeman",
      caste: "white" as const,
      type: "ground" as const,
      name: "Pikeman",
      attack: 0,
      defense: 0,
      hp: 0,
      description: "",
    };
    const stats = effectiveUnitStats(unit, { [unit.id]: upgrade.id });
    expect(stats.attack).toBeGreaterThanOrEqual(1);
    expect(stats.defense).toBeGreaterThanOrEqual(1);
    expect(stats.hp).toBeGreaterThanOrEqual(1);
  });
});

describe("buildingCapacityBonus", () => {
  it("returns 0 base when no upgrade is active", () => {
    const b = buildingForCasteAndLand("white", "food")!;
    expect(buildingCapacityBonus(b, {})).toBe(0);
  });

  it("adds the upgrade's capacityBonusDelta when active", () => {
    const b = buildingForCasteAndLand("white", "food")!;
    const upgrade = upgradesForTarget(b.id).find((u) => u.optionIndex === 1)!;
    expect(buildingCapacityBonus(b, { [b.id]: upgrade.id })).toBe(
      (upgrade.effects.capacityBonusDelta ?? 0)
    );
  });
});

describe("magicMultiplierBonusFromUpgrades", () => {
  it("is 0 when no magic-tier building upgrade is active", () => {
    expect(magicMultiplierBonusFromUpgrades({})).toBe(0);
  });

  it("sums magicMultiplierDelta across active building upgrades", () => {
    // White-magic option 1 has magicMultiplierDelta 0.05.
    const upgrade = ALL_UPGRADES.find(
      (u) =>
        u.targetId === "white-magic" &&
        (u.effects.magicMultiplierDelta ?? 0) > 0 &&
        u.optionIndex === 1
    )!;
    expect(
      magicMultiplierBonusFromUpgrades({ [upgrade.targetId]: upgrade.id })
    ).toBeCloseTo(upgrade.effects.magicMultiplierDelta ?? 0);
  });
});

describe("validateApplyUpgrade", () => {
  function whitePlayer(): GamePlayer {
    const p = newPlayer("u", new Date("2026-01-01T00:00:00Z"));
    return { ...p, caste: "white", phase: "play" };
  }

  it("rejects unknown upgrade id", () => {
    const p = whitePlayer();
    expect(() =>
      validateApplyUpgrade({
        player: p,
        upgradeId: "no-such-upgrade",
        targetId: "white-ground-pikeman",
      })
    ).toThrow(UpgradeNotFoundError);
  });

  it("rejects wrong-caste upgrade", () => {
    const p = whitePlayer();
    const wrongCaste = ALL_UPGRADES.find((u) => u.caste !== "white")!;
    expect(() =>
      validateApplyUpgrade({
        player: p,
        upgradeId: wrongCaste.id,
        targetId: wrongCaste.targetId,
      })
    ).toThrow(UpgradeWrongCasteError);
  });

  it("rejects when target already has an active upgrade", () => {
    const targetId = "white-ground-pikeman";
    const opt1 = ALL_UPGRADES.find(
      (u) => u.targetId === targetId && u.optionIndex === 1
    )!;
    const opt2 = ALL_UPGRADES.find(
      (u) => u.targetId === targetId && u.optionIndex === 2
    )!;
    const p: GamePlayer = {
      ...whitePlayer(),
      activeUpgrades: { [targetId]: opt1.id },
    };
    expect(() =>
      validateApplyUpgrade({ player: p, upgradeId: opt2.id, targetId })
    ).toThrow(UpgradeAlreadyActiveError);
  });

  it("accepts a valid first-time apply", () => {
    const p = whitePlayer();
    const opt = ALL_UPGRADES.find(
      (u) => u.targetId === "white-ground-pikeman" && u.optionIndex === 1
    )!;
    expect(() =>
      validateApplyUpgrade({
        player: p,
        upgradeId: opt.id,
        targetId: opt.targetId,
      })
    ).not.toThrow();
  });
});

describe("validateRemoveUpgrade", () => {
  it("rejects when nothing is active for the target", () => {
    const p = newPlayer("u", new Date("2026-01-01T00:00:00Z"));
    expect(() =>
      validateRemoveUpgrade({ player: p, targetId: "white-ground-pikeman" })
    ).toThrow(UpgradeNotActiveError);
  });

  it("returns the active upgrade id when set", () => {
    const targetId = "white-ground-pikeman";
    const opt = ALL_UPGRADES.find(
      (u) => u.targetId === targetId && u.optionIndex === 1
    )!;
    const p: GamePlayer = {
      ...newPlayer("u", new Date("2026-01-01T00:00:00Z")),
      caste: "white",
      activeUpgrades: { [targetId]: opt.id },
    };
    expect(validateRemoveUpgrade({ player: p, targetId })).toEqual({
      upgradeId: opt.id,
    });
  });
});

describe("getActiveUpgrades", () => {
  it("coalesces missing field to empty object", () => {
    expect(getActiveUpgrades(null)).toEqual({});
    expect(getActiveUpgrades(undefined)).toEqual({});
    expect(getActiveUpgrades({ activeUpgrades: undefined })).toEqual({});
  });

  it("returns the field when present", () => {
    const v = { x: "y" };
    expect(getActiveUpgrades({ activeUpgrades: v })).toBe(v);
  });
});

describe("UPGRADE_TURN_COST", () => {
  it("matches the land-reassignment cost (1 turn per change)", () => {
    expect(UPGRADE_TURN_COST).toBe(1);
  });
});
