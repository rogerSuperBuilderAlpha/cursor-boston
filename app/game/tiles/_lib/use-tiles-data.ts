/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCachedMap,
  saveCachedMap,
  type CachedMapView,
} from "@/lib/game/local-map-cache";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import type {
  MapMeResponse,
  OwnerSummary,
  PlayerResponse,
  ViewMode,
  WorldResponse,
} from "./types";

/**
 * Owns all server-state for the tiles map page: player record, the
 * cached personal-view (myTiles + borderTiles + owners) backed by
 * localStorage, and a one-shot world snapshot fetched on demand.
 *
 * `mode` determines whether `tiles` and `ownersById` derive from the
 * personal cache or the world snapshot — components downstream just
 * read those memos and don't care which mode is active.
 */
export function useTilesData() {
  const { user, loading: authLoading } = useAuth();
  // Cached personal view: { myTiles, borderTiles, owners, lastFetchedAt }.
  // Source of truth in `personal` mode; persisted to localStorage and
  // mutated by action responses across the game pages.
  const [cachedView, setCachedView] = useState<CachedMapView | null>(null);
  // One-shot whole-world snapshot for the 🌐 button. Not persisted — every
  // click re-fetches.
  const [worldView, setWorldView] = useState<{
    tiles: MapTile[];
    owners: OwnerSummary[];
  } | null>(null);
  const [mode, setMode] = useState<ViewMode>("personal");
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Surfaced fetch error for the world snapshot. Shown inline so a failed
  // toggle to 🌐 mode doesn't silently fall back to the personal view.
  const [worldError, setWorldError] = useState<string | null>(null);
  // Re-renders the refresh button's countdown text every 30s while it's
  // gated. Cheap — only state-bumps when the cache has a recent fetch.
  const [, forceTick] = useState(0);

  const fetchPlayer = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (data.success) setPlayer(data.player);
    } catch {
      /* ignore */
    }
  }, [user]);

  // Full personal-map fetch. Resets the rate-limit clock. Called on first
  // visit (no cache) and when the user clicks the refresh button.
  const refreshPersonalMap = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/map/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as MapMeResponse;
      if (data.success) {
        const view: CachedMapView = {
          myTiles: data.myTiles ?? [],
          borderTiles: data.borderTiles ?? [],
          owners: data.owners ?? [],
          lastFetchedAt: Date.now(),
        };
        saveCachedMap(user.uid, view);
        setCachedView(view);
      }
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Cold load: hydrate from localStorage if present, otherwise fetch
  // fresh. The cache stays valid until the user clicks refresh — no auto-
  // expiry. Action handlers across the game pages keep it incrementally
  // up-to-date.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      const cached = loadCachedMap(user.uid);
      if (cached) {
        setCachedView(cached);
      }
      await fetchPlayer();
      if (cancelled) return;
      if (!cached) {
        await refreshPersonalMap();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, fetchPlayer, refreshPersonalMap]);

  // Tick the refresh-countdown UI once a minute so the disabled button's
  // remaining-time text doesn't go stale.
  useEffect(() => {
    if (!cachedView) return;
    const id = setInterval(() => forceTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, [cachedView]);

  // Whole-world snapshot for the 🌐 button. Lazy: only runs when the user
  // explicitly switches modes. Surfaces fetch errors inline so a failed
  // request doesn't silently look like an empty world.
  const fetchWorldOnce = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setWorldError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/world", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`World fetch failed: HTTP ${res.status}`);
      }
      const data = (await res.json()) as WorldResponse;
      if (!data.success) {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : (data.error as { message?: string } | undefined)?.message;
        throw new Error(errMsg ?? "World fetch failed");
      }
      const tiles = data.tiles ?? [];
      const owners = data.owners ?? [];
      if (tiles.length === 0) {
        throw new Error("World fetch returned no tiles");
      }
      setWorldView({ tiles, owners });
    } catch (e) {
      setWorldError(e instanceof Error ? e.message : "World fetch failed");
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Derive the tiles + owners we render from the active mode. In `personal`
  // mode we union myTiles + borderTiles from the cache; in `world` mode we
  // render the one-shot world snapshot.
  const tiles: MapTile[] = useMemo(
    () =>
      mode === "world" && worldView
        ? worldView.tiles
        : cachedView
          ? [...cachedView.myTiles, ...cachedView.borderTiles]
          : [],
    [mode, worldView, cachedView]
  );

  const ownersById: Map<string, OwnerSummary> = useMemo(() => {
    const ownersList =
      mode === "world" && worldView
        ? worldView.owners
        : cachedView?.owners ?? [];
    const m = new Map<string, OwnerSummary>();
    for (const o of ownersList) m.set(o.userId, o as OwnerSummary);
    return m;
  }, [mode, worldView, cachedView]);

  return {
    user,
    authLoading,
    player,
    setPlayer,
    cachedView,
    setCachedView,
    worldView,
    mode,
    setMode,
    loading,
    refreshing,
    worldError,
    tiles,
    ownersById,
    refreshPersonalMap,
    fetchWorldOnce,
  };
}

export type TilesData = ReturnType<typeof useTilesData>;
