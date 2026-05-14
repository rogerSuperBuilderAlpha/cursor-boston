/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { ActionProgress } from "../../_lib/dashboard-types";

interface ExploreFrontierProps {
  count: number;
  onCountChange: (n: number) => void;
  busy: boolean;
  progress: ActionProgress | null;
  maxCount: number;
  onExplore: () => void;
}

/**
 * Inline widget for bulk frontier-explore (claim N adjacent unrevealed
 * tiles in one transaction). 1 turn per tile, 3% artifact roll per
 * spend. Only rendered in the "play" phase.
 */
export function ExploreFrontier({
  count,
  onCountChange,
  busy,
  progress,
  maxCount,
  onExplore,
}: ExploreFrontierProps) {
  const safeMax = Math.max(1, maxCount);
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div
      id="frontier-explore"
      className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 scroll-mt-24"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Push the frontier</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        Spend turns to claim brand-new tiles adjacent to your territory. The
        further you push, the more likely your next tile spawns next to enemy
        ground. Every spent turn rolls a 3% chance for an artifact.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Tiles to claim:{" "}
          <input
            type="number"
            min={1}
            max={Math.min(50, safeMax)}
            value={count}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) onCountChange(n);
            }}
            disabled={busy}
            className="w-20 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={onExplore}
          disabled={busy || safeMax < 1}
          className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Pushing the frontier (${count} tile${count === 1 ? "" : "s"})…`
            : `Explore ×${count}`}
        </button>
        <span className="text-xs text-neutral-500">
          (you have {safeMax} turn{safeMax === 1 ? "" : "s"} available)
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-emerald-100 dark:bg-emerald-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles claimed
            </span>
            <span>
              {progress.artifactsFound} artifact
              {progress.artifactsFound === 1 ? "" : "s"} found
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
