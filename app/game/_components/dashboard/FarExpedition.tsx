/**
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
  // Called after a successful far-expedition so the dashboard can refresh.
  onSuccess: () => void;
}

interface SuccessResult {
  tileId: string;
  enemyTileId: string;
}

/**
 * Spend 2 turns to plant a tile next to a random enemy. The tile lands
 * isolated (no friendly neighbors) so it takes the supply system's −15%
 * defense floor until you grow tiles around it.
 */
export function FarExpedition({ turnsRemaining, onSuccess }: FarExpeditionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);

  const canAfford = turnsRemaining >= FAR_EXPEDITION_TURN_COST;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/game/explore/far", { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        // apiError() shape is { success:false, error:{ message, code } }; some
        // older endpoints return error as a string. Handle both.
        const msg =
          (typeof body?.error === "object" && body?.error?.message) ||
          (typeof body?.error === "string" && body.error) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setResult({
        tileId: body.tile?.tileId ?? "",
        enemyTileId: body.targetEnemyTileId ?? "",
      });
      onSuccess();
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
