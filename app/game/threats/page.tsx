/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CombatResult,
  GameTile,
  TurnReport,
} from "@/lib/game/types";
import { SignedOutLanding } from "../_components/dashboard/SignedOutLanding";
import { useDashboardData } from "../_lib/use-dashboard-data";
import { ArmyPanel } from "./_components/ArmyPanel";
import { BattleReport } from "./_components/BattleReport";
import { ThreatRow } from "./_components/ThreatRow";
import { deriveThreatEntries } from "./_lib/threats-derive";

/**
 * /game/threats — Single-surface action hub: every enemy tile bordering
 * my territory becomes a ThreatRow with inline attack + expandable
 * recruit / arm / artifact / spy actions.
 *
 * Reuses `useDashboardData` so all action handlers, soft-refresh state,
 * and inventory are shared with the dashboard. No extra fetches at
 * mount time beyond what the dashboard already does.
 */
export default function ThreatsPage() {
  const data = useDashboardData();
  const {
    user,
    authLoading,
    loading,
    error,
    player,
    tiles,
    worldTiles,
    worldOwners,
    artifacts,
    handleAttack,
    handleCastIntelSpell,
    handleUseArtifact,
    handleRecruit,
    handleArmDefenseSpell,
    handleDistributeTile,
    handleSiege,
    handleFlyover,
    handleCastSpell,
  } = data;

  // Player's magic-land count drives spell-cast magnitudes via
  // magicMultiplier. Computed once here and passed down to ThreatRow.
  const myMagicLandCount = useMemo(
    () => tiles.filter((t) => t.type === "magic").length,
    [tiles]
  );

  const [hideShielded, setHideShielded] = useState(true);
  const [hideOverwhelming, setHideOverwhelming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Lifted out of ThreatRow so a successful capture (which unmounts the
  // attacked row) doesn't yank the result away mid-read. The modal stays
  // up until the user clicks Close, then they move on to the next threat.
  const [battleResult, setBattleResult] = useState<{
    combat: CombatResult;
    report: TurnReport;
    targetTile: GameTile;
  } | null>(null);

  const entries = useMemo(() => {
    if (!user || !player) return [];
    return deriveThreatEntries({
      myUserId: user.uid,
      myCaste: player.caste,
      myTiles: tiles,
      worldTiles,
      worldOwners,
    });
  }, [user, player, tiles, worldTiles, worldOwners]);

  const visibleEntries = useMemo(() => {
    let out = entries;
    if (hideShielded) {
      out = out.filter((e) => !(e.enemyOwner?.shielded ?? false));
    }
    if (hideOverwhelming) {
      out = out.filter((e) => e.myAdvantage >= 0.2); // ≥ 1 / 5×
    }
    return out;
  }, [entries, hideShielded, hideOverwhelming]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) return <SignedOutLanding />;

  if (!player) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold">Threats</h1>
        <p className="text-sm text-neutral-500">
          You haven&apos;t enlisted yet.{" "}
          <Link href="/game" className="text-emerald-600 hover:underline">
            Go to the dashboard
          </Link>{" "}
          to spawn your general.
        </p>
      </main>
    );
  }

  // Wrap action handlers so the page can show a single global "busy"
  // indicator while any action is in flight. Each handler still patches
  // local state via the mutator chain on completion.
  function withBusy<TArgs extends unknown[], TResult>(
    fn: ((...args: TArgs) => Promise<TResult>) | undefined
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs) => {
      if (!fn) {
        // Hooks are always present after the gates above; this branch
        // is just a TS narrowing fallback.
        return Promise.resolve() as TResult;
      }
      setBusy(true);
      try {
        return await fn(...args);
      } finally {
        setBusy(false);
      }
    };
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Threats</h1>
          <Link
            href="/game"
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {entries.length === 0
            ? "No enemy tiles border your territory."
            : `${entries.length} enemy tile${entries.length === 1 ? "" : "s"} bordering your territory · ${player.turnsRemaining} turns available.`}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideShielded}
              onChange={(e) => setHideShielded(e.target.checked)}
            />
            Hide shielded
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideOverwhelming}
              onChange={(e) => setHideOverwhelming(e.target.checked)}
            />
            Hide overwhelming (5×+)
          </label>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <ArmyPanel player={player} />

      {visibleEntries.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-sm text-neutral-500">
          {entries.length === 0
            ? "Explore farther — no enemies on your border yet. Try Far Expedition from the dashboard."
            : "All your bordering enemies are filtered out. Adjust the toggles above."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry, idx) => (
            <ThreatRow
              key={entry.enemyTile.tileId}
              entry={entry}
              player={player}
              artifacts={artifacts}
              busy={busy}
              // Auto-expand the top-3 ranked threats so the user lands in
              // the canonical attack flow without an extra click on the
              // matchups they're most likely to act on. Lower-ranked rows
              // stay collapsed to keep the page scannable.
              defaultExpanded={idx < 3}
              onAttack={withBusy(handleAttack)}
              onCastIntelSpell={withBusy(handleCastIntelSpell)}
              onUseArtifact={withBusy(handleUseArtifact)}
              onRecruit={withBusy(handleRecruit)}
              onArmDefenseSpell={withBusy(handleArmDefenseSpell)}
              onDistributeTile={withBusy(handleDistributeTile)}
              onSiege={withBusy(handleSiege)}
              onFlyover={withBusy(handleFlyover)}
              onCastSpell={withBusy(handleCastSpell)}
              onBattleResolved={setBattleResult}
              myMagicLandCount={myMagicLandCount}
            />
          ))}
        </div>
      )}

      {battleResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Battle result"
          onClick={() => setBattleResult(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <BattleReport
              combat={battleResult.combat}
              report={battleResult.report}
              targetTile={battleResult.targetTile}
              onDismiss={() => setBattleResult(null)}
            />
            <button
              type="button"
              onClick={() => setBattleResult(null)}
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
