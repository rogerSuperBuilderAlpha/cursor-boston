/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  ArtifactDefinition,
  BuildingDefinition,
  Caste,
  CasteProfile,
  SpellDefinition,
  SpellTier,
  SpellType,
  UnitDefinition,
  UnitType,
  UpgradeDefinition,
} from "../types";

import { CASTE_PROFILES, getCasteProfile } from "./castes";

import { BLACK_AIR_UNIT } from "./units/black/air";
import { BLACK_GROUND_UNIT } from "./units/black/ground";
import { BLACK_SIEGE_UNIT } from "./units/black/siege";
import { BLUE_AIR_UNIT } from "./units/blue/air";
import { BLUE_GROUND_UNIT } from "./units/blue/ground";
import { BLUE_SIEGE_UNIT } from "./units/blue/siege";
import { GREEN_AIR_UNIT } from "./units/green/air";
import { GREEN_GROUND_UNIT } from "./units/green/ground";
import { GREEN_SIEGE_UNIT } from "./units/green/siege";
import { RED_AIR_UNIT } from "./units/red/air";
import { RED_GROUND_UNIT } from "./units/red/ground";
import { RED_SIEGE_UNIT } from "./units/red/siege";
import { WHITE_AIR_UNIT } from "./units/white/air";
import { WHITE_GROUND_UNIT } from "./units/white/ground";
import { WHITE_SIEGE_UNIT } from "./units/white/siege";

import { BLACK_DEFENSE_SPELLS } from "./spells/black/defense";
import { BLACK_INTEL_SPELLS } from "./spells/black/intel";
import { BLACK_OFFENSE_SPELLS } from "./spells/black/offense";
import { BLACK_PRODUCTION_SPELLS } from "./spells/black/production";
import { BLUE_DEFENSE_SPELLS } from "./spells/blue/defense";
import { BLUE_INTEL_SPELLS } from "./spells/blue/intel";
import { BLUE_OFFENSE_SPELLS } from "./spells/blue/offense";
import { BLUE_PRODUCTION_SPELLS } from "./spells/blue/production";
import { GREEN_DEFENSE_SPELLS } from "./spells/green/defense";
import { GREEN_INTEL_SPELLS } from "./spells/green/intel";
import { GREEN_OFFENSE_SPELLS } from "./spells/green/offense";
import { GREEN_PRODUCTION_SPELLS } from "./spells/green/production";
import { RED_DEFENSE_SPELLS } from "./spells/red/defense";
import { RED_INTEL_SPELLS } from "./spells/red/intel";
import { RED_OFFENSE_SPELLS } from "./spells/red/offense";
import { RED_PRODUCTION_SPELLS } from "./spells/red/production";
import { WHITE_DEFENSE_SPELLS } from "./spells/white/defense";
import { WHITE_INTEL_SPELLS } from "./spells/white/intel";
import { WHITE_OFFENSE_SPELLS } from "./spells/white/offense";
import { WHITE_PRODUCTION_SPELLS } from "./spells/white/production";

import { BUILDINGS } from "./buildings";
import { ALL_UPGRADES } from "./upgrades";

import { ALL_ARTIFACTS, ARTIFACTS_BY_ID, ARTIFACTS_BY_RARITY } from "./artifacts";

export const ALL_UNITS: UnitDefinition[] = [
  WHITE_GROUND_UNIT, WHITE_SIEGE_UNIT, WHITE_AIR_UNIT,
  BLUE_GROUND_UNIT, BLUE_SIEGE_UNIT, BLUE_AIR_UNIT,
  BLACK_GROUND_UNIT, BLACK_SIEGE_UNIT, BLACK_AIR_UNIT,
  RED_GROUND_UNIT, RED_SIEGE_UNIT, RED_AIR_UNIT,
  GREEN_GROUND_UNIT, GREEN_SIEGE_UNIT, GREEN_AIR_UNIT,
];

export const ALL_SPELLS: SpellDefinition[] = [
  ...WHITE_DEFENSE_SPELLS, ...WHITE_OFFENSE_SPELLS, ...WHITE_PRODUCTION_SPELLS,
  ...WHITE_INTEL_SPELLS,
  ...BLUE_DEFENSE_SPELLS, ...BLUE_OFFENSE_SPELLS, ...BLUE_PRODUCTION_SPELLS,
  ...BLUE_INTEL_SPELLS,
  ...BLACK_DEFENSE_SPELLS, ...BLACK_OFFENSE_SPELLS, ...BLACK_PRODUCTION_SPELLS,
  ...BLACK_INTEL_SPELLS,
  ...RED_DEFENSE_SPELLS, ...RED_OFFENSE_SPELLS, ...RED_PRODUCTION_SPELLS,
  ...RED_INTEL_SPELLS,
  ...GREEN_DEFENSE_SPELLS, ...GREEN_OFFENSE_SPELLS, ...GREEN_PRODUCTION_SPELLS,
  ...GREEN_INTEL_SPELLS,
];

export const ALL_BUILDINGS: BuildingDefinition[] = BUILDINGS;

export const UNITS_BY_ID = new Map<string, UnitDefinition>(
  ALL_UNITS.map((u) => [u.id, u])
);
export const SPELLS_BY_ID = new Map<string, SpellDefinition>(
  ALL_SPELLS.map((s) => [s.id, s])
);
export const BUILDINGS_BY_ID = new Map<string, BuildingDefinition>(
  ALL_BUILDINGS.map((b) => [b.id, b])
);
export const UPGRADES_BY_ID = new Map<string, UpgradeDefinition>(
  ALL_UPGRADES.map((u) => [u.id, u])
);

export { ALL_UPGRADES };

export function getUnitForCasteAndType(caste: Caste, type: UnitType): UnitDefinition {
  const found = ALL_UNITS.find((u) => u.caste === caste && u.type === type);
  if (!found) {
    throw new Error(`No unit registered for caste=${caste} type=${type}`);
  }
  return found;
}

// Returns the tier-1 spell for a caste/type — the always-available baseline.
// Use getSpellsForCasteAndType to get all five tiers.
export function getSpellForCasteAndType(
  caste: Caste,
  type: SpellType
): SpellDefinition {
  const found = ALL_SPELLS.find(
    (s) => s.caste === caste && s.type === type && s.tier === 1
  );
  if (!found) {
    throw new Error(`No tier-1 spell registered for caste=${caste} type=${type}`);
  }
  return found;
}

// All five tiers of spells for a given caste+type, in tier order (1..5).
export function getSpellsForCasteAndType(
  caste: Caste,
  type: SpellType
): SpellDefinition[] {
  return ALL_SPELLS.filter((s) => s.caste === caste && s.type === type).sort(
    (a, b) => a.tier - b.tier
  );
}

// Returns the highest-tier spell of (caste, type) the player can cast given
// their tilesHeld. Returns tier-1 if no higher tier qualifies.
export function getHighestUnlockedSpell(
  caste: Caste,
  type: SpellType,
  tilesHeld: number
): SpellDefinition {
  const tiers = getSpellsForCasteAndType(caste, type);
  let best = tiers[0];
  for (const s of tiers) {
    if (tilesHeld >= s.minTilesRequired) best = s;
  }
  return best;
}

// True if a spell's territory gate is satisfied for the given player size.
export function isSpellUnlocked(
  spell: SpellDefinition,
  tilesHeld: number
): boolean {
  return tilesHeld >= spell.minTilesRequired;
}

export function buildingForCasteAndLand(
  caste: Caste,
  landType: BuildingDefinition["landType"]
): BuildingDefinition | undefined {
  return ALL_BUILDINGS.find(
    (b) => b.caste === caste && b.landType === landType
  );
}

export function upgradesForTarget(targetId: string): UpgradeDefinition[] {
  return ALL_UPGRADES.filter((u) => u.targetId === targetId);
}

export { CASTE_PROFILES, getCasteProfile };
export type { CasteProfile, SpellTier };

export { ALL_ARTIFACTS, ARTIFACTS_BY_ID, ARTIFACTS_BY_RARITY };
export type { ArtifactDefinition };
