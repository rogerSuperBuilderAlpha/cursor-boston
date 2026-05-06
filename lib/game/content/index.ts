/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  BuildingDefinition,
  Caste,
  CasteProfile,
  SpellDefinition,
  SpellType,
  UnitDefinition,
  UnitType,
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

import { BLACK_DEFENSE_SPELL } from "./spells/black/defense";
import { BLACK_OFFENSE_SPELL } from "./spells/black/offense";
import { BLACK_PRODUCTION_SPELL } from "./spells/black/production";
import { BLUE_DEFENSE_SPELL } from "./spells/blue/defense";
import { BLUE_OFFENSE_SPELL } from "./spells/blue/offense";
import { BLUE_PRODUCTION_SPELL } from "./spells/blue/production";
import { GREEN_DEFENSE_SPELL } from "./spells/green/defense";
import { GREEN_OFFENSE_SPELL } from "./spells/green/offense";
import { GREEN_PRODUCTION_SPELL } from "./spells/green/production";
import { RED_DEFENSE_SPELL } from "./spells/red/defense";
import { RED_OFFENSE_SPELL } from "./spells/red/offense";
import { RED_PRODUCTION_SPELL } from "./spells/red/production";
import { WHITE_DEFENSE_SPELL } from "./spells/white/defense";
import { WHITE_OFFENSE_SPELL } from "./spells/white/offense";
import { WHITE_PRODUCTION_SPELL } from "./spells/white/production";

import { BUILDINGS } from "./buildings";

export const ALL_UNITS: UnitDefinition[] = [
  WHITE_GROUND_UNIT, WHITE_SIEGE_UNIT, WHITE_AIR_UNIT,
  BLUE_GROUND_UNIT, BLUE_SIEGE_UNIT, BLUE_AIR_UNIT,
  BLACK_GROUND_UNIT, BLACK_SIEGE_UNIT, BLACK_AIR_UNIT,
  RED_GROUND_UNIT, RED_SIEGE_UNIT, RED_AIR_UNIT,
  GREEN_GROUND_UNIT, GREEN_SIEGE_UNIT, GREEN_AIR_UNIT,
];

export const ALL_SPELLS: SpellDefinition[] = [
  WHITE_DEFENSE_SPELL, WHITE_OFFENSE_SPELL, WHITE_PRODUCTION_SPELL,
  BLUE_DEFENSE_SPELL, BLUE_OFFENSE_SPELL, BLUE_PRODUCTION_SPELL,
  BLACK_DEFENSE_SPELL, BLACK_OFFENSE_SPELL, BLACK_PRODUCTION_SPELL,
  RED_DEFENSE_SPELL, RED_OFFENSE_SPELL, RED_PRODUCTION_SPELL,
  GREEN_DEFENSE_SPELL, GREEN_OFFENSE_SPELL, GREEN_PRODUCTION_SPELL,
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

export function getUnitForCasteAndType(caste: Caste, type: UnitType): UnitDefinition {
  const found = ALL_UNITS.find((u) => u.caste === caste && u.type === type);
  if (!found) {
    throw new Error(`No unit registered for caste=${caste} type=${type}`);
  }
  return found;
}

export function getSpellForCasteAndType(
  caste: Caste,
  type: SpellType
): SpellDefinition {
  const found = ALL_SPELLS.find((s) => s.caste === caste && s.type === type);
  if (!found) {
    throw new Error(`No spell registered for caste=${caste} type=${type}`);
  }
  return found;
}

export { CASTE_PROFILES, getCasteProfile };
export type { CasteProfile };
