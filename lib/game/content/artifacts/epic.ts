/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition } from "../../types";

export const EPIC_ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "epic-bloodmoon-blade",
    name: "Bloodmoon Blade",
    rarity: "epic",
    type: "offense",
    baseStrength: 130,
    description: "A curved sword that thrums when blood is in the air.",
    flavorOnFind:
      "It rests on a pillar in the center of a perfect ring of dead grass. Nothing has approached it for a long time. Until you.",
  },
  {
    id: "epic-bulwark-of-the-vow",
    name: "Bulwark of the Vow",
    rarity: "epic",
    type: "defense",
    baseStrength: 140,
    description: "A tower shield bound by an oath older than any kingdom.",
    flavorOnFind:
      "It stands upright in a glade, planted in soil that no rain has touched. As you lift it, you feel the oath settle on your shoulders.",
  },
  {
    id: "epic-hearthstone-of-empires",
    name: "Hearthstone of Empires",
    rarity: "epic",
    type: "production",
    baseStrength: 125,
    description: "A black stone that radiates a low, steady heat.",
    flavorOnFind:
      "You find it at the center of a city's foundation, abandoned mid-construction. The stone is the only thing that remained warm.",
  },
  {
    id: "epic-oracles-mirror",
    name: "Oracle's Mirror",
    rarity: "epic",
    type: "utility",
    baseStrength: 115,
    description: "A polished obsidian disc that shows what is about to happen.",
    flavorOnFind:
      "An old woman hands it to you, says \"It is yours now,\" and walks into the trees. You don't see her again.",
  },
  {
    id: "epic-cinderheart-orb",
    name: "Cinderheart Orb",
    rarity: "epic",
    type: "offense",
    baseStrength: 135,
    description: "A glass sphere holding a churning storm of embers.",
    flavorOnFind:
      "Floating an inch above a stone altar, slowly rotating. It descends into your palm without resistance.",
  },
  {
    id: "epic-warding-of-elahor",
    name: "Warding of Elahor",
    rarity: "epic",
    type: "defense",
    baseStrength: 142,
    description:
      "A stone disc carved with a name no living tongue still pronounces.",
    flavorOnFind:
      "It is set into the floor of a chapel with no door. Walking out, you find the chapel has no walls either.",
  },
  {
    id: "epic-stewards-key",
    name: "Steward's Key",
    rarity: "epic",
    type: "production",
    baseStrength: 128,
    description:
      "A small iron key that opens any granary it has been blessed for.",
    flavorOnFind:
      "Wrapped in oiled cloth, hanging from a peg in a granary that no one has used for forty years. The grain inside is fresh.",
  },
];
