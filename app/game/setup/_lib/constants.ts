/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, LandType } from "@/lib/game/types";

export const CASTES: Caste[] = ["white", "blue", "black", "red", "green"];

export const DISTRIBUTABLE: LandType[] = ["military", "food", "magic"];

// Caste swatch + tagline shown on the caste-pick card. The longer lore
// paragraph lives on `CasteProfile.lore` in lib/game/content/castes.ts so
// it sits next to the mechanical caste data (and renders via CatalogLore
// like every other catalog entry). Edit lore there; edit swatch/tagline
// here. Keep tone aligned with docs/generals/LORE.md.
export const CASTE_PRESENTATION: Record<
  Caste,
  { swatch: string; tagline: string }
> = {
  white: {
    swatch: "#e5e7eb",
    tagline: "Light · order · the long defense",
  },
  blue: {
    swatch: "#60a5fa",
    tagline: "Water · sky · the patient tide",
  },
  black: {
    swatch: "#a78bfa",
    tagline: "Death · blood · the cost paid forward",
  },
  red: {
    swatch: "#f87171",
    tagline: "Fire · forge · the short hot sentence",
  },
  green: {
    swatch: "#4ade80",
    tagline: "Wood · growth · the held line",
  },
};

export const RARITY_COLORS: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};
