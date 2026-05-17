/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Derived player titles. Computed at read time from fields already on
 * `GamePlayer` (no separate "earned titles" doc) so titles stay in sync
 * automatically — if a player's tilesHeld drops below the threshold for
 * a tiered title, the lower tier is what renders next read.
 *
 * Adding a new title: extend `derivePlayerTitles` with a check against
 * the player doc. Tier thresholds live inline. Keep title labels short
 * (≤24 chars) so they fit beside the player's display name in chat /
 * leaderboard rows.
 */

import type { GamePlayer, PlayerTitle } from "./types";

const TILES_TIERS: { id: string; min: number; label: string; description: string }[] = [
  {
    id: "tile-baron-1k",
    min: 1000,
    label: "Tile Baron",
    description: "Held 1,000+ tiles at peak.",
  },
  {
    id: "tile-lord-500",
    min: 500,
    label: "Tile Lord",
    description: "Held 500+ tiles at peak.",
  },
  {
    id: "tile-knight-100",
    min: 100,
    label: "Tile Knight",
    description: "Held 100+ tiles at peak.",
  },
];

const ATTACKS_WON_TIERS: { id: string; min: number; label: string; description: string }[] = [
  {
    id: "warlord-500",
    min: 500,
    label: "Warlord",
    description: "Won 500+ attacks.",
  },
  {
    id: "raider-100",
    min: 100,
    label: "Raider",
    description: "Won 100+ attacks.",
  },
  {
    id: "first-blood",
    min: 1,
    label: "First Blood",
    description: "Won your first attack.",
  },
];

const TURNS_SPENT_TIERS: { id: string; min: number; label: string; description: string }[] = [
  {
    id: "veteran-10k",
    min: 10_000,
    label: "Veteran General",
    description: "Spent 10,000+ turns in service of the kingdom.",
  },
  {
    id: "campaigner-1k",
    min: 1_000,
    label: "Campaigner",
    description: "Spent 1,000+ turns commanding troops.",
  },
];

function pickTopTier(
  tiers: { id: string; min: number; label: string; description: string }[],
  value: number
): PlayerTitle | null {
  for (const tier of tiers) {
    if (value >= tier.min) {
      return { id: tier.id, label: tier.label, description: tier.description };
    }
  }
  return null;
}

/**
 * Derive the list of titles a player has earned. Returns an ordered
 * array — most prestigious titles first. Empty array for new players
 * with no milestones yet. Pure function: no Firestore reads.
 */
export function derivePlayerTitles(player: GamePlayer): PlayerTitle[] {
  const titles: PlayerTitle[] = [];

  const tilesHeld = player.stats?.tilesHeld ?? 0;
  const tilesTitle = pickTopTier(TILES_TIERS, tilesHeld);
  if (tilesTitle) titles.push(tilesTitle);

  const attacksWon = player.stats?.attacksWon ?? 0;
  const attacksTitle = pickTopTier(ATTACKS_WON_TIERS, attacksWon);
  if (attacksTitle) titles.push(attacksTitle);

  const turnsSpent = player.turnsSpentTotal ?? 0;
  const turnsTitle = pickTopTier(TURNS_SPENT_TIERS, turnsSpent);
  if (turnsTitle) titles.push(turnsTitle);

  const sealsBroken = player.armageddonSealsBroken ?? 0;
  if (sealsBroken >= 1) {
    titles.push({
      id: "sealbreaker",
      label: sealsBroken >= 3 ? "Apocalypse Bringer" : "Sealbreaker",
      description:
        sealsBroken >= 3
          ? `Broke ${sealsBroken} Armageddon seals.`
          : `Broke ${sealsBroken} Armageddon seal${sealsBroken === 1 ? "" : "s"}.`,
    });
  }

  if (player.heroCount && player.heroCount >= 1) {
    titles.push({
      id: "hero-commander",
      label: player.heroCount >= 5 ? "Hero Marshal" : "Hero Commander",
      description:
        player.heroCount >= 5
          ? `Currently commands ${player.heroCount} heroes.`
          : `Currently commands ${player.heroCount} hero${player.heroCount === 1 ? "" : "es"}.`,
    });
  }

  if ((player.casteChangesUsed ?? 0) >= 1) {
    titles.push({
      id: "renegade",
      label: "Renegade",
      description: "Switched castes after reaching 1,000 tiles.",
    });
  }

  const prophecyFulfilled = player.prophecyFulfilledCount ?? 0;
  if (prophecyFulfilled >= 1) {
    titles.push({
      id: "seer",
      label: prophecyFulfilled >= 3 ? "Oracle" : "Seer",
      description: `Filed ${prophecyFulfilled} prophecy${
        prophecyFulfilled === 1 ? "" : " (ies)"
      } that came true.`,
    });
  }

  return titles;
}
