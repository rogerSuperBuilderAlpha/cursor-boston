/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Green sees the supply graph — uniquely Green, since Green's identity is
// the held line. Defender alerted on cast.
export const GREEN_INTEL_SPELLS: SpellDefinition[] = [
  {
    id: "green-intel-root-whisper-t2",
    caste: "green",
    type: "intel",
    name: "Root Whisper",
    baseStrength: 0,
    description:
      "Roots speak under stone. Reveals the target tile and its full supply network — every friendly neighbor that contributes, with land type — plus the defender's effective supply multiplier. The defender is alerted.",
    tier: 2,
    minTilesRequired: 1500,
    turnCost: 8,
    intelScope: "kingdom+supply",
  },
];
