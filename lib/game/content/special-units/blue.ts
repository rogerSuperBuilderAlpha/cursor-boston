/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpecialUnitDef } from "../../types";

/** Blue caste — sky-reader, sea-bound, hawkish. */
export const BLUE_SPECIAL_UNITS: ReadonlyArray<SpecialUnitDef> = [
  {
    id: "blue-storm-mariner",
    caste: "blue",
    name: "Storm-Mariner",
    description:
      "Tide-trained marines who can read a battle the way they read a squall.",
    attackBonus: 40,
    defenseBonus: 25,
    flavor: "They have already seen worse weather than your army.",
  },
  {
    id: "blue-far-glass-scout",
    caste: "blue",
    name: "Far-Glass Scout",
    description:
      "Long-range observers whose presence makes a tile harder to surprise.",
    attackBonus: 25,
    defenseBonus: 45,
    flavor: "Bring the spyglass. Bring two — the other one's for the wind.",
  },
  {
    id: "blue-mistwing-corps",
    caste: "blue",
    name: "Mistwing Corps",
    description: "Air-trained skirmishers who hold ground from above as much as on it.",
    attackBonus: 35,
    defenseBonus: 35,
    flavor: "The corps does not land. The corps relieves.",
  },
];
