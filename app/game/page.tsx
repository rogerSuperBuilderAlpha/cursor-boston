/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { CreatePlayerGate } from "./_components/dashboard/CreatePlayerGate";
import { DashboardView } from "./_components/dashboard/DashboardView";
import { NameYourGeneralGate } from "./_components/dashboard/NameYourGeneralGate";
import { SignedOutLanding } from "./_components/dashboard/SignedOutLanding";
import { useDashboardData } from "./_lib/use-dashboard-data";

// Fixed bottom-right FAB linking into the 3D fly-around at /game/world.
// Always rendered (signed-out landing, create-player gate, full
// dashboard) so the world map is discoverable from every entrypoint.
function WorldMapFab() {
  return (
    <Link
      href="/game/world"
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-neutral-900/80 backdrop-blur border border-neutral-700/60 px-4 py-2.5 text-sm font-medium text-neutral-100 shadow-lg hover:bg-neutral-800 dark:bg-neutral-900/80 dark:hover:bg-neutral-800 transition-colors"
      aria-label="Open game world map"
    >
      <span aria-hidden>🗺️</span>
      <span>Open game world map</span>
    </Link>
  );
}

/**
 * /game — the dashboard. Composition only: every meaningful piece lives
 * in `_components/dashboard/` (UI) or `_lib/` (state + helpers).
 *
 * Render path:
 *   - auth or initial-fetch in progress → spinner
 *   - signed-out → landing
 *   - signed-in but no player → enlist gate
 *   - signed-in with player but no displayName (legacy) → name picker
 *   - otherwise → DashboardView
 */
export default function GameDashboardPage() {
  const data = useDashboardData();
  const {
    user,
    authLoading,
    loading,
    creating,
    error,
    player,
    handleCreatePlayer,
    handleSetName,
  } = data;

  let content: React.ReactNode;
  if (authLoading || loading) {
    content = (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  } else if (!user) {
    content = <SignedOutLanding />;
  } else if (!player) {
    content = (
      <CreatePlayerGate
        creating={creating}
        error={error}
        onCreate={handleCreatePlayer}
      />
    );
  } else if (!player.displayName) {
    // Legacy gate: players who spawned before names were required.
    content = <NameYourGeneralGate error={error} onSave={handleSetName} />;
  } else {
    content = <DashboardView player={player} data={data} />;
  }

  // The FAB rides on top of every state — even pre-auth — so the 3D
  // fly-around is one click away from anywhere in /game.
  return (
    <>
      {content}
      {!authLoading && <WorldMapFab />}
    </>
  );
}
