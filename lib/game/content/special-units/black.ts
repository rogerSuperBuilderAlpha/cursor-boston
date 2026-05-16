/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpecialUnitDef } from "../../types";

/** Black caste — shroud, plague, oracle. */
export const BLACK_SPECIAL_UNITS: ReadonlyArray<SpecialUnitDef> = [
  {
    id: "black-shroud-runner",
    caste: "black",
    name: "Shroud Runner",
    description: "Silent skirmishers who arrive before the rumor of arrival.",
    attackBonus: 45,
    defenseBonus: 15,
    flavor: "They prefer the hour when neither side has yet decided to fight.",
  },
  {
    id: "black-plague-bearer",
    caste: "black",
    name: "Plague-Bearer",
    description:
      "A devoted carrier whose presence makes a defended tile dangerous to siege.",
    attackBonus: 15,
    defenseBonus: 55,
    flavor: "What they carry is faith. The cough is incidental.",
  },
  {
    id: "black-twin-faced-oracle",
    caste: "black",
    name: "Twin-Faced Oracle",
    description:
      "Speaks in two voices — one to your soldiers, one to the enemy's.",
    attackBonus: 25,
    defenseBonus: 40,
    flavor: "The second voice is always the one the enemy listens to.",
  },
];
