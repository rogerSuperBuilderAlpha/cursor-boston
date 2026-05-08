/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { DistributePanel } from "./_components/DistributePanel";
import { ExplorePanel } from "./_components/ExplorePanel";
import {
  SetupCompleteScreen,
  SetupEnlistScreen,
  SetupLoadingScreen,
  SetupSignInScreen,
} from "./_components/SetupGates";
import { useSetupActions } from "./_lib/use-setup-actions";
import { useSetupData } from "./_lib/use-setup-data";

export default function GameSetupPage() {
  const { user, authLoading, player, tiles, loading, error, setError, refresh } =
    useSetupData();
  const { busy, recentReveals, batchProgress, callApi, runExploreBatch } =
    useSetupActions({ user, setError, refresh });

  if (authLoading || loading) return <SetupLoadingScreen />;
  if (!user) return <SetupSignInScreen />;
  if (!player) return <SetupEnlistScreen />;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/game"
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
        >
          ← Back to dashboard
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Setup</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Finish the setup ramp here, then return to the dashboard to manage
            tiles, build units, and attack.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <span>
            Phase: <strong className="capitalize">{player.phase}</strong>
          </span>
          <span>
            Turns: <strong>{player.turnsRemaining}</strong>
          </span>
          <span>
            Explored:{" "}
            <strong>
              {tiles.filter((t) => t.type !== "unrevealed").length} / 100
            </strong>
          </span>
        </div>

        {error && (
          <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {player.phase === "explore" && (
          <ExplorePanel
            player={player}
            tiles={tiles}
            busy={busy}
            recentReveals={recentReveals}
            batchProgress={batchProgress}
            onExploreBatch={runExploreBatch}
          />
        )}

        {player.phase === "distribute" && (
          <DistributePanel
            tiles={tiles}
            busy={busy}
            onDistribute={(tileId, type) =>
              callApi("/api/game/setup/distribute", { tileId, type })
            }
            onChooseCaste={(caste) =>
              callApi("/api/game/setup/caste", { caste })
            }
          />
        )}

        {player.phase === "play" && (
          <SetupCompleteScreen caste={player.caste} />
        )}
      </div>
    </div>
  );
}
