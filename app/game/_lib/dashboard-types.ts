/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste } from "@/lib/game/types";

/** Owner identity attached to enemy-bordering tiles in the world view. */
export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
}

/** PR-driven turn-rollover eligibility shown in the banner. */
export interface Eligibility {
  githubLogin: string | null;
  mergedPrCountThisWeek: number;
  nextRolloverIso: string;
}

/** Effective shield state derived from `player.shieldUntil` + spend cap. */
export interface ShieldStatus {
  shielded: boolean;
  daysLeft: number;
  turnsLeft: number;
  /** Which condition is keeping the shield up — drives UI copy. */
  bottleneck: "time" | "turns" | "both" | "none";
}

/** Bordering-enemy summary for the threat card. */
export interface ThreatSummary {
  unshieldedNeighbors: number;
  totalForeignNeighbors: number;
  /** Names of unshielded foreign generals bordering you, deduped, up to 3. */
  topNeighborNames: string[];
}

/** Land-type counts for the lands card + recommendation engine. */
export interface LandCounts {
  military: number;
  food: number;
  magic: number;
  unassigned: number;
  total: number;
}

/** Aggregate unit totals across all owned tiles. */
export interface ArmyTotals {
  ground: number;
  siege: number;
  air: number;
  total: number;
}

/** Per-action progress (used by frontier explore + bulk distribute). */
export interface ActionProgress {
  done: number;
  total: number;
  artifactsFound: number;
}

/** Slim leaderboard row used by the SealsPanel contender list. Just enough
 *  to render rank + name + caste + tile count; full leaderboard lives on
 *  /game/leaderboard. */
export interface TopLeaderRow {
  userId: string;
  displayName: string;
  caste: Caste | null;
  tilesHeld: number;
}

/** Output of `recommendNext()` — the "what should I do" callout. */
export interface Recommendation {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  /** If set, scrolls to an inline widget on the dashboard. */
  scrollTo?: string;
  tone: "primary" | "secondary";
}
