/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CreatePlayerGate } from "./_components/dashboard/CreatePlayerGate";
import { DashboardView } from "./_components/dashboard/DashboardView";
import { NameYourGeneralGate } from "./_components/dashboard/NameYourGeneralGate";
import { SignedOutLanding } from "./_components/dashboard/SignedOutLanding";
import { useDashboardData } from "./_lib/use-dashboard-data";

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
      <CreatePlayerGate
        creating={creating}
        error={error}
        onCreate={handleCreatePlayer}
      />
    );
  }

  // Legacy gate: players who spawned before names were required.
  if (!player.displayName) {
    return <NameYourGeneralGate error={error} onSave={handleSetName} />;
  }

  return <DashboardView player={player} data={data} />;
}
