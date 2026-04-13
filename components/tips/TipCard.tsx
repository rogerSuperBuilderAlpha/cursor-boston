/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { WeeklyTip } from "@/types/tips";

interface Props {
  tip: WeeklyTip;
}

export function TipCard({ tip }: Props) {
  const date = tip.publishedAt
    ? new Date(tip.publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-lg font-bold text-foreground">{tip.title}</h3>
        {tip.category && tip.category !== "General" && (
          <span className="shrink-0 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
            {tip.category}
          </span>
        )}
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">
        {tip.content}
      </p>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>by {tip.authorName}</span>
        {date && <time dateTime={tip.publishedAt}>{date}</time>}
      </div>
    </article>
  );
}
