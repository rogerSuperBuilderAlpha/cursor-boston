/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpecialUnitDef } from "../../types";

/** Green caste — root, glade, slow patience. */
export const GREEN_SPECIAL_UNITS: ReadonlyArray<SpecialUnitDef> = [
  {
    id: "green-root-warden",
    caste: "green",
    name: "Root-Warden",
    description:
      "Mossfooted scout who treats every defended tile like a glade they were born in.",
    attackBonus: 20,
    defenseBonus: 55,
    flavor: "Patient enough to outlast the besieger's patience.",
  },
  {
    id: "green-acorn-rider",
    caste: "green",
    name: "Acorn-Rider",
    description:
      "Light cavalry that strikes from the treeline, then disappears back into it.",
    attackBonus: 40,
    defenseBonus: 20,
    flavor: "They count the enemy by their boots — and never by their faces.",
  },
  {
    id: "green-bough-keeper",
    caste: "green",
    name: "Bough-Keeper",
    description:
      "Druid-soldier whose presence makes the tile feel half-fortified, half-overgrown.",
    attackBonus: 30,
    defenseBonus: 40,
    flavor: "They speak with the tile, then to the soldiers, in that order.",
  },
];
