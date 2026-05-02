/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Calendar, ExternalLink, Sparkles, Video } from "lucide-react";
import {
  SUMMER_COHORT_C1_WEEK_4,
  SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER,
} from "@/lib/summer-cohort";

export function Week4LudwittPanel() {
  const week = SUMMER_COHORT_C1_WEEK_4;
  const zoomUrl = SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER;

  return (
    <section
      role="tabpanel"
      id="tabpanel-week-4"
      aria-labelledby="tab-week-4"
      className="rounded-xl border-2 border-emerald-400 bg-white p-6 dark:border-emerald-700 dark:bg-neutral-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Cohort 1 · Week 4
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          Different format — no vote
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
          We walk through what makes a Ludwitt-mergeable tool, the technical
          requirements, and the revenue-share mechanics.
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

      {/* How week 4 differs */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          How this week is different
        </h3>
        <ul className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>No vote, no presentations.</strong> Every shipped + merged
              tool counts.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>You earn revenue per use.</strong> When users consume
              Ludwitt credits via your tool, you take a revenue share — every
              shipped tool earns its author fees in perpetuity.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>Submission target = Ludwitt.</strong> You open a PR
              against the Ludwitt repo (not this one). Mergeability is the
              acceptance criterion.
            </span>
          </li>
        </ul>
      </div>

      {/* Submission */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Submission mechanics
        </div>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          The Ludwitt PR template, accepted-tool spec, and revenue-share terms
          will be finalized at the Mon Jun 1 kickoff. By then you&apos;ll know
          how the cohort PM tool, comms platform, and marketing site (built in
          weeks 1–3) play into the workflow.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          This section will be filled in before the week opens.
        </p>
      </div>

      {/* Deadline */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
        <Calendar
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Target merge — {week.deadlineLabel}
          </p>
          <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90">
            Aim to have your PR mergeable by Friday. We&apos;ll batch-merge
            qualifying tools through the weekend.
          </p>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        You don&apos;t have to submit. If you&apos;d rather use this week to
        push your own startup project (week 5&apos;s theme) early, that&apos;s
        fine — just heads-up that revenue share only triggers on accepted
        merges.
      </p>
    </section>
  );
}
