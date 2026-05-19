/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, GamePlayer, MapTile } from "@/lib/game/types";
import type { CachedOwnerSummary } from "@/lib/game/local-map-cache";

export interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: string;
}

export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
  /** True for seeded NPCs; false for real humans. Used by the audience
   *  filter on the world map. */
  isNpc?: boolean;
}

export type AudienceFilter = "all" | "humans" | "npcs";

export interface MapMeResponse {
  success: boolean;
  myTiles?: MapTile[];
  borderTiles?: MapTile[];
  owners?: CachedOwnerSummary[];
  error?: string;
}

export interface WorldResponse {
  success: boolean;
  tiles?: MapTile[];
  owners?: OwnerSummary[];
  error?: string | { message?: string };
}

export type ScopeFilter = "everyone" | "mine" | "foreign";
export type ViewMode = "personal" | "world";
