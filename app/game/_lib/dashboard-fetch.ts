/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { User } from "firebase/auth";
import {
  loadCachedMap,
  saveCachedMap,
  type CachedMapView,
  type CachedOwnerSummary,
} from "@/lib/game/local-map-cache";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import type { Eligibility, OwnerSummary } from "./dashboard-types";

/** State setters the initial-load fetcher reaches back into. */
export interface FetchSetters {
  setPlayer: (p: GamePlayer | null) => void;
  setTiles: (t: MapTile[]) => void;
  setServerIsAdmin: (v: boolean) => void;
  setEligibility: (e: Eligibility | null) => void;
  setWorldTiles: (t: MapTile[]) => void;
  setWorldOwners: (m: Map<string, OwnerSummary>) => void;
  setError: (msg: string | null) => void;
  setLoading: (v: boolean) => void;
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  isAdmin?: boolean;
  error?: string;
}

interface MapMeResponse {
  success: boolean;
  myTiles?: MapTile[];
  borderTiles?: MapTile[];
  owners?: CachedOwnerSummary[];
  error?: string;
}

interface EligibilityResponse {
  success: boolean;
  githubLogin: string | null;
  mergedPrCountThisWeek: number;
  nextRolloverIso: string;
  windowStartIso: string;
  error?: { message?: string } | string;
}

/**
 * Initial-load fetcher: pulls the player, eligibility, and (from cache
 * or fresh) the personal map view. Hand-runs once on mount and again
 * after `createPlayer` succeeds. Idempotent.
 */
export async function fetchInitialData(
  user: User,
  set: FetchSetters
): Promise<void> {
  set.setError(null);
  set.setLoading(true);
  try {
    const token = await user.getIdToken();
    const [playerRes, elgRes] = await Promise.all([
      fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/game/eligibility", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const data = (await playerRes.json()) as PlayerResponse;
    if (!data.success) throw new Error(data.error ?? "Failed to load player");
    set.setPlayer(data.player);
    set.setTiles(data.tiles ?? []);
    set.setServerIsAdmin(Boolean(data.isAdmin));

    const elgData = (await elgRes.json()) as EligibilityResponse;
    if (elgData.success) {
      set.setEligibility({
        githubLogin: elgData.githubLogin,
        mergedPrCountThisWeek: elgData.mergedPrCountThisWeek,
        nextRolloverIso: elgData.nextRolloverIso,
      });
    }

    // Map data — cache is source of truth. If absent, fetch /map/me
    // once. The dashboard only needs the border ring + owner summaries
    // to compute the threat card.
    const cached = loadCachedMap(user.uid);
    if (cached) {
      set.setWorldTiles(cached.borderTiles);
      set.setWorldOwners(new Map(cached.owners.map((o) => [o.userId, o])));
    } else {
      const mapRes = await fetch("/api/game/map/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mapData = (await mapRes.json()) as MapMeResponse;
      if (mapData.success) {
        const view: CachedMapView = {
          myTiles: mapData.myTiles ?? [],
          borderTiles: mapData.borderTiles ?? [],
          owners: mapData.owners ?? [],
          lastFetchedAt: Date.now(),
        };
        saveCachedMap(user.uid, view);
        set.setWorldTiles(view.borderTiles);
        set.setWorldOwners(new Map(view.owners.map((o) => [o.userId, o])));
      }
    }
  } catch (e) {
    set.setError(e instanceof Error ? e.message : "Failed to load player");
  } finally {
    set.setLoading(false);
  }
}
