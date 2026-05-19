/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition } from "../../types";

export const LEGENDARY_ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "legendary-crown-of-the-first-general",
    name: "Crown of the First General",
    rarity: "legendary",
    type: "utility",
    baseStrength: 220,
    description:
      "A simple iron circlet, dented and dark. It is said the First General wore it and never lost a battle.",
    flavorOnFind:
      "It sits on a stone bench in a sunlit grove, as if its owner had taken it off for a moment and forgotten to come back. The grass beneath the bench has not grown in centuries.",
  },
  {
    id: "legendary-the-last-banner",
    name: "The Last Banner",
    rarity: "legendary",
    type: "production",
    baseStrength: 200,
    description:
      "A banner of unknown house, faded almost white, that snaps in a wind no one else can feel.",
    flavorOnFind:
      "Planted in the center of an empty battlefield. Whatever battle was fought here, the histories do not record it. The banner welcomes you like an old friend.",
  },
  {
    id: "legendary-stillborn-storm",
    name: "Stillborn Storm",
    rarity: "legendary",
    type: "offense",
    baseStrength: 240,
    description:
      "A glass shard from a storm that never finished forming. The shard hums when held.",
    flavorOnFind:
      "It falls into your captain's hand from a clear sky. Three witnesses see it; only one of them tells the story.",
  },
  {
    id: "legendary-aegis-of-the-quiet-king",
    name: "Aegis of the Quiet King",
    rarity: "legendary",
    type: "defense",
    baseStrength: 230,
    description:
      "A round shield bearing the crest of a king who never spoke a word and never lost a battle.",
    flavorOnFind:
      "It hangs above a stone bench in an empty hall. The hall has no doors and no roof, and the sun does not seem to move while you are inside it.",
  },
];
