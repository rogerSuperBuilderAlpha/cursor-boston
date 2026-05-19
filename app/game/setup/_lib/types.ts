/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { GamePlayer, LandType, MapTile } from "@/lib/game/types";

export interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: string;
}

export interface RevealLog {
  tileId: string;
  type: LandType;
  at: number; // Date.now()
  summary?: string;
  narrative?: string[];
  artifactFound?: {
    definitionId: string;
    name: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    type: "offense" | "defense" | "production" | "utility";
  };
}

export interface BatchProgress {
  done: number;
  total: number;
}
