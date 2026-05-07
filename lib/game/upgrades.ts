/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { BUILDINGS_BY_ID, UNITS_BY_ID, UPGRADES_BY_ID } from "./content";
import type {
  BuildingDefinition,
  GamePlayer,
  UnitDefinition,
} from "./types";

// Coalesced read of player.activeUpgrades — legacy player docs predate the
// field, so reads must always go through this helper.
export function getActiveUpgrades(
  player: Pick<GamePlayer, "activeUpgrades"> | null | undefined
): Record<string, string> {
  return player?.activeUpgrades ?? {};
}

export interface EffectiveUnitStats {
  attack: number;
  defense: number;
  hp: number;
}

// Unit stats with the player's active upgrade for that unit applied. If no
// upgrade is active the base stats are returned unchanged.
export function effectiveUnitStats(
  unit: UnitDefinition,
  active: Record<string, string>
): EffectiveUnitStats {
  const upgradeId = active[unit.id];
  let attack = unit.attack;
  let defense = unit.defense;
  let hp = unit.hp;
  if (upgradeId) {
    const u = UPGRADES_BY_ID.get(upgradeId);
    if (u && u.targetKind === "unit" && u.targetId === unit.id) {
      attack += u.effects.attackDelta ?? 0;
      defense += u.effects.defenseDelta ?? 0;
      hp += u.effects.hpDelta ?? 0;
    }
  }
  return {
    attack: Math.max(1, attack),
    defense: Math.max(1, defense),
    hp: Math.max(1, hp),
  };
}

// Sum of capacity-bonus deltas from this player's active upgrade for a given
// building (a single building per land type per caste).
export function buildingCapacityBonus(
  building: BuildingDefinition,
  active: Record<string, string>
): number {
  const base = building.capacityBonus ?? 0;
  const upgradeId = active[building.id];
  if (!upgradeId) return base;
  const u = UPGRADES_BY_ID.get(upgradeId);
  if (!u || u.targetKind !== "building" || u.targetId !== building.id) {
    return base;
  }
  return base + (u.effects.capacityBonusDelta ?? 0);
}

// Returns the player's bonus magic-multiplier from any active building upgrade
// that grants one. Currently magic-tile building upgrades can carry this.
export function magicMultiplierBonusFromUpgrades(
  active: Record<string, string>
): number {
  let bonus = 0;
  for (const upgradeId of Object.values(active)) {
    const u = UPGRADES_BY_ID.get(upgradeId);
    if (!u) continue;
    if (u.targetKind !== "building") continue;
    bonus += u.effects.magicMultiplierDelta ?? 0;
  }
  return bonus;
}

export class UpgradeNotFoundError extends Error {
  constructor(id: string) {
    super(`Upgrade not found: ${id}`);
    this.name = "UpgradeNotFoundError";
  }
}
export class UpgradeWrongCasteError extends Error {
  constructor() {
    super("That upgrade is not available to your caste");
    this.name = "UpgradeWrongCasteError";
  }
}
export class UpgradeAlreadyActiveError extends Error {
  constructor() {
    super("Target already has an active upgrade — remove it first");
    this.name = "UpgradeAlreadyActiveError";
  }
}
export class UpgradeNotActiveError extends Error {
  constructor() {
    super("Target has no active upgrade to remove");
    this.name = "UpgradeNotActiveError";
  }
}
export class UpgradeUnknownTargetError extends Error {
  constructor(targetId: string) {
    super(`Unknown upgrade target: ${targetId}`);
    this.name = "UpgradeUnknownTargetError";
  }
}

// Cost of a single upgrade apply or remove. Mirrors land re-assignment which
// charges 1 turn per change. Switching A→B is therefore 2 turns (remove then
// apply), the same shape as land downgrade-then-upgrade.
export const UPGRADE_TURN_COST = 1;

export interface ValidatedUpgradeApply {
  unit?: UnitDefinition;
  building?: BuildingDefinition;
}

// Validates an apply request without mutating anything. Throws on any error.
export function validateApplyUpgrade(args: {
  player: GamePlayer;
  upgradeId: string;
  targetId: string;
}): ValidatedUpgradeApply {
  const { player, upgradeId, targetId } = args;
  const upgrade = UPGRADES_BY_ID.get(upgradeId);
  if (!upgrade) throw new UpgradeNotFoundError(upgradeId);
  if (upgrade.targetId !== targetId) {
    throw new UpgradeUnknownTargetError(targetId);
  }
  if (player.caste === null || upgrade.caste !== player.caste) {
    throw new UpgradeWrongCasteError();
  }
  const active = getActiveUpgrades(player);
  if (active[targetId]) throw new UpgradeAlreadyActiveError();

  if (upgrade.targetKind === "unit") {
    const unit = UNITS_BY_ID.get(targetId);
    if (!unit) throw new UpgradeUnknownTargetError(targetId);
    return { unit };
  }
  const building = BUILDINGS_BY_ID.get(targetId);
  if (!building) throw new UpgradeUnknownTargetError(targetId);
  return { building };
}

export function validateRemoveUpgrade(args: {
  player: GamePlayer;
  targetId: string;
}): { upgradeId: string } {
  const active = getActiveUpgrades(args.player);
  const upgradeId = active[args.targetId];
  if (!upgradeId) throw new UpgradeNotActiveError();
  return { upgradeId };
}
