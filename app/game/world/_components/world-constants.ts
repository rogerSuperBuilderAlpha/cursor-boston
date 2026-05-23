/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, LandType } from "@/lib/game/types";

// Caste colors picked to read clearly on a dark scene and match the
// existing 2D map's caste palette (loosely — the 2D map uses muted
// fills via Tailwind classes; here we use hex values direct from
// three.js material setters).
export const CASTE_COLOR_HEX: Record<Caste, number> = {
  black: 0x4b3f5c,
  red: 0xd0463a,
  white: 0xe6e6e6,
  green: 0x4caf50,
  blue: 0x4f8cf6,
};

export const CASTE_LABEL: Record<Caste, string> = {
  black: "Black",
  red: "Red",
  white: "White",
  green: "Green",
  blue: "Blue",
};

// Color for tiles with no caste / no owner. Slightly desaturated so they
// recede behind the caste-held land.
export const UNOWNED_COLOR_HEX = 0x6b6b6b;

export const LAND_TYPE_LABEL: Record<LandType, string> = {
  unrevealed: "Unrevealed",
  unassigned: "Unassigned",
  military: "Military",
  food: "Food",
  magic: "Magic",
};

// Sizes the renderer uses. Keeping a single source of truth here means
// the scene and the legend stay in lock-step.
export const HEX_RADIUS = 1.0;
// Visual gap between hex centers — slightly larger than the radius so
// neighbors don't overlap their roof prisms.
export const HEX_SPACING = 1.05;
