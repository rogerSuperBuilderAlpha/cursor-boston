/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition } from "../../types";

export const COMMON_ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "common-rusted-spearhead",
    name: "Rusted Spearhead",
    rarity: "common",
    type: "offense",
    baseStrength: 35,
    description: "A pitted spearhead that still carries the heat of an old war.",
    flavorOnFind:
      "Half-buried in roots, the spearhead almost looks ordinary — until you brush off the rust and feel the haft warm in your hand.",
  },
  {
    id: "common-bronze-buckler",
    name: "Bronze Buckler",
    rarity: "common",
    type: "defense",
    baseStrength: 40,
    description: "A small, dented shield. Heavier than it looks.",
    flavorOnFind:
      "It was being used as a roof tile by a goatherd. He trades it for a sack of grain and seems pleased with the bargain.",
  },
  {
    id: "common-fieldstone-charm",
    name: "Fieldstone Charm",
    rarity: "common",
    type: "production",
    baseStrength: 30,
    description: "A river-smoothed stone with three runes scratched into it.",
    flavorOnFind:
      "A child presses it into your hand and runs off without a word. The runes glow faintly when held to your chest.",
  },
  {
    id: "common-tinkers-compass",
    name: "Tinker's Compass",
    rarity: "common",
    type: "utility",
    baseStrength: 25,
    description: "A brass compass whose needle never quite points north.",
    flavorOnFind:
      "It points instead toward whatever you most want — useful, if you can be honest with yourself about what that is.",
  },
  {
    id: "common-ember-flask",
    name: "Ember Flask",
    rarity: "common",
    type: "offense",
    baseStrength: 38,
    description: "A clay flask with a single coal that refuses to die.",
    flavorOnFind:
      "The coal pulses like a slow heartbeat. The flask is warm to the touch even on a cold morning.",
  },
  {
    id: "common-thornweave-cloak",
    name: "Thornweave Cloak",
    rarity: "common",
    type: "defense",
    baseStrength: 35,
    description: "A cloak of woven thornvine that bites those who grab at it.",
    flavorOnFind:
      "It hangs from a low branch, perfectly preserved, as if waiting. The thorns part politely as you lift it down.",
  },
  {
    id: "common-millers-token",
    name: "Miller's Token",
    rarity: "common",
    type: "production",
    baseStrength: 32,
    description: "A wooden disc stamped with a wheat sheaf.",
    flavorOnFind:
      "An old miller swears it doubled his harvest one year. He'll part with it for a story and a meal.",
  },
  {
    id: "common-skirmishers-horn",
    name: "Skirmisher's Horn",
    rarity: "common",
    type: "utility",
    baseStrength: 28,
    description: "A small horn carved from antler, blackened with use.",
    flavorOnFind:
      "It rests on the chest of a skeleton at the bottom of a shallow pit. The skeleton seems to have died smiling.",
  },
  {
    id: "common-soldiers-rations",
    name: "Soldier's Rations",
    rarity: "common",
    type: "production",
    baseStrength: 30,
    description: "A waxed-canvas pack of hardtack, dried meat, and grain.",
    flavorOnFind:
      "Stamped with a regimental crest you don't recognize. The meat is somehow still good.",
  },
  {
    id: "common-arrowmakers-bundle",
    name: "Arrowmaker's Bundle",
    rarity: "common",
    type: "offense",
    baseStrength: 36,
    description: "Twenty fletched arrows, perfectly balanced, perfectly straight.",
    flavorOnFind:
      "Wrapped in oilskin and hidden in a hollow log. Whoever stashed them never came back.",
  },
  {
    id: "common-wardens-lantern",
    name: "Warden's Lantern",
    rarity: "common",
    type: "defense",
    baseStrength: 33,
    description: "A small iron lantern that burns without fuel.",
    flavorOnFind:
      "It was hanging from a lone post in a clearing. The flame inside flickers in time with your steps.",
  },
  {
    id: "common-veterans-coin",
    name: "Veteran's Coin",
    rarity: "common",
    type: "utility",
    baseStrength: 27,
    description: "A worn copper coin with a sword crossed by a sheaf of wheat.",
    flavorOnFind:
      "Tossed at your feet by a one-eyed traveler who simply nods and walks on.",
  },
  {
    id: "common-watchmans-whistle",
    name: "Watchman's Whistle",
    rarity: "common",
    type: "defense",
    baseStrength: 32,
    description:
      "A bone whistle whose note carries a mile and turns three corners.",
    flavorOnFind:
      "It hangs from a leather cord on a nail in an empty guardhouse. The cord is dry but the nail is fresh.",
  },
  {
    id: "common-mendicants-mantle",
    name: "Mendicant's Mantle",
    rarity: "common",
    type: "utility",
    baseStrength: 26,
    description: "A patched cloak that makes the wearer easier to overlook.",
    flavorOnFind:
      "A wandering monk leaves it folded on a roadside bench. He is not there to take it back.",
  },
  {
    id: "common-quenchers-flask",
    name: "Quencher's Flask",
    rarity: "common",
    type: "production",
    baseStrength: 31,
    description:
      "A leather flask that fills itself with cold water by morning, every morning.",
    flavorOnFind:
      "An old beekeeper presses it into your hand without explanation and asks no payment.",
  },
  {
    id: "common-chipped-warhammer",
    name: "Chipped Warhammer",
    rarity: "common",
    type: "offense",
    baseStrength: 37,
    description: "An old hammer with a notch in the head that hits truer than it looks.",
    flavorOnFind:
      "It leans against a doorpost in an abandoned smithy, the haft still warm where someone gripped it last.",
  },
  {
    id: "common-strawmans-cloak",
    name: "Strawman's Cloak",
    rarity: "common",
    type: "defense",
    baseStrength: 34,
    description: "A scarecrow's cloak, threadbare but oddly bullet-shy.",
    flavorOnFind:
      "Hanging from a pole in an empty field. The crows give it a wide berth.",
  },
  {
    id: "common-whispered-map",
    name: "Whispered Map",
    rarity: "common",
    type: "intel",
    intelDepth: "tile",
    baseStrength: 0,
    description:
      "A square of cured leather that re-draws itself when held over a place. Reveals the units, armed spell, and land type on a single enemy tile.",
    flavorOnFind:
      "It rolls open in your hand without prompting. The lines of ink seem damp; they dry into the shape of a place you have never been.",
  },
];
