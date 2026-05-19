/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BuildingDefinition, Caste, LandType } from "../../types";

interface Seed {
  caste: Caste;
  landType: Extract<LandType, "military" | "food" | "magic">;
  name: string;
  description: string;
}

const SEEDS: Seed[] = [
  // White — disciplined, hallowed
  { caste: "white", landType: "military", name: "Garrison Hall",  description: "Banners hung neatly. Every shield in its rack. The line forms quickly here." },
  { caste: "white", landType: "food",     name: "Tithe Granary",  description: "Stone vaults under a chapel. The grain is counted twice and prayed over once." },
  { caste: "white", landType: "magic",    name: "Reliquary",      description: "A small, well-lit room. The relics inside hum if you stand still." },
  // Blue — water, sky, study
  { caste: "blue",  landType: "military", name: "Sky-Wharf",      description: "Mooring posts angled at the clouds. Air units launch in formation, in silence." },
  { caste: "blue",  landType: "food",     name: "Tide Granary",   description: "Built where two rivers meet. The fish bring themselves." },
  { caste: "blue",  landType: "magic",    name: "Moonwell Spire", description: "A tower with no roof. The stars that matter look in." },
  // Black — death, blood, bone
  { caste: "black", landType: "military", name: "Charnel Barracks", description: "The drills happen at midnight. The recruits do not always sleep first." },
  { caste: "black", landType: "food",     name: "Hungering Mill",   description: "The mill grinds even when empty. The miller does not ask why." },
  { caste: "black", landType: "magic",    name: "Bone Sanctum",     description: "A round room of pale arches. Whispers travel along the inside of every rib." },
  // Red — fire, fury, forge
  { caste: "red",   landType: "military", name: "Forge Bastion",  description: "Hammers ring without pause. The recruits arrive scarred, grateful." },
  { caste: "red",   landType: "food",     name: "Ember Kitchen",  description: "Cooks and smiths share the same fire. Both come out lean and competent." },
  { caste: "red",   landType: "magic",    name: "Pyric Tower",    description: "A column of black brick around a column of fire. The fire holds itself." },
  // Green — wood, growth, territory
  { caste: "green", landType: "military", name: "Greenwarden Lodge", description: "Roofed in living vines. The recruits learn the names of the trees first." },
  { caste: "green", landType: "food",     name: "Old Orchard",       description: "Trees older than the realm. Their fruit ripens whenever it likes." },
  { caste: "green", landType: "magic",    name: "Ringing Grove",     description: "A circle of birches. They lean in when spells are cast inside them." },
];

// `id` convention: `${caste}-${landType}`. Stable across upgrades — upgrades
// reference this id as their targetId.
export const BUILDING_SEEDS: BuildingDefinition[] = SEEDS.map((s) => ({
  id: `${s.caste}-${s.landType}`,
  caste: s.caste,
  landType: s.landType,
  name: s.name,
  description: s.description,
  capacityBonus: 0,
}));
