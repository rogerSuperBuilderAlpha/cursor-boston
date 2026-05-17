/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpecialUnitDef } from "../../types";

/** White caste — order-faithful named units summoned by farm heroes.
 *  Contributors: append additional `SpecialUnitDef`s here. */
export const WHITE_SPECIAL_UNITS: ReadonlyArray<SpecialUnitDef> = [
  {
    id: "white-knight-of-the-broken-lance",
    caste: "white",
    name: "Knight of the Broken Lance",
    description:
      "A penitent knight pledged to a single tile until forgiveness or death.",
    attackBonus: 35,
    defenseBonus: 45,
    flavor: "The lance was broken on purpose. The knight's was not.",
  },
  {
    id: "white-warden-of-the-pale-coast",
    caste: "white",
    name: "Warden of the Pale Coast",
    description: "Coastal-trained heavy infantry, slow to advance, hard to dislodge.",
    attackBonus: 20,
    defenseBonus: 60,
    flavor: "They wait for the tide and the enemy in roughly the same way.",
  },
  {
    id: "white-bell-ringer",
    caste: "white",
    name: "Bell-Ringer",
    description:
      "A roving paladin whose chapel-bell rallies any tile they pass through.",
    attackBonus: 30,
    defenseBonus: 30,
    flavor: "Where the bell sounds, the line steadies.",
  },
];
