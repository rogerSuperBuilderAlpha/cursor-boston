/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { mergeTiles as mergeTilesIntoCache } from "@/lib/game/local-map-cache";
import type {
  GameArtifact,
  GamePlayer,
  GameWorldMeta,
  LandType,
  MapTile,
  TurnReport,
  UnitStack,
  UnitType,
} from "@/lib/game/types";
import {
  adminGrant,
  armDefenseSpell,
  attack,
  bulkDistribute,
  castArmageddon,
  castIntelSpell,
  castSpell,
  createPlayer,
  distributeTile,
  farExpedition,
  flyover,
  frontierExplore,
  recruitUnits,
  setPlayerName,
  siege,
  spendArtifact,
  type DashboardMutators,
} from "./dashboard-actions";
import { fetchInitialData } from "./dashboard-fetch";
import type {
  ActionProgress,
  Eligibility,
  OwnerSummary,
  TopLeaderRow,
} from "./dashboard-types";

/**
 * Aggregates every server-state and action handler the dashboard needs.
 * The actual API calls live in `dashboard-actions.ts`; this hook owns
 * the React state shape and the initial-load effect.
 *
 * Returned object is consumed by `DashboardView` plus the gates in
 * `app/game/page.tsx`.
 */
export function useDashboardData() {
  const { user, userProfile, loading: authLoading } = useAuth();
  // Server fills this in from the player API response (token claims +
  // legacy email allowlist). Firestore profile is never written, so
  // userProfile.isAdmin alone isn't enough.
  const [serverIsAdmin, setServerIsAdmin] = useState(false);
  const isAdmin =
    serverIsAdmin ||
    Boolean((userProfile as { isAdmin?: boolean } | null)?.isAdmin);

  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [worldTiles, setWorldTiles] = useState<MapTile[]>([]);
  const [worldOwners, setWorldOwners] = useState<Map<string, OwnerSummary>>(
    new Map()
  );
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exploring, setExploring] = useState(false);
  const [exploreCount, setExploreCount] = useState(1);
  const [exploreProgress, setExploreProgress] =
    useState<ActionProgress | null>(null);

  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);

  const [distributing, setDistributing] = useState(false);
  const [distributeType, setDistributeType] = useState<LandType>("military");
  const [distributeCount, setDistributeCount] = useState(10);
  const [distributeProgress, setDistributeProgress] =
    useState<ActionProgress | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  // Inventory of unused artifacts. Loaded once on mount and patched in place
  // whenever an artifact is found (frontier explore reports) or used (artifact
  // use endpoint). Threats page + tile-detail page consume this directly so
  // every action button knows what's available without a refetch.
  const [artifacts, setArtifacts] = useState<GameArtifact[]>([]);

  // Global game-world singleton: season, seal count, armageddon state.
  // Fetched alongside player on mount, patched in place after the player
  // casts Armageddon, and refetched whenever the server returns a state
  // change (resolving, fresh season).
  const [worldMeta, setWorldMeta] = useState<GameWorldMeta | null>(null);

  // Top kingdoms by tilesHeld (NPCs included). Surfaced by the SealsPanel
  // to show who's approaching or past the Armageddon gate. Fetched once
  // on mount; refresh by calling fetchPlayer.
  const [topLeaders, setTopLeaders] = useState<TopLeaderRow[]>([]);

  /**
   * Patch the local owned-tile list AND the localStorage map cache so
   * downstream pages read the same data without an extra fetch.
   */
  const mergeOwnedTiles = useCallback(
    (updates: MapTile[]) => {
      if (updates.length === 0) return;
      setTiles((prev) => {
        const byId = new Map(prev.map((t) => [t.tileId, t] as const));
        for (const u of updates) byId.set(u.tileId, u);
        return Array.from(byId.values());
      });
      if (user) mergeTilesIntoCache(user.uid, updates);
    },
    [user]
  );

  /**
   * Patch the dashboard's worldTiles (border ring) state + the
   * localStorage cache. The cache lib auto-routes by ownerId, so we just
   * forward updates and update local state for non-self owners.
   */
  const mergeBorderTiles = useCallback(
    (updates: MapTile[]) => {
      if (updates.length === 0 || !user) return;
      const otherOwners = updates.filter((u) => u.ownerId && u.ownerId !== user.uid);
      if (otherOwners.length > 0) {
        setWorldTiles((prev) => {
          const byId = new Map(prev.map((t) => [t.tileId, t] as const));
          for (const u of otherOwners) byId.set(u.tileId, u);
          return Array.from(byId.values());
        });
      }
      mergeTilesIntoCache(user.uid, updates);
    },
    [user]
  );

  /**
   * Patch the artifacts inventory after a use (artifact.used flips true) or
   * a find (new artifact doc). Filters out used artifacts so callers always
   * see only the still-spendable inventory.
   */
  const mergeArtifacts = useCallback((updates: GameArtifact[]) => {
    if (updates.length === 0) return;
    setArtifacts((prev) => {
      const byId = new Map(prev.map((a) => [a.id, a] as const));
      for (const u of updates) byId.set(u.id, u);
      return Array.from(byId.values()).filter((a) => !a.used);
    });
  }, []);

  const mut: DashboardMutators = {
    setError,
    setPlayer,
    setRecentReports,
    mergeOwnedTiles,
    mergeBorderTiles,
    mergeArtifacts,
    setWorldMeta,
  };

  const fetchPlayer = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    await fetchInitialData(user, {
      setPlayer,
      setTiles,
      setServerIsAdmin,
      setEligibility,
      setWorldTiles,
      setWorldOwners,
      setArtifacts,
      setWorldMeta,
      setTopLeaders,
      setError,
      setLoading,
    });
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    fetchPlayer();
  }, [authLoading, fetchPlayer]);

  // ---------- Action handler bindings ----------

  const handleCreatePlayer = useCallback(
    async (displayName: string) => {
      if (!user) return;
      setCreating(true);
      try {
        await createPlayer(user, displayName, { setError }, fetchPlayer);
      } finally {
        setCreating(false);
      }
    },
    [user, fetchPlayer]
  );

  const handleSetName = useCallback(
    async (displayName: string) => {
      if (!user) return;
      await setPlayerName(user, displayName, { setError, setPlayer });
    },
    [user]
  );

  const handleFrontierExplore = useCallback(
    async (count: number) => {
      if (!user) return;
      setExploring(true);
      try {
        await frontierExplore(user, count, mut, setExploreProgress);
      } finally {
        setExploring(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user, mergeOwnedTiles]
  );

  const handleBulkDistribute = useCallback(
    async (
      targetType: LandType,
      count: number,
      sourceFilter: (t: MapTile) => boolean,
      sourceLabel: string
    ) => {
      if (!user) return;
      setDistributing(true);
      try {
        await bulkDistribute(
          user,
          { targetType, count, sourceFilter, sourceLabel, tiles },
          mut,
          setDistributeProgress
        );
      } finally {
        setDistributing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user, tiles, mergeOwnedTiles]
  );

  const handleAdminGrant = useCallback(async () => {
    if (!user) return;
    await adminGrant(user, { setError, setPlayer });
  }, [user]);

  const handleFarExpedition = useCallback(async () => {
    if (!user) return null;
    return farExpedition(user, mut);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
  }, [user, mergeOwnedTiles, mergeBorderTiles]);

  const handleCastIntelSpell = useCallback(
    async (spellId: string, targetTileId: string) => {
      if (!user) return null;
      return castIntelSpell(user, spellId, targetTileId, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleAttack = useCallback(
    async (args: {
      sourceTileId: string;
      targetTileId: string;
      units: UnitStack;
      offenseSpellId: string | null;
    }) => {
      if (!user) return null;
      return attack(user, args, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleRecruit = useCallback(
    async (tileId: string, unitType: UnitType) => {
      if (!user) return null;
      return recruitUnits(user, tileId, unitType, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleArmDefenseSpell = useCallback(
    async (tileId: string, spellId: string) => {
      if (!user) return null;
      return armDefenseSpell(user, tileId, spellId, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleDistributeTile = useCallback(
    async (tileId: string, type: LandType) => {
      if (!user) return null;
      return distributeTile(user, tileId, type, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleUseArtifact = useCallback(
    async (artifactId: string, targetTileId: string | null) => {
      if (!user) return null;
      return spendArtifact(user, artifactId, targetTileId, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleSiege = useCallback(
    async (sourceTileId: string, targetTileId: string) => {
      if (!user) return null;
      return siege(user, { sourceTileId, targetTileId }, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleFlyover = useCallback(
    async (
      sourceTileId: string,
      targetTileId: string,
      units: UnitStack
    ) => {
      if (!user) return null;
      return flyover(user, { sourceTileId, targetTileId, units }, mut);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleCastSpell = useCallback(
    async (spellId: string, sourceTileId: string, targetTileId: string) => {
      if (!user) return null;
      return castSpell(
        user,
        { spellId, sourceTileId, targetTileId },
        mut
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
    [user]
  );

  const handleCastArmageddon = useCallback(async () => {
    if (!user) return null;
    const result = await castArmageddon(user, mut);
    // If the cast broke seal #7, refetch worldMeta + player shortly after
    // so the dashboard picks up the resolver's eventual "armageddonState
    // === active, seasonNumber++" flip and the deleted player doc. The
    // wipe takes seconds; a single delayed refetch covers the typical
    // case and the user can manually refresh if the wipe runs long.
    if (result?.shouldTriggerResolve) {
      setTimeout(() => {
        void fetchPlayer();
      }, 12_000);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mut is rebuilt every render but its members are stable
  }, [user, fetchPlayer]);

  return {
    user,
    authLoading,
    isAdmin,
    player,
    tiles,
    worldTiles,
    worldOwners,
    eligibility,
    loading,
    creating,
    error,
    // Refetch player + tiles. Used by surfaces (e.g. the onboarding
    // wizard) that drive setup endpoints which don't patch local state
    // through the existing per-action mutators.
    refresh: fetchPlayer,
    exploring,
    exploreCount,
    setExploreCount,
    exploreProgress,
    handleFrontierExplore,
    distributing,
    distributeType,
    setDistributeType,
    distributeCount,
    setDistributeCount,
    distributeProgress,
    handleBulkDistribute,
    recentReports,
    renaming,
    setRenaming,
    renameInput,
    setRenameInput,
    handleCreatePlayer,
    handleSetName,
    handleAdminGrant,
    handleFarExpedition,
    handleCastIntelSpell,
    artifacts,
    handleAttack,
    handleRecruit,
    handleArmDefenseSpell,
    handleDistributeTile,
    handleUseArtifact,
    handleSiege,
    handleFlyover,
    handleCastSpell,
    worldMeta,
    topLeaders,
    handleCastArmageddon,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
