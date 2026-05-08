/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, LandType } from "@/lib/game/types";

export const HEX_SIZE = 28;
export const SQRT3 = Math.sqrt(3);
export const VIEWPORT_PADDING = HEX_SIZE * 1.5;

// MIN_SCALE has to be small enough that fit-to-viewport for large worlds
// (1000+ tiles) doesn't get clamped. With scale 0.05, a 30k-pixel-wide
// kingdom still fits in the 1200-unit viewBox.
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 6;
// SVG viewBox is fixed; pan/zoom is applied via inner <g> transform. These
// constants drive the "fit to content" math when the user clicks recenter.
export const VIEWBOX_W = 1200;
export const VIEWBOX_H = 800;
// Leave a small breathing room around the fit so the outermost tiles aren't
// clipped at the edge.
export const FIT_MARGIN = 0.95;
export const ZOOM_STEP = 1.15;

export const LAND_FILTERS: Array<LandType | "all"> = [
  "all",
  "military",
  "food",
  "magic",
  "unassigned",
  "unrevealed",
];

export const TYPE_FILL: Record<LandType, string> = {
  unrevealed: "#262626",
  unassigned: "#525252",
  military: "#dc2626",
  food: "#16a34a",
  magic: "#2563eb",
};

export const TYPE_STROKE: Record<LandType, string> = {
  unrevealed: "#404040",
  unassigned: "#737373",
  military: "#fca5a5",
  food: "#86efac",
  magic: "#93c5fd",
};

export const TYPE_TEXT: Record<LandType, string> = {
  unrevealed: "#a3a3a3",
  unassigned: "#fafafa",
  military: "#fff",
  food: "#fff",
  magic: "#fff",
};

// Foreign-tile fill — high luminance so it pops against own tiles' saturated
// type fills and against the dark map background. The caste-colored border
// at width 3.5 carries the faction info; an inner colored dot retains type
// info ("that white-bordered tile is a military land").
export const FOREIGN_FILL = "#f8fafc";

// Caste-keyed border accent for foreign tiles. Picked to match the in-game
// palette (white = stone, blue = sky, black = bone, red = ember, green = moss).
export const CASTE_BORDER: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};
