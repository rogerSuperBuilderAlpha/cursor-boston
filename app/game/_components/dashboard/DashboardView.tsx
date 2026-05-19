/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo } from "react";
import { effectiveUnitCap } from "@/lib/game/turns";
import {
  countUnshieldedNeighbors,
  deriveShieldStatus,
} from "../../_lib/dashboard-helpers";
import { recommendNext } from "../../_lib/recommend";
import type { DashboardData } from "../../_lib/use-dashboard-data";
import type { LandCounts } from "../../_lib/dashboard-types";
import { DashboardHeader } from "./DashboardHeader";
import { EligibilityBanner } from "./EligibilityBanner";
import { HeroCard } from "./HeroCard";
import { RecommendedAction } from "./RecommendedAction";
import { LandsCard } from "./LandsCard";
import { ArmyCard } from "./ArmyCard";
import { ThreatCard } from "./ThreatCard";
import { ShieldCard } from "./ShieldCard";
import { SealsPanel } from "./SealsPanel";
import { ExploreFrontier } from "./ExploreFrontier";
import { FarExpedition } from "./FarExpedition";
import { BulkDistribute } from "./BulkDistribute";
import { BulkUnassign } from "./BulkUnassign";
import { MiniMap } from "./MiniMap";
import { NavGrid } from "./NavGrid";
import { DashboardReports } from "./DashboardReports";
import { CasteChangeCard } from "./CasteChangeCard";
import { CommunityPanel } from "./CommunityPanel";
import { DesignersWantedCard } from "./DesignersWantedCard";
import { HeroesRosterCard } from "./HeroesRosterCard";
import { SummonableUnitsCard } from "./SummonableUnitsCard";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import type { GamePlayer } from "@/lib/game/types";

interface DashboardViewProps {
  player: GamePlayer;
  data: DashboardData;
}

/**
 * Composed dashboard layout. Pure-ish: takes a `player` (the route
 * already gated on player !== null) plus the full `useDashboardData()`
 * return value, derives the visible counts/threats/recommendation, and
 * lays everything out. All action handlers come from the data hook.
 */
export function DashboardView({ player, data }: DashboardViewProps) {
  const {
    tiles,
    worldTiles,
    worldOwners,
    eligibility,
    isAdmin,
    error,
    renaming,
    renameInput,
    setRenaming,
    setRenameInput,
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
    handleSetName,
    handleAdminGrant,
    handleFarExpedition,
    recentReports,
  } = data;

  const counts: LandCounts = useMemo(() => {
    let military = 0;
    let food = 0;
    let magic = 0;
    let unassigned = 0;
    for (const t of tiles) {
      if (t.type === "military") military++;
      else if (t.type === "food") food++;
      else if (t.type === "magic") magic++;
      else if (t.type === "unassigned") unassigned++;
    }
    return { military, food, magic, unassigned, total: tiles.length };
  }, [tiles]);

  const army = useMemo(() => {
    let ground = 0;
    let siege = 0;
    let air = 0;
    for (const t of tiles) {
      ground += t.units.ground;
      siege += t.units.siege;
      air += t.units.air;
    }
    return { ground, siege, air, total: ground + siege + air };
  }, [tiles]);

  const unitCap = useMemo(
    () => effectiveUnitCap(player, counts.food, counts.magic),
    [player, counts.food, counts.magic]
  );

  const threats = useMemo(
    () =>
      countUnshieldedNeighbors(player.userId, tiles, worldTiles, worldOwners),
    [player.userId, tiles, worldTiles, worldOwners]
  );

  const shieldStatus = useMemo(() => deriveShieldStatus(player), [player]);

  const recommended = useMemo(
    () => recommendNext(player, counts, army, threats, unitCap),
    [player, counts, army, threats, unitCap]
  );

  return (
    <div className="min-h-screen py-12 px-6">
      <OnboardingWizard
        user={data.user}
        player={player}
        counts={counts}
        army={army}
        tiles={tiles}
        onRefresh={data.refresh}
      />
      <div className="max-w-5xl mx-auto">
        <DashboardHeader
          player={player}
          renaming={renaming}
          renameInput={renameInput}
          onRenameStart={() => {
            setRenameInput(player.displayName);
            setRenaming(true);
          }}
          onRenameChange={setRenameInput}
          onRenameCancel={() => setRenaming(false)}
          onRenameSubmit={async () => {
            const next = renameInput.trim();
            if (next && next !== player.displayName) {
              await handleSetName(next);
            }
            setRenaming(false);
          }}
        />

        {error && (
          <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {eligibility && <EligibilityBanner eligibility={eligibility} />}

        <CasteChangeCard
          player={player}
          user={data.user}
          onRefresh={data.refresh}
        />

        <DesignersWantedCard />

        <HeroCard
          turnsRemaining={player.turnsRemaining}
          turnsSpent={player.turnsSpentTotal}
          shield={shieldStatus}
        />

        <RecommendedAction rec={recommended} phase={player.phase} />

        <SealsPanel
          worldMeta={data.worldMeta}
          topLeaders={data.topLeaders}
          playerTilesHeld={player.stats.tilesHeld}
          playerTiles={tiles}
        />

        <div className="mb-8">
          <NavGrid phase={player.phase} />
        </div>

        <CommunityPanel
          user={data.user}
          isAdmin={isAdmin}
          myCaste={player.caste}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
          <LandsCard counts={counts} />
          <ArmyCard army={army} cap={unitCap} />
          <ThreatCard threats={threats} shielded={shieldStatus.shielded} />
          <ShieldCard shield={shieldStatus} />
        </div>

        <HeroesRosterCard tiles={tiles} />
        <SummonableUnitsCard player={player} onRefresh={data.refresh} />

        {isAdmin && (
          <div className="mb-8 pt-4 border-t border-dashed border-neutral-300 dark:border-neutral-700">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
              Admin
            </p>
            <button
              onClick={handleAdminGrant}
              className="px-4 py-2 border border-amber-400 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-sm"
              title="Manual override. The Sunday cron is the primary mechanism."
            >
              Grant 100 turns (admin)
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 space-y-4">
            {player.phase === "play" && (
              <ExploreFrontier
                count={exploreCount}
                onCountChange={setExploreCount}
                busy={exploring}
                progress={exploreProgress}
                maxCount={Math.min(50, player.turnsRemaining)}
                onExplore={() => handleFrontierExplore(exploreCount)}
              />
            )}

            {player.phase === "play" && (
              <FarExpedition
                turnsRemaining={player.turnsRemaining}
                onLaunch={handleFarExpedition}
              />
            )}

            {(player.phase === "distribute" || player.phase === "play") &&
              counts.unassigned > 0 && (
                <BulkDistribute
                  unassignedCount={counts.unassigned}
                  turnsRemaining={player.turnsRemaining}
                  type={distributeType}
                  onTypeChange={setDistributeType}
                  count={distributeCount}
                  onCountChange={setDistributeCount}
                  busy={distributing}
                  progress={distributeProgress}
                  onRun={() =>
                    handleBulkDistribute(
                      distributeType,
                      distributeCount,
                      (t) => t.type === "unassigned",
                      "unassigned"
                    )
                  }
                />
              )}

            {player.phase === "play" &&
              tiles.some(
                (t) =>
                  t.type === "military" ||
                  t.type === "food" ||
                  t.type === "magic"
              ) && (
                <BulkUnassign
                  tiles={tiles}
                  turnsRemaining={player.turnsRemaining}
                  busy={distributing}
                  progress={distributeProgress}
                  onRun={(sourceType, count) =>
                    handleBulkDistribute(
                      "unassigned",
                      count,
                      (t) => t.type === sourceType,
                      sourceType
                    )
                  }
                />
              )}
          </div>

          <div>
            <MiniMap tiles={tiles} userId={player.userId} />
          </div>
        </div>

        <DashboardReports reports={recentReports} />
      </div>
    </div>
  );
}
