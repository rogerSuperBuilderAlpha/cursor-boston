/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition } from "../../types";

export const RARE_ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "rare-stormglass-ward",
    name: "Stormglass Ward",
    rarity: "rare",
    type: "defense",
    baseStrength: 75,
    description: "A pane of dark glass that hums when storms approach.",
    flavorOnFind:
      "It was being used as a window in an abandoned chapel. When you pull it free, the wind dies for a full minute.",
  },
  {
    id: "rare-blackiron-maul",
    name: "Blackiron Maul",
    rarity: "rare",
    type: "offense",
    baseStrength: 80,
    description: "A two-handed maul forged from iron that drinks the light.",
    flavorOnFind:
      "Sunk haft-deep in the trunk of an oak. It comes free for you on the third pull, as if it had been waiting.",
  },
  {
    id: "rare-loamheart-seed",
    name: "Loamheart Seed",
    rarity: "rare",
    type: "production",
    baseStrength: 70,
    description: "A black seed the size of a fist, warm to the touch.",
    flavorOnFind:
      "A swarm of bees parts to reveal it nestled in the heart of a hollow log. They watch as you take it.",
  },
  {
    id: "rare-cartographers-eye",
    name: "Cartographer's Eye",
    rarity: "rare",
    type: "utility",
    baseStrength: 60,
    description: "A monocle that shows the land as it is, not as it appears.",
    flavorOnFind:
      "It lay on a desk in a tower with no doors. The maps on the wall still update themselves, slowly.",
  },
  {
    id: "rare-witchwoods-bow",
    name: "Witchwood's Bow",
    rarity: "rare",
    type: "offense",
    baseStrength: 78,
    description: "A bow carved from a tree that grew on a battlefield.",
    flavorOnFind:
      "The arrows it shoots find their target even in the dark. The string never seems to fray.",
  },
  {
    id: "rare-aegis-fragment",
    name: "Aegis Fragment",
    rarity: "rare",
    type: "defense",
    baseStrength: 82,
    description: "A shard of a shield from a forgotten god-king.",
    flavorOnFind:
      "Lodged in the wall of a grain silo. The farmer crosses himself when you pull it free, and asks no questions.",
  },
  {
    id: "rare-quartermasters-ledger",
    name: "Quartermaster's Ledger",
    rarity: "rare",
    type: "production",
    baseStrength: 72,
    description: "A leather-bound ledger that always balances.",
    flavorOnFind:
      "Every entry is in a different hand, but the totals always work out. Yours is the next blank page.",
  },
  {
    id: "rare-shadowstep-boots",
    name: "Shadowstep Boots",
    rarity: "rare",
    type: "utility",
    baseStrength: 65,
    description: "Soft leather boots that leave no print on dry ground.",
    flavorOnFind:
      "Found neatly placed beside a road, as if their owner had simply stepped out of them. Your size, somehow.",
  },
];
