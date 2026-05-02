/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { ExternalLink, Rocket, Video } from "lucide-react";
import {
  SUMMER_COHORT_C1_WEEK_5,
  SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER,
} from "@/lib/summer-cohort";

export function Week5StartupPanel() {
  const week = SUMMER_COHORT_C1_WEEK_5;
  const zoomUrl = SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER;

  return (
    <section
      role="tabpanel"
      id="tabpanel-week-5"
      aria-labelledby="tab-week-5"
      className="rounded-xl border-2 border-emerald-400 bg-white p-6 dark:border-emerald-700 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Cohort 1 · Week 5
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Rocket className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          Open week — your call
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
          We share-out what we&apos;re each working on this week. Quick
          round-the-room: 60 seconds each — what you&apos;re building, what
          help you need.
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

      {/* What this week is */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          What this week is
        </h3>
        <ul className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>Build whatever YOU want.</strong> Your own startup
              project. The thing you&apos;d be working on if the cohort
              didn&apos;t exist.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>No vote. No template. No PR to this repo.</strong> The
              cohort tools (PM, comms, marketing) are still running — use them
              to ship faster.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>Friday show-and-tell at {week.showAndTellLabel}.</strong>{" "}
              Each person gets ~3 minutes. No formal pitch — just &quot;here&apos;s
              what I built and what I&apos;m doing next.&quot; Optional.
            </span>
          </li>
        </ul>
      </div>

      {/* What good looks like */}
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
          What &quot;good&quot; looks like for this week
        </div>
        <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-200/90">
          End the week with something you can show — a working prototype, a
          landing page with real signups, a public alpha. The bar is &quot;I
          shipped something I&apos;m proud of,&quot; not &quot;I won a
          vote.&quot;
        </p>
      </div>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        Stuck on what to build? Bring it to office hours or post in the cohort
        channel. The cohort is a great free pair of eyes for this.
      </p>
    </section>
  );
}
