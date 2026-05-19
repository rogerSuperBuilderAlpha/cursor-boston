/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Aggregates the per-caste special-unit registries. Contributors PR
 * additional units into the relevant caste file and they auto-register.
 */

import type { Caste, SpecialUnitDef } from "../../types";
import { BLACK_SPECIAL_UNITS } from "./black";
import { BLUE_SPECIAL_UNITS } from "./blue";
import { GREEN_SPECIAL_UNITS } from "./green";
import { RED_SPECIAL_UNITS } from "./red";
import { WHITE_SPECIAL_UNITS } from "./white";

export const SPECIAL_UNITS_BY_CASTE: Record<
  Caste,
  ReadonlyArray<SpecialUnitDef>
> = {
  white: WHITE_SPECIAL_UNITS,
  black: BLACK_SPECIAL_UNITS,
  red: RED_SPECIAL_UNITS,
  green: GREEN_SPECIAL_UNITS,
  blue: BLUE_SPECIAL_UNITS,
};

/** Flat index of every defined special unit, keyed by id. Used by the
 *  combat path to resolve a stationed `SpecialUnitInstance.defId` back
 *  to its stat bundle. */
export const SPECIAL_UNITS_BY_ID: Map<string, SpecialUnitDef> = (() => {
  const m = new Map<string, SpecialUnitDef>();
  for (const caste of Object.keys(SPECIAL_UNITS_BY_CASTE) as Caste[]) {
    for (const def of SPECIAL_UNITS_BY_CASTE[caste]) {
      m.set(def.id, def);
    }
  }
  return m;
})();

/** Picks one special-unit def at random from the caste's pool. Returns
 *  null if the caste has no defined units (shouldn't happen in v1). */
export function pickSpecialUnitDef(
  caste: Caste,
  rng: () => number
): SpecialUnitDef | null {
  const pool = SPECIAL_UNITS_BY_CASTE[caste];
  if (!pool || pool.length === 0) return null;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}
