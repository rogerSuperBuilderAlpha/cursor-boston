/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  formatRunDate,
  getRunTitle,
  isActiveRun,
  STATUS_STYLES,
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
    <aside className="rounded-3xl border border-neutral-800 bg-neutral-950/85 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-neutral-400">
            Runs
          </h2>
          <p className="mt-1 text-xs text-neutral-500">Newest first</p>
        </div>
        {loadingState === "polling" && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            Live sync
          </span>
        )}
      </div>

      {showSkeletons ? (
        <div className="flex gap-3 overflow-x-auto pb-1 lg:block lg:space-y-3 lg:overflow-visible">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 min-w-[15rem] animate-pulse rounded-2xl border border-neutral-800 bg-neutral-900 lg:min-w-0"
            />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">
          No runs yet. Start with the launch panel and your first run will land here.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 lg:block lg:space-y-3 lg:overflow-visible">
          {runs.map((run) => {
            const active = isActiveRun(run.status);
            const selected = selectedRunId === run.id;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className={`min-w-[16rem] rounded-2xl border p-4 text-left transition-colors lg:min-w-0 ${
                  selected
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-neutral-800 bg-neutral-900/70 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{getRunTitle(run)}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatRunDate(run.createdAt)}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLES[run.status]}`}
                  >
                    {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                    {run.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
