/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { UpgradeDefinition } from "../../types";
import { UNIT_UPGRADES } from "./units";
import { BUILDING_UPGRADES } from "./buildings";

// 45 unit upgrades + 45 building upgrades = 90 total. UPGRADES_BY_ID is built
// from this array in content/index.ts.
export const ALL_UPGRADES: UpgradeDefinition[] = [
  ...UNIT_UPGRADES,
  ...BUILDING_UPGRADES,
];

export { UNIT_UPGRADES, BUILDING_UPGRADES };
