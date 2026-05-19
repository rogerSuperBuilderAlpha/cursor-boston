/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ALL_SPELLS } from "@/lib/game/content";
import {
  computeTileThreat,
  rankTileIdsByThreat,
  type ThreatOwnerInfo,
} from "@/lib/game/threat";
import type {
  GamePlayer,
  MapTile,
  SpellDefinition,
} from "@/lib/game/types";
import { TIERS } from "../_lib/constants";
import type { OwnerSummary } from "../_lib/types";
import type { SpellActions } from "../_lib/use-spell-actions";
import { ActiveProductionList } from "./ActiveProductionList";
import { ArmedTilesList } from "./ArmedTilesList";
import { ReportLog } from "./ReportLog";
import { TierSection } from "./TierSection";

interface Props {
  player: GamePlayer;
  tiles: MapTile[];
  borderTiles: MapTile[];
  owners: Map<string, OwnerSummary>;
  error: string | null;
  actions: SpellActions;
}

/**
 * Composed body of the spells page. Owns the local picker state
 * (single-arm tile + bulk panel state) and the derived memos
 * (`spellByTierAndType`, `armableTiles`, `threatRanked`).
 */
export function SpellsView({
  player,
  tiles,
  borderTiles,
  owners,
  error,
  actions,
}: Props) {
  // Defense-spell single-arm picker (legacy flow, preserved as the "arm one"
  // shortcut alongside the new bulk panel).
  const [armTargetTileId, setArmTargetTileId] = useState<string>("");
  // Which defense spell, if any, has its bulk-arm panel open.
  const [bulkSpellId, setBulkSpellId] = useState<string | null>(null);
  const [bulkN, setBulkN] = useState<number>(0);

  // Build a (tier, type) → spell lookup so the table cells can pull their
  // spell in O(1).
  const spellByTierAndType = useMemo(() => {
    const map = new Map<string, SpellDefinition>();
    if (!player.caste) return map;
    for (const s of ALL_SPELLS) {
      if (s.caste !== player.caste) continue;
      map.set(`${s.tier}|${s.type}`, s);
    }
    return map;
  }, [player.caste]);

  // Tiles eligible to receive a defense spell: owned, revealed, not already
  // armed. Sorted by per-tile threat for the bulk panel.
  const armableUnarmedTiles = useMemo(
    () =>
      tiles.filter(
        (t) =>
          t.type !== "unrevealed" &&
          t.ownerId === player.userId &&
          !t.armedDefenseSpellId
      ),
    [tiles, player.userId]
  );

  // Including armed tiles too — used by the legacy single-arm picker so
  // re-arming is still possible if the user wants to swap spells on a tile.
  const armableTiles = useMemo(
    () =>
      tiles.filter(
        (t) => t.type !== "unrevealed" && t.ownerId === player.userId
      ),
    [tiles, player.userId]
  );

  // Per-tile threat score, used to sort the bulk-arm preview. The threat
  // model only cares about adjacency, so the border-tile slice from the
  // cache is sufficient (and dramatically cheaper than the whole world).
  const threatRanked = useMemo(() => {
    const ownerInfo = new Map<string, ThreatOwnerInfo>();
    for (const [uid, o] of owners) ownerInfo.set(uid, { shielded: o.shielded });
    const threat = computeTileThreat({
      myTiles: armableUnarmedTiles,
      worldTiles: borderTiles,
      owners: ownerInfo,
      myUserId: player.userId,
    });
    return rankTileIdsByThreat(
      armableUnarmedTiles.map((t) => t.tileId),
      threat
    );
  }, [armableUnarmedTiles, borderTiles, owners, player.userId]);

  const tilesHeld = player.stats?.tilesHeld ?? 0;

  const onArmDefenseBulk = async (spellId: string, tileIds: string[]) => {
    await actions.armDefenseBulk(spellId, tileIds);
    setBulkSpellId(null);
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold capitalize">
            {player.caste} spell book
          </h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p className="mb-1">
            Five tiers × three spell types. Higher tiers unlock as your
            territory grows. You currently hold{" "}
            <strong className="font-mono">{tilesHeld}</strong> tiles · turns
            remaining: <strong>{player.turnsRemaining}</strong>.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="space-y-6 mb-10">
          {TIERS.map(({ tier, minTiles }) => (
            <TierSection
              key={tier}
              tier={tier}
              minTiles={minTiles}
              tilesHeld={tilesHeld}
              player={player}
              spellByTierAndType={spellByTierAndType}
              busyId={actions.busyId}
              armTargetTileId={armTargetTileId}
              setArmTargetTileId={setArmTargetTileId}
              armableTiles={armableTiles}
              bulkSpellId={bulkSpellId}
              setBulkSpellId={setBulkSpellId}
              bulkN={bulkN}
              setBulkN={setBulkN}
              threatRanked={threatRanked}
              armableUnarmedTiles={armableUnarmedTiles}
              onCastProduction={actions.castProduction}
              onArmDefenseSingle={actions.armDefenseSingle}
              onArmDefenseBulk={onArmDefenseBulk}
            />
          ))}
        </div>

        <ActiveProductionList player={player} />
        <ArmedTilesList tiles={tiles} />
        <ReportLog reports={actions.recentReports} />
      </div>
    </div>
  );
}
