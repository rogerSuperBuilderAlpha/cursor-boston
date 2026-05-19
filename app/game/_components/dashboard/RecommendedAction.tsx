/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { GamePlayer } from "@/lib/game/types";
import type { Recommendation } from "../../_lib/dashboard-types";

interface RecommendedActionProps {
  rec: Recommendation;
  phase: GamePlayer["phase"];
}

/**
 * The "Recommended next" callout — the dashboard's single biggest piece
 * of UX. Computed by `recommendNext()` based on phase + counts + shield
 * + threats; either links to another game page or scrolls to an inline
 * widget on the dashboard.
 */
export function RecommendedAction({ rec, phase }: RecommendedActionProps) {
  const accentClass =
    rec.tone === "primary"
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/10"
      : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30";
  return (
    <div className={`rounded-xl border ${accentClass} p-5 mb-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
            Recommended next · {phase} phase
          </div>
          <h2 className="text-lg font-semibold mb-1">{rec.title}</h2>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {rec.body}
          </p>
        </div>
        {rec.ctaHref ? (
          <Link
            href={rec.ctaHref}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm whitespace-nowrap"
          >
            {rec.ctaLabel}
          </Link>
        ) : rec.scrollTo ? (
          <a
            href={`#${rec.scrollTo}`}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm whitespace-nowrap"
          >
            {rec.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
