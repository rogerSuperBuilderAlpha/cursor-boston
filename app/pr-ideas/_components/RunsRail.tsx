/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  displayState,
  displayStateLabel,
  formatRunDate,
  getRunTitle,
  DISPLAY_STATE_DOT,
  DISPLAY_STATE_RAIL_TEXT,
  type CursorIdeaRun,
  type LoadingState,
} from "../_lib/types";

interface RunsRailProps {
  runs: CursorIdeaRun[];
  selectedRunId: string | null;
  loadingState: LoadingState;
  onSelect: (runId: string) => void;
}

export function RunsRail({ runs, selectedRunId, loadingState, onSelect }: RunsRailProps) {
  const showSkeletons = loadingState === "initial" && runs.length === 0;

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-background/90 p-3 dark:border-neutral-800 dark:bg-neutral-950/85 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Runs
        </h2>
        {loadingState === "polling" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-300" />
            Live
          </span>
        )}
      </div>

      {showSkeletons ? (
        <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-16 min-w-[14rem] animate-pulse rounded-xl border border-neutral-800 bg-neutral-900 lg:min-w-0"
            />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-400">
          No runs yet. Launch one to see it here.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible">
          {runs.map((run) => {
            const derived = displayState(run);
            const pulse = derived === "running";
            const selected = selectedRunId === run.id;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className={`block w-full min-w-[14rem] rounded-xl border p-2.5 text-left transition-colors lg:min-w-0 ${
                  selected
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-neutral-200 bg-neutral-100/80 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:border-neutral-700"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DISPLAY_STATE_DOT[derived]} ${pulse ? "animate-pulse" : ""}`}
                    title={displayStateLabel(derived)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground" title={getRunTitle(run)}>
                      {getRunTitle(run)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] text-neutral-500">
                      <span className={DISPLAY_STATE_RAIL_TEXT[derived]}>{displayStateLabel(derived)}</span>
                      <span>·</span>
                      <span>{formatRunDate(run.createdAt)}</span>
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
