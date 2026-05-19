/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Per-caste hero-name pools. Contributors add caste-themed names by
 * appending to the relevant file; the aggregate map below picks them up.
 */

import type { Caste } from "../../types";
import { BLACK_HERO_NAMES } from "./black";
import { BLUE_HERO_NAMES } from "./blue";
import { GREEN_HERO_NAMES } from "./green";
import { RED_HERO_NAMES } from "./red";
import { WHITE_HERO_NAMES } from "./white";

export const HERO_NAMES_BY_CASTE: Record<Caste, ReadonlyArray<string>> = {
  black: BLACK_HERO_NAMES,
  red: RED_HERO_NAMES,
  white: WHITE_HERO_NAMES,
  green: GREEN_HERO_NAMES,
  blue: BLUE_HERO_NAMES,
};

/** Fallback for any caste whose pool is empty (shouldn't happen in v1
 *  but keeps `pickHeroName` total). */
export const FALLBACK_HERO_NAME = "Nameless Hero";
