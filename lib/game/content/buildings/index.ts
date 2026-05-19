/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BuildingDefinition } from "../../types";
import { BUILDING_SEEDS } from "./seeds";

// One building per (caste, landType). Upgrades reference these by id.
// Land type IS the building — assigning a tile to "military" / "food" /
// "magic" places that caste's corresponding building on the tile.
export const BUILDINGS: BuildingDefinition[] = BUILDING_SEEDS;
