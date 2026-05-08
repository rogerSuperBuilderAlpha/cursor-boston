/**
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
import { TURNS_PER_CYCLE, UNITS_PER_CYCLE } from "../_lib/constants";
import { buildThreatPriorityPlan } from "../_lib/threat-priority-plan";
import type { OwnerSummary } from "../_lib/types";
import type { RecruitAction } from "../_lib/use-recruit-action";
import { BulkRecruitPanel } from "./BulkRecruitPanel";
import { MilitaryTilesList } from "./MilitaryTilesList";
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
  const foodTiles = tiles.filter((t) => t.type === "food");
  const magicTiles = tiles.filter((t) => t.type === "magic");

  // Threat-ranked military-tile ids. Drives the auto-route distribution and
  // the order tiles appear in the manual-override picker (most exposed at
  // top is what a player wants to see).
  const threatRankedMilitaryIds = useMemo(() => {
    const ownerInfo = new Map<string, ThreatOwnerInfo>();
    for (const [uid, o] of owners) ownerInfo.set(uid, { shielded: o.shielded });
    const threat = computeTileThreat({
      myTiles: militaryTiles,
      worldTiles: borderTiles,
      owners: ownerInfo,
      myUserId: player.userId,
    });
    return rankTileIdsByThreat(
      militaryTiles.map((t) => t.tileId),
      threat
    );
  }, [militaryTiles, borderTiles, owners, player.userId]);

  // Compute the player's current effective unit cap. This mirrors what the
  // server uses inside buildUnitsServer so the displayed numbers match what
  // will actually go through.
  const cap = effectiveUnitCap(player, foodTiles.length, magicTiles.length);
  const unitsAlive = player.stats.unitsAlive ?? 0;
  const availableCap = Math.max(0, cap - unitsAlive);
  const turnsRemaining = player.turnsRemaining;
  // How many BUILD CYCLES the player can afford right now.
  const maxCyclesByCap = Math.floor(availableCap / UNITS_PER_CYCLE);
  const maxCyclesByTurns = Math.floor(turnsRemaining / TURNS_PER_CYCLE);
  const maxCycles = Math.min(maxCyclesByCap, maxCyclesByTurns);
  const maxUnits = maxCycles * UNITS_PER_CYCLE;

  // Final units rounded to a multiple of UNITS_PER_CYCLE and bounded by cap.
  const effectiveUnits = useMemo(
    () =>
      Math.max(
        UNITS_PER_CYCLE,
        Math.min(
          maxUnits,
          Math.floor(requestedUnits / UNITS_PER_CYCLE) * UNITS_PER_CYCLE
        )
      ),
    [maxUnits, requestedUnits]
  );
  const effectiveCycles = Math.max(
    0,
    Math.floor(effectiveUnits / UNITS_PER_CYCLE)
  );

  // Distribution preview, used to render a transparent "this is where the
  // units are going" line above the recruit button.
  const planPreview = useMemo(() => {
    if (effectiveCycles === 0) return [];
    if (selectedTileId) {
      return [{ tileId: selectedTileId, cycles: effectiveCycles }];
    }
    return buildThreatPriorityPlan(threatRankedMilitaryIds, effectiveCycles);
  }, [effectiveCycles, selectedTileId, threatRankedMilitaryIds]);

  const onRecruit = () => {
    if (militaryTiles.length === 0) {
      setError("You have no military tiles to recruit from.");
      return;
    }
    void action.handleRecruit({
      unitType,
      totalCycles: effectiveCycles,
      selectedTileId,
      threatRankedMilitaryIds,
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
            Each recruit cycle trains <strong>{UNITS_PER_CYCLE} units</strong>{" "}
            of one type on a military tile, costing{" "}
            <strong>{TURNS_PER_CYCLE} turns</strong>. Bulk recruit fires cycles
            round-robin across all your military tiles so units distribute
            evenly. Each cycle rolls a 3% chance for an artifact.
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
          militaryTiles={militaryTiles}
          threatRankedMilitaryIds={threatRankedMilitaryIds}
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

        <MilitaryTilesList tiles={militaryTiles} />
        <ReportLog reports={action.recentReports} />
      </div>
    </div>
  );
}
