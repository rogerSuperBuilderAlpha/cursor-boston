/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  BuildingDefinition,
  Caste,
  LandType,
  UpgradeDefinition,
  UpgradeEffects,
} from "../../types";
import { BUILDING_SEEDS } from "../buildings/seeds";

type BuildingLandType = Extract<LandType, "military" | "food" | "magic">;

interface OptionTriple {
  // [Throughput option, Resilience option, Specialised-output option]
  military: [string, string, string];
  food:     [string, string, string];
  magic:    [string, string, string];
}

const NAMES: Record<Caste, OptionTriple> = {
  white: {
    military: ["Drilling Yard",  "Outer Walls",       "Captain's Stables"],
    food:     ["Harvest Tithes", "Stone Vault",       "Hospital Garden"],
    magic:    ["Scriptorium",    "Sanctified Halls",  "Pilgrim's Lantern"],
  },
  blue: {
    military: ["Cloud Drydocks", "Sea-Wall Anchorage", "Skyrunner Roost"],
    food:     ["Tide-Mill Yard", "Salting Cellars",    "Reef Farms"],
    magic:    ["Star Loft",      "Stilled Pool",       "Tide Tablet"],
  },
  black: {
    military: ["Catacomb Drills","Bone-Iron Gate",     "Whisper Lines"],
    food:     ["Carrion Press",  "Cold Crypt Stores",  "Blood Cellar"],
    magic:    ["Whispering Vault","Shroud Workshop",   "Reading Stones"],
  },
  red: {
    military: ["Twin Forges",    "Iron Curtain",       "Master Armoury"],
    food:     ["Coal-Oven Halls","Ash-Sealed Vaults",  "Ironkettle Mess"],
    magic:    ["Crucible Tower", "Lined Brick Walls",  "Hammer Reading"],
  },
  green: {
    military: ["Briar Yard",     "Living Palisade",    "Greenwarden Cant"],
    food:     ["Old Orchard Run","Root Cellars",       "Honey Apiary"],
    magic:    ["Ringing Glade",  "Mossbound Walls",    "Wayfinder's Rest"],
  },
};

const DESCRIPTIONS: Record<Caste, OptionTriple> = {
  white: {
    military: ["A wider yard. Recruits drill in larger numbers; the line forms faster.",
               "Outer walls thickened in a fortnight. Soldiers stationed here hold longer.",
               "Captains have their own mounts; the column moves where they tell it to."],
    food:     ["Tithes counted twice. The cap is heavier than expected.",
               "Vault rebuilt in stone. Even fire does not get in.",
               "A hospital garden, herbs in rows. Wounded recover. Cap gains a margin."],
    magic:    ["A long room of desks and inkpots. Spells written here cast cleanly.",
               "Halls dressed in gold. Counter-spells slip off the walls.",
               "A lantern that does not need filling. Spell ranges extend a little further."],
  },
  blue: {
    military: ["Drydocks pinned to slow clouds. Air-units launch in tighter formation.",
               "Anchorage cut into the sea-wall. Defenders here are hard to flank.",
               "A roost of fast-flying scouts. The column knows the field before it gets there."],
    food:     ["Mills powered by the tide. Cap rises with the moon.",
               "Cellars salted to last a year. Stores carry through bad weeks.",
               "Reefs farmed for kelp and silver-fish. Variety means cap holds steady."],
    magic:    ["A loft built for star-watching. Spells benefit from clean lines of sight.",
               "A pool that does not ripple. Spells cast over it return to themselves clearly.",
               "A tablet that records the tide. Magic timing improves quietly."],
  },
  black: {
    military: ["Drills in catacomb halls. Recruits learn to fight by lamplight.",
               "Gates of bone-iron. They warp, but they do not break.",
               "Whisper lines from cell to cell. Orders arrive fast and unheard."],
    food:     ["Press that does not need stopping. Cap rises and stays.",
               "Crypts kept cold by ritual. Stores last; the hungry quiet.",
               "A cellar of bottled blood. Cap rises in the quiet way blacks prefer."],
    magic:    ["A vault that whispers back. Spells heard here cast louder.",
               "Workshop of shrouds. Counter-magic falters at the threshold.",
               "Stones the readers consult before any cast. Spells aim themselves."],
  },
  red: {
    military: ["Two forges instead of one. The recruits arrive armed.",
               "An iron curtain at the gate. Counter-fire does not pass it.",
               "An armoury with masters. The line equips itself in half the time."],
    food:     ["Ovens that do not cool. Cap climbs with the bread.",
               "Vaults sealed in ash. The pantries last a season longer.",
               "An ironkettle mess. Soldiers eat better; the cap reflects it."],
    magic:    ["A crucible tower. Spells here run hotter and longer.",
               "Walls lined with fire-brick. Counter-spells slow at the mortar.",
               "A reader who tells time by hammer-fall. Spell timing is exact."],
  },
  green: {
    military: ["A yard fenced in living briar. Recruits learn to fight quietly.",
               "A palisade that grows back overnight. Defenders here stand longer.",
               "The greenwarden's cant. Officers and scouts share a single language."],
    food:     ["Old orchard run by the year. Fruit ripens whenever it likes; cap rises.",
               "Cellars cut among roots. Stores cool themselves; spoilage falls.",
               "An apiary of honey-bees. A small luxury; the cap holds in lean weeks."],
    magic:    ["A glade that rings on its own. Spells cast inside it lift cleanly.",
               "Walls bound in living moss. Counter-magic absorbs into the green.",
               "A wayfinder's rest. Spell directions never cross."],
  },
};

const OPTION_DELTAS_BY_LAND: Record<BuildingLandType, [
  UpgradeEffects,
  UpgradeEffects,
  UpgradeEffects,
]> = {
  // Military: throughput / hardness / specialised
  military: [
    { capacityBonusDelta: 60 },
    { capacityBonusDelta: 30, defenseDelta: 1 },
    { capacityBonusDelta: 20, attackDelta: 1 },
  ],
  // Food: capacity-leaning, plus small support deltas
  food: [
    { capacityBonusDelta: 80 },
    { capacityBonusDelta: 40, hpDelta: 1 },
    { capacityBonusDelta: 30, defenseDelta: 1 },
  ],
  // Magic: small flat capacity, but boost the player's magic-multiplier
  magic: [
    { capacityBonusDelta: 20, magicMultiplierDelta: 0.05 },
    { capacityBonusDelta: 30, defenseDelta: 1 },
    { capacityBonusDelta: 20, magicMultiplierDelta: 0.025, attackDelta: 1 },
  ],
};

function makeUpgradesFor(building: BuildingDefinition): UpgradeDefinition[] {
  if (building.caste === "neutral") return [];
  const land = building.landType as BuildingLandType;
  if (land !== "military" && land !== "food" && land !== "magic") return [];
  const names = NAMES[building.caste][land];
  const descs = DESCRIPTIONS[building.caste][land];
  const deltas = OPTION_DELTAS_BY_LAND[land];
  return ([1, 2, 3] as const).map((opt) => {
    const idx = opt - 1;
    return {
      id: `${building.id}-upgrade-${opt}`,
      caste: building.caste as Caste,
      targetKind: "building" as const,
      targetId: building.id,
      name: names[idx],
      description: descs[idx],
      effects: deltas[idx],
      optionIndex: opt,
    };
  });
}

export const BUILDING_UPGRADES: UpgradeDefinition[] = BUILDING_SEEDS.flatMap(
  makeUpgradesFor
);
