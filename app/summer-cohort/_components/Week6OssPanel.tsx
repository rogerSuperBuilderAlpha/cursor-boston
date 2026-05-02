/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { ExternalLink, GitMerge, Trophy, Video } from "lucide-react";
import {
  SUMMER_COHORT_C1_WEEK_6,
  SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER,
  SUMMER_COHORT_DEMO_DAY,
} from "@/lib/summer-cohort";

export function Week6OssPanel() {
  const week = SUMMER_COHORT_C1_WEEK_6;
  const zoomUrl = SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER;

  return (
    <section
      role="tabpanel"
      id="tabpanel-week-6"
      aria-labelledby="tab-week-6"
      className="rounded-xl border-2 border-emerald-400 bg-white p-6 dark:border-emerald-700 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Cohort 1 · Week 6 — Final
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <GitMerge
            className="h-3 w-3"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          One submission: a merged upstream PR
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {week.title}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {week.oneLiner}
      </p>

      {/* Kickoff */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Video className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Kickoff Zoom
        </div>
        <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {week.kickoffLabel}
        </p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          Targeting strategy: how to pick a project, find a tractable issue,
          submit a clean PR, and get it through review without burning a week.
        </p>
        <a
          href={zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          <Video className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          Join the Zoom
          <ExternalLink
            className="h-3.5 w-3.5"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </a>
      </div>

      {/* What you do */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          What you do
        </h3>
        <ol className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                Pick a major OSS project
              </p>
              <p className="mt-0.5">
                Something with real distribution — a popular framework, dev
                tool, or library. Not your own side project.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                Land a merged PR
              </p>
              <p className="mt-0.5">
                A doc fix counts if it&apos;s a real one. A feature counts.
                Anything &quot;good first issue&quot; counts. Bar is the
                upstream maintainer hits Merge.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                Bring the merged-PR URL to demo day
              </p>
              <p className="mt-0.5">
                That&apos;s the submission. No JSON file, no PR to this repo.
                Just the upstream PR link, ready to share.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* Demo day */}
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
          <Trophy
            className="h-3.5 w-3.5"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          Demo day — {week.demoDayLabel}
        </div>
        <p className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          {SUMMER_COHORT_DEMO_DAY.title}
        </p>
        <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-200/90">
          {SUMMER_COHORT_DEMO_DAY.description}
        </p>
        <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-200/90">
          Friday is graduation. Bring your week-6 PR plus highlights from the
          full 6 weeks — what you built, what you learned, what you&apos;re
          shipping next.
        </p>
      </div>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        Couldn&apos;t land a PR? Come anyway. Demo day isn&apos;t gated on the
        OSS PR — it&apos;s the wrap-up for the whole cohort.
      </p>
    </section>
  );
}
