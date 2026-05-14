/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { LandType } from "@/lib/game/types";
import type { ActionProgress } from "../../_lib/dashboard-types";

interface BulkDistributeProps {
  unassignedCount: number;
  turnsRemaining: number;
  type: LandType;
  onTypeChange: (t: LandType) => void;
  count: number;
  onCountChange: (n: number) => void;
  busy: boolean;
  progress: ActionProgress | null;
  onRun: () => void;
}

/**
 * Bulk-assign unassigned lands to a single role. Caps at min(unassigned,
 * turnsRemaining). One turn per tile, 3% artifact per spend. Only
 * rendered when the player has unassigned tiles.
 */
export function BulkDistribute({
  unassignedCount,
  turnsRemaining,
  type,
  onTypeChange,
  count,
  onCountChange,
  busy,
  progress,
  onRun,
}: BulkDistributeProps) {
  const max = Math.min(unassignedCount, turnsRemaining);
  const safeCount = Math.max(1, Math.min(max || 1, Math.floor(count)));
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div
      id="bulk-distribute"
      className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 scroll-mt-24"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Bulk-assign land types</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        You have{" "}
        <strong>
          {unassignedCount} unassigned tile{unassignedCount === 1 ? "" : "s"}
        </strong>
        . Pick a role and a count, and the next N unassigned tiles will be
        assigned to that role one at a time. Each assignment costs 1 turn and
        rolls a 3% chance for an artifact.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Assign:{" "}
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as LandType)}
            disabled={busy}
            className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent capitalize"
          >
            <option value="military">military</option>
            <option value="food">food</option>
            <option value="magic">magic</option>
          </select>
        </label>
        <label className="text-sm">
          Count:{" "}
          <input
            type="number"
            min={1}
            max={Math.max(1, max)}
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
          onClick={onRun}
          disabled={busy || max === 0}
          className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Assigning ${safeCount} tiles…`
            : `Assign ${safeCount} → ${type}`}
        </button>
        <span className="text-xs text-neutral-500">
          (cap: {max} — limited by turns or unassigned tiles)
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-amber-100 dark:bg-amber-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles assigned
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
