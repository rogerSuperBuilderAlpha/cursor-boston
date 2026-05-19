/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Visibility filter for the v2 Heroes API. Server-side ONLY — clients
 * never compute "should I see this location"; the read endpoints apply
 * `applyHeroVisibility` / `applyEventVisibility` before returning data.
 *
 * Visibility rules (per the v2 plan):
 *
 *   LIVING hero:
 *     - identity (name/class/specialty/caste/alive flag, currentOwnerId)
 *       is public to all authenticated users
 *     - currentTileId + stamina: visible only to the current owner OR to
 *       a viewer whose kingdom has a tile adjacent to the hero's tile
 *     - events: visible only when `event.ownerIdAtTime === viewerId`
 *       (i.e. events from the viewer's tenure as owner; past owners
 *       see their own slice, current owner sees post-defection slice)
 *
 *   DECEASED OR PAST-SEASON hero:
 *     - everything is public — location, stamina (=0), all events
 *       regardless of viewer or tenure. The hero is lore now.
 */

import type { Firestore } from "firebase-admin/firestore";
import { HERO_BACKSTORY_IDS } from "./content/hero-backstories/_index";
import type {
  GameHeroDoc,
  GameHeroEvent,
  GameTile,
  SafeHeroSummary,
} from "./types";
import { neighborTileIds } from "./world-gen";

/** A deceased hero's history + location is fully public. Past-season
 *  heroes (in limbo, awaiting resurrection) are also treated as fully
 *  public — they're between worlds, no longer strategic. */
export function isHeroFullyPublic(hero: Pick<GameHeroDoc, "isDeceased" | "awaitingResurrection">): boolean {
  return hero.isDeceased || hero.awaitingResurrection;
}

/**
 * Builds the set of tile ids that are adjacent to ANY of the viewer's
 * owned tiles. Adjacency-gated visibility uses set-membership lookups
 * against this set so we don't recompute neighbors per-hero.
 *
 * Returns an empty set for viewers who own no tiles (newcomers).
 */
export async function computeViewerNeighborTileSet(
  db: Firestore,
  viewerId: string
): Promise<ReadonlySet<string>> {
  const snap = await db
    .collection("game_tiles")
    .where("ownerId", "==", viewerId)
    .select("q", "r")
    .get();
  const set = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as { q?: number; r?: number };
    if (typeof data.q !== "number" || typeof data.r !== "number") continue;
    for (const tid of neighborTileIds(data.q, data.r)) {
      set.add(tid);
    }
    // Include the viewer's own tiles too — a hero on your own tile is
    // trivially visible, and it spares an `|| isMine` check downstream.
    set.add(`${data.q}_${data.r}`);
  }
  return set;
}

/**
 * Project a `GameHeroDoc` down to the safe shape returned by the API.
 * Hides `currentTileId` and `stamina` when the viewer isn't entitled
 * to see them. Sets `hasBackstory` from the generated content index.
 */
export function applyHeroVisibility(
  hero: GameHeroDoc,
  viewerId: string,
  viewerNeighborSet: ReadonlySet<string>
): SafeHeroSummary {
  const fullyPublic = isHeroFullyPublic(hero);
  const isMine = hero.currentOwnerId === viewerId;
  const isAdjacent =
    hero.currentTileId != null && viewerNeighborSet.has(hero.currentTileId);
  const locationVisible = fullyPublic || isMine || isAdjacent;

  const base: SafeHeroSummary = {
    id: hero.id,
    name: hero.name,
    class: hero.class,
    specialty: hero.specialty,
    caste: hero.caste,
    currentOwnerId: hero.currentOwnerId,
    isDeceased: hero.isDeceased,
    awaitingResurrection: hero.awaitingResurrection,
    emergedSeasonNumber: hero.emergedSeasonNumber,
    hasBackstory: HERO_BACKSTORY_IDS.has(hero.id),
  };
  if (locationVisible) {
    if (hero.currentTileId) base.currentTileId = hero.currentTileId;
    base.stamina = hero.stamina;
    base.staminaMax = hero.staminaMax;
  }
  // Deceased: also surface the deceasedTileId for "fell at {tile}" copy.
  if (fullyPublic && hero.deceasedTileId) {
    base.deceasedTileId = hero.deceasedTileId;
  }
  return base;
}

/**
 * Returns true if the viewer is allowed to see `event` on the given
 * hero. For deceased/past-season heroes, all events are public. For
 * living heroes, events belong to the tenure of `ownerIdAtTime` and are
 * only visible to that owner (covers both current and past owners).
 */
export function applyEventVisibility(
  event: Pick<GameHeroEvent, "ownerIdAtTime">,
  viewerId: string,
  isHeroFullyPublicFlag: boolean
): boolean {
  if (isHeroFullyPublicFlag) return true;
  return event.ownerIdAtTime === viewerId;
}

/** Reads the viewer's owned tiles directly (used by callers that want
 *  to skip the bigger neighbor query — e.g. when filtering My Heroes
 *  by `currentOwnerId == viewerId` only). */
export async function computeViewerOwnedTileIds(
  db: Firestore,
  viewerId: string
): Promise<ReadonlySet<string>> {
  const snap = await db
    .collection("game_tiles")
    .where("ownerId", "==", viewerId)
    .select("tileId")
    .get();
  const set = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data() as Pick<GameTile, "tileId">;
    if (data.tileId) set.add(data.tileId);
  }
  return set;
}
