/**
 * SPDX-License-Identifier: GPL-3.0-only
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

  // The "Open game world map" FAB lives in AppShell now so it's on
  // every page, not just /game.
  return <>{content}</>;
}
