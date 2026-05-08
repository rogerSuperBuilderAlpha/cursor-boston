/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, LandType } from "@/lib/game/types";

export const CASTES: Caste[] = ["white", "blue", "black", "red", "green"];

export const DISTRIBUTABLE: LandType[] = ["military", "food", "magic"];

// Caste accent + lore text shown on the caste-pick card. Lore is intentionally
// short (1 paragraph), matches the in-game restraint, and avoids real-world
// references. Edit here when retuning caste identity; keep tone aligned with
// docs/generals/LORE.md.
export const CASTE_PRESENTATION: Record<
  Caste,
  { swatch: string; tagline: string; lore: string }
> = {
  white: {
    swatch: "#e5e7eb",
    tagline: "Light · order · the long defense",
    lore:
      "White moves slowly and remembers everything. Their banners are old, their drills older, and their pikemen will hold a road for as many days as the road needs holding. Sanctuaries glow on the hilltops at dusk; the priests do not explain how.",
  },
  blue: {
    swatch: "#60a5fa",
    tagline: "Water · sky · the patient tide",
    lore:
      "Blue plays the long economy. Their captains are astronomers, their air corps moves on currents no scout can chart, and their production magic refills granaries through a winter no one can quite remember surviving. They win wars that began three seasons ago.",
  },
  black: {
    swatch: "#a78bfa",
    tagline: "Death · blood · the cost paid forward",
    lore:
      "Black armies are quiet at the edges and loud in the middle. Their reavers are bone-armored and tireless; their blood-tide spells fall on a battlefield like a price already settled. They take towns by walking through them. They keep no prisoners they can spare.",
  },
  red: {
    swatch: "#f87171",
    tagline: "Fire · forge · the short hot sentence",
    lore:
      "Red wars are decided in three days or three minutes. Their siege foundries turn out trebuchets that smell of pitch and bone-glue; their pyre-mortars throw heat that cracks stone. Their defenses are thin because their generals do not intend to need them.",
  },
  green: {
    swatch: "#4ade80",
    tagline: "Wood · growth · the held line",
    lore:
      "Green takes ground and keeps it. Their wardens build deeper than other castes, and their tiles hold more soldiers per acre because the soldiers eat from the land they stand on. Their air is weak; they don't intend to leave the ground.",
  },
};

export const RARITY_COLORS: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};
