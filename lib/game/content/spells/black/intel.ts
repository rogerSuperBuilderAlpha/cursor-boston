/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Black pays in blood for the deepest read — a kingdom-wide audit, but the
// caster sacrifices an air unit at cast time. The defender feels the spy
// (alerted, +20% defense vs caster for 5 turns) — handled in the cast server.
export const BLACK_INTEL_SPELLS: SpellDefinition[] = [
  {
    id: "black-intel-vein-of-truth-t2",
    caste: "black",
    type: "intel",
    name: "Vein of Truth",
    baseStrength: 0,
    description:
      "An offering opens a vein between two minds. Reveals the target tile and a kingdom-wide audit of its owner. Costs one air unit at cast time. The defender is alerted.",
    tier: 2,
    minTilesRequired: 1500,
    turnCost: 8,
    intelScope: "kingdom",
  },
];
