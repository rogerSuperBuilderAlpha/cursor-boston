/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpecialUnitDef } from "../../types";

/** Red caste — forge-mountain, hammer-on-anvil. */
export const RED_SPECIAL_UNITS: ReadonlyArray<SpecialUnitDef> = [
  {
    id: "red-forge-bound",
    caste: "red",
    name: "Forge-Bound",
    description:
      "A platoon raised inside the bellows. They march to the cadence of hammers.",
    attackBonus: 45,
    defenseBonus: 30,
    flavor: "Each one knows the temperature of the steel before it speaks.",
  },
  {
    id: "red-bellows-priest",
    caste: "red",
    name: "Bellows-Priest",
    description:
      "Carries an idol of cold iron. The cold travels — through the wall, through the night.",
    attackBonus: 20,
    defenseBonus: 50,
    flavor: "The priest does not bless. The priest tempers.",
  },
  {
    id: "red-cinder-captain",
    caste: "red",
    name: "Cinder-Captain",
    description:
      "Veteran officer who turned down a forge and took a banner instead.",
    attackBonus: 35,
    defenseBonus: 35,
    flavor: "Still smells like a forge. Still answers to it.",
  },
];
