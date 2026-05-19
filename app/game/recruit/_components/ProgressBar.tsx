/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { RecruitProgress } from "../_lib/types";

export function ProgressBar({ progress }: { progress: RecruitProgress }) {
  const pct = Math.round(
    (progress.done / Math.max(1, progress.total)) * 100
  );
  return (
    <div className="mt-4 space-y-1">
      <div className="h-2 w-full bg-emerald-100 dark:bg-emerald-950/40 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
        <span>
          {progress.done} / {progress.total} cycles ·{" "}
          {progress.unitsBuilt} units trained
        </span>
        <span>
          {progress.artifactsFound} artifact
          {progress.artifactsFound === 1 ? "" : "s"} found
        </span>
      </div>
    </div>
  );
}
