/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { CachedOwnerSummary } from "@/lib/game/local-map-cache";
import type { Caste, GamePlayer, MapTile } from "@/lib/game/types";

export interface PlayerResponseError {
  message?: string;
  code?: string;
}

export interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: PlayerResponseError | string;
}

export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
}

export interface MapMeResponse {
  success: boolean;
  myTiles?: MapTile[];
  borderTiles?: MapTile[];
  owners?: CachedOwnerSummary[];
  error?: PlayerResponseError | string;
}

export interface RecruitProgress {
  done: number;
  total: number;
  unitsBuilt: number;
  artifactsFound: number;
}
