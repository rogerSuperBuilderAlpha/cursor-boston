/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Calendar, Trophy, Users, Video } from "lucide-react";
import {
  SUMMER_COHORT_DEMO_DAY,
  SUMMER_COHORT_IMMERSION,
  SUMMER_COHORT_MEETING_CADENCE,
  SUMMER_COHORT_PHILOSOPHY,
  SUMMER_COHORT_WEEKS,
} from "@/lib/summer-cohort";

export function CohortProgramBreakdown() {
  return (
    <section
      aria-labelledby="cohort-program-heading"
      className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h3
        id="cohort-program-heading"
        className="text-base font-semibold"
      >
        What the cohort looks like
      </h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Six weeks, one shared mission. Here&apos;s the week-by-week structure
        accepted participants will work through.
      </p>

      <ol className="mt-5 space-y-3">
        {SUMMER_COHORT_WEEKS.map((week) => (
          <li
            key={week.week}
            className="flex gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {week.week}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">{week.title}</h4>
                {week.winnerCert ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <Trophy className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                    Winner: {week.winnerCert} (LinkedIn cert)
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {week.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-5 flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <Video
          className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span>{SUMMER_COHORT_MEETING_CADENCE}</span>
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            {SUMMER_COHORT_IMMERSION.label}
          </div>
          <p className="mt-1 text-sm font-semibold">
            {SUMMER_COHORT_IMMERSION.title}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {SUMMER_COHORT_IMMERSION.description}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <Users className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            Closing
          </div>
          <p className="mt-1 text-sm font-semibold">
            {SUMMER_COHORT_DEMO_DAY.title}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {SUMMER_COHORT_DEMO_DAY.description}
          </p>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-sm italic text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        {SUMMER_COHORT_PHILOSOPHY}
      </p>
    </section>
  );
}
