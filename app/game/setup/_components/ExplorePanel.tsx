/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import type { BatchProgress, RevealLog } from "../_lib/types";
import { RevealLogList } from "./RevealLogList";

interface Props {
  player: GamePlayer;
  tiles: MapTile[];
  busy: boolean;
  recentReveals: RevealLog[];
  batchProgress: BatchProgress | null;
  onExploreBatch: (count: number) => void;
}

export function ExplorePanel({
  player,
  tiles,
  busy,
  recentReveals,
  batchProgress,
  onExploreBatch,
}: Props) {
  const unrevealed = tiles.filter((t) => t.type === "unrevealed").length;
  const [batchInput, setBatchInput] = useState<string>("10");
  const parsedBatch = Math.max(
    1,
    Math.min(
      Math.min(unrevealed, player.turnsRemaining, 100),
      Number.parseInt(batchInput, 10) || 1
    )
  );
  const noTurns = player.turnsRemaining < 1;
  const allRevealed = unrevealed === 0;

  return (
    <div>
      <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
        <p className="font-semibold mb-1">Step 1 of 3 — Explore</p>
        <p>
          You spawned with 100 lands hidden under fog. Each turn spent reveals
          one of them. Use the batch input below to spend many turns at once —
          handy if you want to blast through the setup ramp quickly. Once all
          100 are revealed, you&apos;ll automatically move on to the distribute
          phase.
        </p>
      </div>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
        <strong>{unrevealed}</strong> land{unrevealed === 1 ? "" : "s"} remain
        unrevealed. You have <strong>{player.turnsRemaining}</strong> turns
        available.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <button
          onClick={() => onExploreBatch(1)}
          disabled={busy || noTurns || allRevealed}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          {busy && batchProgress?.total === 1
            ? "Revealing…"
            : "Explore 1 tile (1 turn)"}
        </button>
        <div className="flex items-end gap-2">
          <label className="block text-xs text-neutral-500">
            Batch size
            <input
              type="number"
              min={1}
              max={Math.min(unrevealed, player.turnsRemaining, 100)}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              disabled={busy}
              className="mt-1 block w-24 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 disabled:opacity-50"
            />
          </label>
          <button
            onClick={() => onExploreBatch(parsedBatch)}
            disabled={busy || noTurns || allRevealed || parsedBatch < 1}
            className="px-5 py-2.5 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
          >
            {busy && batchProgress
              ? `Revealing ${batchProgress.done} / ${batchProgress.total}…`
              : `Explore ${parsedBatch} tile${parsedBatch === 1 ? "" : "s"} (${parsedBatch} turn${parsedBatch === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>

      <RevealLogList reveals={recentReveals} />
    </div>
  );
}
