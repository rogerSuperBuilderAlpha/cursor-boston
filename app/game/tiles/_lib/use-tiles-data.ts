/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorldSnapshotListener } from "@/app/game/_lib/use-world-snapshot-listener";
import { neighborTileIds } from "@/lib/game/world-gen";
import {
  loadCachedMap,
  saveCachedMap,
  type CachedMapView,
  type CachedOwnerSummary,
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

  // Real-time push from `game_world_snapshots/latest`. The listener
  // auto-detaches when the tab is hidden or the user is idle for 5 min
  // (see use-world-snapshot-listener.ts) so a long-open background tab
  // doesn't keep billing reads for cron-rebuild deliveries.
  const live = useWorldSnapshotListener({ enabled: !!user });

  // When the listener delivers a fresh snapshot, refresh both the
  // personal cache (derived from the snapshot via the same logic the
  // server's deriveMyMapFromSnapshot uses) and the world view. Server
  // gating ensures the doc only changes when game state actually
  // changed, so each delivery is a meaningful update — no spurious
  // cache thrash.
  //
  // The setCachedView/setWorldView calls inside this effect are the
  // canonical "subscribe to external system, mirror into local state"
  // pattern from the React docs — the lint rule flags it conservatively
  // because it can't see past the upstream listener.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user) return;
    if (!live.snapshot) return;
    const snap = live.snapshot;

    // Personal-mode derivation: my tiles + the enemy ring touching my
    // borders + owner summaries for those enemies.
    const tilesById = new Map<string, MapTile>();
    for (const t of snap.tiles) tilesById.set(t.tileId, t);
    const myTiles = snap.tiles.filter((t) => t.ownerId === user.uid);
    const myIds = new Set(myTiles.map((t) => t.tileId));
    const borderTiles: MapTile[] = [];
    const enemyOwnerIds = new Set<string>();
    const seen = new Set<string>();
    for (const t of myTiles) {
      for (const nid of neighborTileIds(t.q, t.r)) {
        if (myIds.has(nid)) continue;
        if (seen.has(nid)) continue;
        seen.add(nid);
        const neighbor = tilesById.get(nid);
        if (!neighbor) continue;
        if (!neighbor.ownerId || neighbor.ownerId === user.uid) continue;
        borderTiles.push(neighbor);
        enemyOwnerIds.add(neighbor.ownerId);
      }
    }
    const cachedOwners: CachedOwnerSummary[] = [];
    for (const o of snap.owners) {
      if (enemyOwnerIds.has(o.userId)) {
        cachedOwners.push({
          userId: o.userId,
          displayName: o.displayName,
          caste: o.caste,
          shielded: o.shielded,
          isNpc: o.isNpc,
        });
      }
    }
    const view: CachedMapView = {
      myTiles,
      borderTiles,
      owners: cachedOwners,
      lastFetchedAt: Date.now(),
    };
    saveCachedMap(user.uid, view);
    setCachedView(view);

    // World view stays in sync too — when the user toggles to 🌐 it's
    // already ready, no extra HTTP fetch needed.
    setWorldView({
      tiles: snap.tiles,
      owners: snap.owners.map((o) => ({
        userId: o.userId,
        displayName: o.displayName,
        caste: o.caste,
        shielded: o.shielded,
        isNpc: o.isNpc,
      })),
    });
    // Listener supplied data; no need to leave the loading skeleton up.
    setLoading(false);
  }, [live.snapshot, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Whole-world snapshot for the 🌐 button. Lazy: only runs when the user
  // explicitly switches modes. Surfaces fetch errors inline so a failed
  // request doesn't silently look like an empty world.
  const fetchWorldOnce = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setWorldError(null);
    try {
      const token = await user.getIdToken();
      // Honor the route's Cache-Control (public, s-maxage=60). The world
      // snapshot is identical for every caller, so a CDN/browser hit is
      // exactly the same data — no reason to bypass cache here.
      const res = await fetch("/api/game/world", {
        headers: { Authorization: `Bearer ${token}` },
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
    liveConnected: live.connected,
  };
}

export type TilesData = ReturnType<typeof useTilesData>;
