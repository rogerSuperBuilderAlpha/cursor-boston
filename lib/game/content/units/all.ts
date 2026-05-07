/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { UnitDefinition } from "../../types";

import { BLACK_AIR_UNIT } from "./black/air";
import { BLACK_GROUND_UNIT } from "./black/ground";
import { BLACK_SIEGE_UNIT } from "./black/siege";
import { BLUE_AIR_UNIT } from "./blue/air";
import { BLUE_GROUND_UNIT } from "./blue/ground";
import { BLUE_SIEGE_UNIT } from "./blue/siege";
import { GREEN_AIR_UNIT } from "./green/air";
import { GREEN_GROUND_UNIT } from "./green/ground";
import { GREEN_SIEGE_UNIT } from "./green/siege";
import { RED_AIR_UNIT } from "./red/air";
import { RED_GROUND_UNIT } from "./red/ground";
import { RED_SIEGE_UNIT } from "./red/siege";
import { WHITE_AIR_UNIT } from "./white/air";
import { WHITE_GROUND_UNIT } from "./white/ground";
import { WHITE_SIEGE_UNIT } from "./white/siege";

// Flat list of every unit. content/index.ts re-exports as ALL_UNITS; upgrades
// import this directly to avoid a circular dep through index.
export const UNIT_LIST: UnitDefinition[] = [
  WHITE_GROUND_UNIT, WHITE_SIEGE_UNIT, WHITE_AIR_UNIT,
  BLUE_GROUND_UNIT, BLUE_SIEGE_UNIT, BLUE_AIR_UNIT,
  BLACK_GROUND_UNIT, BLACK_SIEGE_UNIT, BLACK_AIR_UNIT,
  RED_GROUND_UNIT, RED_SIEGE_UNIT, RED_AIR_UNIT,
  GREEN_GROUND_UNIT, GREEN_SIEGE_UNIT, GREEN_AIR_UNIT,
];
