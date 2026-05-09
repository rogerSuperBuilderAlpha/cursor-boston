/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { mayRefresh, mergeTiles as mergeTilesIntoCache } from "@/lib/game/local-map-cache";
import type { LandType, MapTile } from "@/lib/game/types";
import { AudienceFilterRow } from "./_components/AudienceFilterRow";
import { LandTypeFilterRow } from "./_components/LandTypeFilterRow";
import { MapCanvas } from "./_components/MapCanvas";
import { MapLegend } from "./_components/MapLegend";
import { PersonalMapToolbar } from "./_components/PersonalMapToolbar";
import { ScopeFilterRow } from "./_components/ScopeFilterRow";
import { TileActionsModal } from "./_components/TileActionsModal";
import type { AudienceFilter, ScopeFilter } from "./_lib/types";
import { usePanZoom } from "./_lib/use-pan-zoom";
import { useTilesData } from "./_lib/use-tiles-data";

export default function TilesMapPage() {
  const data = useTilesData();
  const {
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
  } = data;

  const panZoom = usePanZoom();
  const [filter, setFilter] = useState<LandType | "all">("all");
  const [scope, setScope] = useState<ScopeFilter>("everyone");
  const [audience, setAudience] = useState<AudienceFilter>("all");
  // Tile-actions modal: open when the user clicks a tile. Holds a tileId
  // (not the MapTile itself) so it stays in sync with mutations.
  const [modalTileId, setModalTileId] = useState<string | null>(null);

  const handleTileClick = useCallback(
    (t: MapTile) => {
      if (!player) return;
      // Open the actions modal for any owned tile (own or enemy). Unrevealed
      // / unowned tiles have nothing to act on, so leave them as hover-only.
      if (t.ownerId) setModalTileId(t.tileId);
    },
    [player]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/game" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Go to dashboard
        </Link>
      </div>
    );
  }

  const ownTiles = tiles.filter((t) => t.ownerId === player.userId);
  // Audience counts by owner (not by tile) — filter dropdown labels show
  // how many distinct opponents fall in each bucket, since one player
  // typically owns many tiles.
  let humanCount = 0;
  let npcCount = 0;
  for (const owner of ownersById.values()) {
    if (owner.userId === player.userId) continue;
    if (owner.isNpc) npcCount++;
    else humanCount++;
  }
  const visibleTiles = tiles.filter((t) => {
    if (scope === "mine" && t.ownerId !== player.userId) return false;
    if (scope === "foreign" && t.ownerId === player.userId) return false;
    // Audience filter only applies to enemy-owned tiles. Own tiles and
    // unowned (frontier/wilderness) always pass — hiding either would be
    // confusing for the player.
    if (audience !== "all" && t.ownerId && t.ownerId !== player.userId) {
      const owner = ownersById.get(t.ownerId);
      const isNpc = owner?.isNpc === true;
      if (audience === "humans" && isNpc) return false;
      if (audience === "npcs" && !isNpc) return false;
    }
    return true;
  });

  const modalTile = modalTileId
    ? tiles.find((x) => x.tileId === modalTileId) ?? null
    : null;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">World map</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Drag to pan, scroll to zoom. <strong>Personal mode</strong> shows
            your tiles + the enemy ring touching your borders, cached locally
            so it loads instantly. <strong>World mode</strong> (🌐) fetches
            every tile in the world for context.
          </p>
        </div>

        {worldError && mode === "world" && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-3 mb-4 text-sm">
            <strong className="text-red-700 dark:text-red-300">World fetch failed:</strong>{" "}
            <span className="text-red-700 dark:text-red-300">{worldError}</span>
            <button
              onClick={() => void fetchWorldOnce()}
              className="ml-3 px-2 py-1 text-xs rounded border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        )}

        <PersonalMapToolbar
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            // Re-fit on mode change so toggling Personal/World snaps to
            // the right viewport.
            panZoom.setDidFit(false);
            if (next === "world" && !worldView) {
              void fetchWorldOnce();
            }
          }}
          cachedView={cachedView}
          refreshing={refreshing}
          onRefresh={() => {
            if (cachedView && !mayRefresh(cachedView)) return;
            void refreshPersonalMap();
          }}
        />

        <ScopeFilterRow
          scope={scope}
          onChange={setScope}
          totalCount={tiles.length}
          ownCount={ownTiles.length}
        />

        <AudienceFilterRow
          audience={audience}
          onChange={setAudience}
          humanCount={humanCount}
          npcCount={npcCount}
        />

        <LandTypeFilterRow
          filter={filter}
          onChange={setFilter}
          visibleTiles={visibleTiles}
        />

        {tiles.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">
            The world is empty.
          </p>
        ) : (
          <MapCanvas
            player={player}
            tiles={tiles}
            visibleTiles={visibleTiles}
            ownersById={ownersById}
            filter={filter}
            mode={mode}
            panZoom={panZoom}
            onTileClick={handleTileClick}
          />
        )}

        <MapLegend />
      </div>

      {modalTile && (
        <TileActionsModal
          tile={modalTile}
          player={player}
          ownedTiles={ownTiles}
          ownerName={
            modalTile.ownerId
              ? ownersById.get(modalTile.ownerId)?.displayName ?? null
              : null
          }
          onClose={() => setModalTileId(null)}
          onTileUpdate={(updated) => {
            if (!user) return;
            // Push into the localStorage cache, then re-hydrate React state
            // from the merged view so the map repaints with the change
            // without waiting for a manual refresh.
            const next = mergeTilesIntoCache(user.uid, [updated]);
            if (next) setCachedView(next);
          }}
          onPlayerUpdate={(p) => setPlayer(p)}
        />
      )}
    </div>
  );
}
