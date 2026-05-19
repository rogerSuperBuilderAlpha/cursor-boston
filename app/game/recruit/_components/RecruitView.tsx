/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getCasteProfile } from "@/lib/game/content";
import {
  effectiveUnitCap,
  PRODUCTION_SPELL_DURATION_TURNS,
} from "@/lib/game/turns";
import {
  computeTileThreat,
  rankTileIdsByThreat,
  type ThreatOwnerInfo,
} from "@/lib/game/threat";
import type { GamePlayer, MapTile, UnitType } from "@/lib/game/types";
import {
  MIN_UNITS_PER_CYCLE_RECRUITABLE,
  TURNS_PER_CYCLE,
  unitsPerCycleForLand,
} from "../_lib/constants";
import { buildThreatPriorityPlan } from "../_lib/threat-priority-plan";
import type { OwnerSummary } from "../_lib/types";
import type { RecruitAction } from "../_lib/use-recruit-action";
import { BulkRecruitPanel } from "./BulkRecruitPanel";
import { RecruitableTilesList } from "./MilitaryTilesList";
import { ReportLog } from "./ReportLog";
import { StatGrid } from "./StatGrid";

interface Props {
  player: GamePlayer;
  tiles: MapTile[];
  borderTiles: MapTile[];
  owners: Map<string, OwnerSummary>;
  error: string | null;
  setError: (msg: string | null) => void;
  action: RecruitAction;
}

/**
 * Composed body of the recruit page. Owns the local picker state
 * (unitType / requestedUnits / selectedTileId) and the derived memos
 * (military tiles, cap math, threat ranking, plan preview). Hands every
 * derived value down to BulkRecruitPanel as a fully-prepared prop.
 */
export function RecruitView({
  player,
  tiles,
  borderTiles,
  owners,
  error,
  setError,
  action,
}: Props) {
  const [unitType, setUnitType] = useState<UnitType>("ground");
  const [requestedUnits, setRequestedUnits] = useState(50);
  // "" → auto-route by threat across all military tiles. Otherwise the
  // user has explicitly picked one tile and 100% of the recruit goes there.
  const [selectedTileId, setSelectedTileId] = useState<string>("");

  const militaryTiles = useMemo(
    () => tiles.filter((t) => t.type === "military"),
    [tiles]
  );
  const foodTiles = useMemo(
    () => tiles.filter((t) => t.type === "food"),
    [tiles]
  );
  const magicTiles = useMemo(
    () => tiles.filter((t) => t.type === "magic"),
    [tiles]
  );
  // All tiles where the player can train units. As of the May 2026 rework,
  // food and magic tiles can recruit (at half the military rate).
  const recruitableTiles = useMemo(
    () => [...militaryTiles, ...foodTiles, ...magicTiles],
    [militaryTiles, foodTiles, magicTiles]
  );
  const tilesById = useMemo(() => {
    const m = new Map<string, MapTile>();
    for (const t of recruitableTiles) m.set(t.tileId, t);
    return m;
  }, [recruitableTiles]);

  // Threat-ranked recruitable-tile ids. Drives the auto-route distribution
  // and the order tiles appear in the manual-override picker (most exposed
  // at top is what a player wants to see).
  const threatRankedRecruitableIds = useMemo(() => {
    const ownerInfo = new Map<string, ThreatOwnerInfo>();
    for (const [uid, o] of owners) ownerInfo.set(uid, { shielded: o.shielded });
    const threat = computeTileThreat({
      myTiles: recruitableTiles,
      worldTiles: borderTiles,
      owners: ownerInfo,
      myUserId: player.userId,
    });
    return rankTileIdsByThreat(
      recruitableTiles.map((t) => t.tileId),
      threat
    );
  }, [recruitableTiles, borderTiles, owners, player.userId]);

  // Compute the player's current effective unit cap. This mirrors what the
  // server uses inside buildUnitsServer so the displayed numbers match what
  // will actually go through.
  const cap = effectiveUnitCap(player, foodTiles.length, magicTiles.length);
  const unitsAlive = player.stats.unitsAlive ?? 0;
  const availableCap = Math.max(0, cap - unitsAlive);
  const turnsRemaining = player.turnsRemaining;
  // Cap-by-tiles math. Per-cycle yield now varies by tile type, so the
  // safe upper bound on cycles uses the *minimum* yield (5) — we'd rather
  // under-predict and let the server cap-stop than ever exceed cap.
  const maxCyclesByCap = Math.floor(
    availableCap / MIN_UNITS_PER_CYCLE_RECRUITABLE
  );
  const maxCyclesByTurns = Math.floor(turnsRemaining / TURNS_PER_CYCLE);
  const maxCycles = Math.min(maxCyclesByCap, maxCyclesByTurns);

  // Project how many actual units a given plan will yield, given each tile's
  // land type. Used by the input control and the recruit button label.
  const projectUnits = useMemo(
    () =>
      (
        plan: ReadonlyArray<{ tileId: string; cycles: number }>
      ): number => {
        let total = 0;
        for (const { tileId, cycles } of plan) {
          const t = tilesById.get(tileId);
          if (!t) continue;
          total += cycles * unitsPerCycleForLand(t.type);
        }
        return total;
      },
    [tilesById]
  );

  // The "max units this session" stat: optimistic projection assuming
  // auto-route, since that's the likeliest user choice.
  const maxUnits = useMemo(() => {
    if (maxCycles === 0) return 0;
    const plan = buildThreatPriorityPlan(threatRankedRecruitableIds, maxCycles);
    return projectUnits(plan);
  }, [maxCycles, threatRankedRecruitableIds, projectUnits]);

  // Convert the user's requested units into a cycle count, then clamp.
  const effectiveCycles = useMemo(() => {
    // One cycle costs at least the minimum yield, so divide by that to be
    // generous with the user's input ("I want at least N units → that many
    // cycles, clamped to maxCycles"). The actual realized units come back
    // from projectUnits below.
    const requestedCycles = Math.floor(
      requestedUnits / MIN_UNITS_PER_CYCLE_RECRUITABLE
    );
    return Math.max(0, Math.min(maxCycles, requestedCycles));
  }, [requestedUnits, maxCycles]);

  // Distribution preview, used to render a transparent "this is where the
  // units are going" line above the recruit button.
  const planPreview = useMemo(() => {
    if (effectiveCycles === 0) return [];
    if (selectedTileId) {
      return [{ tileId: selectedTileId, cycles: effectiveCycles }];
    }
    return buildThreatPriorityPlan(threatRankedRecruitableIds, effectiveCycles);
  }, [effectiveCycles, selectedTileId, threatRankedRecruitableIds]);

  const effectiveUnits = useMemo(
    () => projectUnits(planPreview),
    [planPreview, projectUnits]
  );

  const onRecruit = () => {
    if (recruitableTiles.length === 0) {
      setError("You have no recruitable tiles. Distribute some land first.");
      return;
    }
    void action.handleRecruit({
      unitType,
      totalCycles: effectiveCycles,
      selectedTileId,
      threatRankedRecruitableIds,
    });
  };

  const casteProfile = player.caste ? getCasteProfile(player.caste) : null;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Recruit forces</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p>
            Each recruit cycle costs <strong>{TURNS_PER_CYCLE} turns</strong>{" "}
            and trains units on one of your tiles.{" "}
            <strong>Military tiles train 10 units/cycle</strong>; food and
            magic tiles train <strong>5/cycle</strong>. Bulk recruit
            distributes cycles by threat across your recruitable tiles so
            exposed lands get reinforced first. Each cycle rolls a 3% chance
            for an artifact.
          </p>
          <p className="mt-2">
            Your unit cap is set by your <strong>food lands</strong> (+5 cap
            each up to 50, then +2.5), multiplied by any active production
            spells. Your <strong>caste</strong> shifts which unit type you
            build best (
            {casteProfile
              ? Object.entries(casteProfile.unitTypeBonuses)
                  .map(([k, v]) => `${k} ×${v}`)
                  .join(", ")
              : "—"}
            ).
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <StatGrid
          militaryTiles={militaryTiles.length}
          cap={cap}
          unitsAlive={unitsAlive}
          availableCap={availableCap}
          turnsRemaining={turnsRemaining}
          maxUnits={maxUnits}
          maxCycles={maxCycles}
          foodTiles={foodTiles.length}
          magicTiles={magicTiles.length}
        />

        {(player.productionSpellsActive ?? []).length > 0 && (
          <div className="mb-6 text-xs text-neutral-500">
            Active production spells contributing to your cap:{" "}
            {(player.productionSpellsActive ?? [])
              .map((p) => p.spellId)
              .join(", ")}{" "}
            (each lasts {PRODUCTION_SPELL_DURATION_TURNS} turns from cast).
          </div>
        )}

        <BulkRecruitPanel
          recruitableTiles={recruitableTiles}
          threatRankedRecruitableIds={threatRankedRecruitableIds}
          tilesById={tilesById}
          unitType={unitType}
          setUnitType={setUnitType}
          requestedUnits={requestedUnits}
          setRequestedUnits={setRequestedUnits}
          selectedTileId={selectedTileId}
          setSelectedTileId={setSelectedTileId}
          busy={action.busy}
          maxCycles={maxCycles}
          maxUnits={maxUnits}
          effectiveUnits={effectiveUnits}
          planPreview={planPreview}
          progress={action.progress}
          onRecruit={onRecruit}
        />

        <RecruitableTilesList tiles={recruitableTiles} />
        <ReportLog reports={action.recentReports} />
      </div>
    </div>
  );
}
