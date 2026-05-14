/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import type { MapTile } from "@/lib/game/types";
import type { ActionProgress } from "../../_lib/dashboard-types";

type AssignableType = "military" | "food" | "magic";

interface BulkUnassignProps {
  tiles: MapTile[];
  turnsRemaining: number;
  busy: boolean;
  progress: ActionProgress | null;
  onRun: (sourceType: AssignableType, count: number) => void;
}

/**
 * Reset assigned tiles back to "unassigned" in bulk. Each revert costs
 * 1 turn (and rolls for an artifact like a fresh assignment), so this
 * is for *redistributing* the territory mix, not for fixing typos.
 */
export function BulkUnassign({
  tiles,
  turnsRemaining,
  busy,
  progress,
  onRun,
}: BulkUnassignProps) {
  const [sourceType, setSourceType] = useState<AssignableType>("military");
  const [count, setCount] = useState(5);
  const sourceCount = tiles.filter((t) => t.type === sourceType).length;
  const max = Math.min(sourceCount, turnsRemaining);
  const safeCount = Math.max(1, Math.min(max || 1, Math.floor(count)));
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div className="rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Bulk-revert tiles to unassigned</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        Reset assigned tiles back to <em>unassigned</em>. Each revert costs 1
        turn and rolls for an artifact, just like a fresh assignment.
        You&apos;ll pay another turn each to re-assign them later, so use
        this when you actually want to redistribute the territory mix.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Source type:{" "}
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as AssignableType)}
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
              if (Number.isFinite(n)) setCount(n);
            }}
            disabled={busy}
            className="w-20 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={() => onRun(sourceType, safeCount)}
          disabled={busy || max === 0}
          className="px-5 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Reverting ${safeCount} tiles…`
            : `Revert ${safeCount} ${sourceType} → unassigned`}
        </button>
        <span className="text-xs text-neutral-500">
          ({sourceCount} {sourceType} tile{sourceCount === 1 ? "" : "s"} ·
          cap {max})
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-rose-100 dark:bg-rose-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles reverted
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
