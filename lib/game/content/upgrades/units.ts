/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  AirIntelPassive,
  Caste,
  UnitDefinition,
  UnitType,
  UpgradeDefinition,
} from "../../types";
import { UNIT_LIST } from "../units/all";

// Three flavour archetypes per unit. Numbers are deltas applied on top of
// the unit's base stats. Tuned so any single option is +~15-25% of the unit's
// dominant stat without ever pushing a soft-melee into a hard-counter.
//
// The names are short and grouped — a contributor adding a new caste needs
// only to add an entry per unit type. The deltas can stay the same.

interface NameTriple {
  // [Offensive option, Defensive option, Utility option]
  ground: [string, string, string];
  siege:  [string, string, string];
  air:    [string, string, string];
}

const NAMES: Record<Caste, NameTriple> = {
  white: {
    ground: ["Honed Pikes",       "Tower Shields",      "Hymn of March"],
    siege:  ["Sanctified Shot",   "Reinforced Carriage","Long-Sight Engineers"],
    air:    ["Lance of Dawn",     "Blessed Plumage",    "Outrider Banners"],
  },
  blue: {
    ground: ["Ride of the Tide",  "Wave-Breakers",      "Maps of the Deep"],
    siege:  ["Lightning Ammo",    "Storm-Sealed Hull",  "Tidewright Crew"],
    air:    ["Squall Riders",     "Mistweave Cloaks",   "Star Compass"],
  },
  black: {
    ground: ["Marrow Edges",      "Bone Plate",         "Funeral Drums"],
    siege:  ["Ash Munitions",     "Reanimated Frame",   "Gravewatch Crew"],
    air:    ["Carrion Wings",     "Shroud Cloaks",      "Whispered Wing"],
  },
  red: {
    ground: ["Forged Edges",      "Coal-Plate Mail",    "Drillmaster's Cant"],
    siege:  ["Magma Shells",      "Iron-Belt Carriage", "Master Founder"],
    air:    ["Searing Talons",    "Fireproof Hide",     "Ash Compass"],
  },
  green: {
    ground: ["Boar-Tooth Spears", "Heartwood Shields",  "Hunters' Cant"],
    siege:  ["Briar Ammunition",  "Ironbark Frame",     "Druid-Sappers"],
    air:    ["Hawk-Trained Wings","Mossweave Hide",     "Wayfinder Roost"],
  },
};

const DESCRIPTIONS: Record<Caste, NameTriple> = {
  white: {
    ground: ["Pikes filed thin enough to whistle. They cut on the way out.",
             "Shields tall as a man. The line does not move.",
             "A single hymn the column knows. Forced marches go quietly."],
    siege:  ["Munitions blessed in the chapel. Catches and stays caught.",
             "Reinforcements at every joint. Counter-battery slides off.",
             "Engineers who range farther. The artillery sees more."],
    air:    ["A lance built for the dive. Strikes hit twice.",
             "Plumes that turn arrows. Riders return when they should not.",
             "Banners visible from the next valley. Friendly tiles see further."],
  },
  blue: {
    ground: ["Mounts conditioned to wet ground. Charges open at speed.",
             "Wide shields, thick boots. The breakers do not break.",
             "Old maps marked with safe routes. The column moves cleanly."],
    siege:  ["Ammunition crackles in the tube. Range goes up; defenders flinch.",
             "Hulls sealed with sky-wax. Counter-fire skims off.",
             "A crew that watches the tide. Reload windows arrive on time."],
    air:    ["Riders trained in line-storm. The dive is harder to track.",
             "Cloaks that drink fog. The air column survives bad weather.",
             "A compass tuned to working stars. Patrols cover more ground."],
  },
  black: {
    ground: ["Edges sharpened on a wet wheel. Cuts find marrow.",
             "Plate cut from larger bones. Wounds do not show.",
             "Drums that shake the ground. The march arrives early."],
    siege:  ["Ash-loaded shot. The battlefield darkens; aim narrows.",
             "Frame rebuilt from older frames. The siege reads its own war.",
             "Crew sworn to the gravewatch. Misfires almost never."],
    air:    ["Wings tipped in carrion oil. The dive carries weight.",
             "Cloaks woven of unmade shrouds. Riders are hard to see.",
             "A scout-tongue not spoken aloud. The flock holds formation."],
  },
  red: {
    ground: ["Edges drawn from the fire pink. Cuts cauterise.",
             "Mail thick with coal-iron. Footmen take more before falling.",
             "A drillmaster's cant. The column reforms in time."],
    siege:  ["Shells loaded with magma. Defenders' cover melts.",
             "Carriage girded in iron belt. Counter-fire leaves marks, not holes.",
             "A master founder rides the team. Misfires are uncommon and brief."],
    air:    ["Talons bright from the forge. Strafes leave streaks.",
             "Hide rubbed with fireproof oil. Mounts and riders both last.",
             "A compass blackened by ash. Patrols read distant smoke as ground."],
  },
  green: {
    ground: ["Spears with boar-bone tips. The tip remains sharp through three lines.",
             "Shields cut from heartwood. They do not shatter; they bend.",
             "A hunter's cant. The column reads the ground without speaking."],
    siege:  ["Ammunition wrapped in living briar. The brambles grow on impact.",
             "Frame of ironbark. Counter-fire bruises but does not break.",
             "Druid-sappers who feel the soil. Tunnels arrive in good places."],
    air:    ["Wings trained alongside hawks. The flight pattern is theirs.",
             "Hide woven through with moss. Mounts heal between sallies.",
             "A roost above the canopy. Wayfinders see the world around the tile."],
  },
};

// Effect deltas per option. Same shape across all castes/units; the flavor
// is in the names/descriptions.
const OPTION_DELTAS_BY_TYPE: Record<UnitType, [
  { attackDelta: number; defenseDelta: number; hpDelta: number },
  { attackDelta: number; defenseDelta: number; hpDelta: number },
  { attackDelta: number; defenseDelta: number; hpDelta: number },
]> = {
  ground: [
    { attackDelta: 3, defenseDelta: -1, hpDelta:  0 },
    { attackDelta: -1, defenseDelta: 4, hpDelta:  1 },
    { attackDelta: 1,  defenseDelta: 1, hpDelta:  2 },
  ],
  siege: [
    { attackDelta: 5, defenseDelta: -2, hpDelta:  0 },
    { attackDelta: -1, defenseDelta: 3, hpDelta:  2 },
    { attackDelta: 2,  defenseDelta: 1, hpDelta:  1 },
  ],
  air: [
    { attackDelta: 4, defenseDelta: -1, hpDelta: -1 },
    { attackDelta: -1, defenseDelta: 3, hpDelta:  2 },
    { attackDelta: 2,  defenseDelta: 1, hpDelta:  1 },
  ],
};

function makeUpgradesFor(unit: UnitDefinition): UpgradeDefinition[] {
  const names = NAMES[unit.caste][unit.type];
  const descs = DESCRIPTIONS[unit.caste][unit.type];
  const deltas = OPTION_DELTAS_BY_TYPE[unit.type];
  return ([1, 2, 3] as const).map((opt) => {
    const idx = opt - 1;
    return {
      id: `${unit.id}-upgrade-${opt}`,
      caste: unit.caste,
      targetKind: "unit" as const,
      targetId: unit.id,
      name: names[idx],
      description: descs[idx],
      effects: deltas[idx],
      optionIndex: opt,
    };
  });
}

// ─── Air-only "Intel" 4th upgrade option ───────────────────────────────
// Each caste's air unit gets a passive scouting upgrade that fires during
// the player's own attacks. The upgrade carries no stat delta — its value
// is information. resolveAttack reads the intelPassive marker and emits
// extra fields into the CombatResult when conditions are met.

interface AirIntelEntry {
  caste: Caste;
  name: string;
  description: string;
  intelPassive: AirIntelPassive;
}

const AIR_INTEL_ENTRIES: readonly AirIntelEntry[] = [
  {
    caste: "white",
    name: "Hawk's Eye",
    description:
      "Outrunner hawks circle ahead of any tile your air strikes. When you commit at least one air unit, you see the tier of the defender's armed defense spell before the dice roll.",
    intelPassive: "white-hawks-eye",
  },
  {
    caste: "blue",
    name: "Sky Reader Network",
    description:
      "A web of patient eyes between stars. When your air outnumbers the defender's, the contents of the target tile's six neighbors are revealed before commit.",
    intelPassive: "blue-sky-reader",
  },
  {
    caste: "black",
    name: "Crowfeast",
    description:
      "Failed attacks leave bodies; bodies talk. If an attack with five or more air units is repelled, the defender's recruit queue is revealed for the next five turns.",
    intelPassive: "black-crowfeast",
  },
  {
    caste: "red",
    name: "Forge Scouts",
    description:
      "Founder-trained scouts read enemy lines for seams. When your air force matches or exceeds the defender's, you gain a +5% attack bonus and learn which unit type the defender is weakest against.",
    intelPassive: "red-forge-scouts",
  },
  {
    caste: "green",
    name: "Crow Network",
    description:
      "Crows roost where your air sleeps. While air units are stationed on a friendly tile, that tile's full one-ring supply network is permanently visible to you.",
    intelPassive: "green-crow-network",
  },
];

function makeAirIntelUpgradeFor(
  unit: UnitDefinition,
  entry: AirIntelEntry
): UpgradeDefinition {
  return {
    id: `${unit.id}-upgrade-4-intel`,
    caste: unit.caste,
    targetKind: "unit",
    targetId: unit.id,
    name: entry.name,
    description: entry.description,
    // Intel upgrades have no stat tweak — their value is information.
    effects: {},
    optionIndex: 4,
    intelPassive: entry.intelPassive,
  };
}

const AIR_INTEL_UPGRADES: UpgradeDefinition[] = UNIT_LIST.filter(
  (u) => u.type === "air"
).map((u) => {
  const entry = AIR_INTEL_ENTRIES.find((e) => e.caste === u.caste);
  if (!entry) {
    throw new Error(`No air-intel entry registered for caste ${u.caste}`);
  }
  return makeAirIntelUpgradeFor(u, entry);
});

export const UNIT_UPGRADES: UpgradeDefinition[] = [
  ...UNIT_LIST.flatMap(makeUpgradesFor),
  ...AIR_INTEL_UPGRADES,
];
