/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

// Mirrors FAR_EXPEDITION_TURN_COST in lib/game/data-server.ts. Hardcoded
// here because the dashboard runs on the client and data-server.ts pulls
// in firebase-admin.
const FAR_EXPEDITION_TURN_COST = 2;

interface FarExpeditionProps {
  turnsRemaining: number;
  onLaunch: () => Promise<{ tileId: string; enemyTileId: string } | null>;
}

interface SuccessResult {
  tileId: string;
  enemyTileId: string;
}

/**
 * Spend 2 turns to plant a tile next to a random enemy. The tile lands
 * isolated (no friendly neighbors) so it takes the supply system's −15%
 * defense floor until you grow tiles around it.
 *
 * Networking + cache patching live in the dashboard hook
 * (`handleFarExpedition`); this component just renders + reports the
 * outcome inline.
 */
export function FarExpedition({ turnsRemaining, onLaunch }: FarExpeditionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);

  const canAfford = turnsRemaining >= FAR_EXPEDITION_TURN_COST;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await onLaunch();
      if (r) setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="far-expedition"
      className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 scroll-mt-24"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Far Expedition</h2>
        <span className="text-xs text-neutral-500">
          {FAR_EXPEDITION_TURN_COST} turns / tile
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        Plant a forward base adjacent to a random enemy tile. The new tile lands
        isolated — defense runs at the −15% supply floor until you grow friendly
        neighbors around it. Use sparingly, but it can crack a sealed kingdom.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={busy || !canAfford}
          className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy ? "Launching expedition…" : "Launch expedition"}
        </button>
        <span className="text-xs text-neutral-500">
          (you have {turnsRemaining} turn{turnsRemaining === 1 ? "" : "s"} available)
        </span>
      </div>
      {result && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          Landed at {result.tileId} beside enemy tile {result.enemyTileId}.
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
