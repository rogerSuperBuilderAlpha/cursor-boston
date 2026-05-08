/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCachedMap,
  saveCachedMap,
  type CachedMapView,
} from "@/lib/game/local-map-cache";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import type { MapMeResponse, OwnerSummary, PlayerResponse } from "./types";

/**
 * Server state for the spells page: player + owned tiles, plus a slice
 * of the local-map cache (border tiles + owner summaries) used by the
 * threat ranker. Spells never mutate world tiles or owner summaries —
 * only the casting player and (for arm) the targeted tile(s) — so we
 * never refetch the world here.
 */
export function useSpellsData() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  // Border-only enemy tiles (sufficient for the threat calc — adjacency is
  // all that matters). Hydrated from cache on mount, kept fresh by action
  // handlers across the game pages.
  const [borderTiles, setBorderTiles] = useState<MapTile[]>([]);
  const [owners, setOwners] = useState<Map<string, OwnerSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch only the player object; tile + owner data lives in the local-map
  // cache (mutated in-place by action handlers, refreshed manually on the
  // map page).
  const refreshPlayer = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load";
        throw new Error(msg);
      }
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Cold-load: hydrate map data from the localStorage cache; if absent,
  // fetch /api/game/map/me once. After that, action responses keep the
  // cache (and this page's state) up to date — no automatic refetches.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const cached = loadCachedMap(user.uid);
      if (cached && !cancelled) {
        setBorderTiles(cached.borderTiles);
        setOwners(new Map(cached.owners.map((o) => [o.userId, o])));
      } else {
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/game/map/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = (await res.json()) as MapMeResponse;
          if (!cancelled && data.success) {
            const view: CachedMapView = {
              myTiles: data.myTiles ?? [],
              borderTiles: data.borderTiles ?? [],
              owners: data.owners ?? [],
              lastFetchedAt: Date.now(),
            };
            saveCachedMap(user.uid, view);
            setBorderTiles(view.borderTiles);
            setOwners(new Map(view.owners.map((o) => [o.userId, o])));
          }
        } catch {
          /* surfaced via the player fetch error path if both fail */
        }
      }
      if (!cancelled) await refreshPlayer();
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, refreshPlayer]);

  return {
    user,
    authLoading,
    player,
    setPlayer,
    tiles,
    setTiles,
    borderTiles,
    owners,
    loading,
    error,
    setError,
  };
}

export type SpellsData = ReturnType<typeof useSpellsData>;
