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

interface InfoTabPanelProps {
  cohort1Count: number;
}

export function InfoTabPanel({ cohort1Count }: InfoTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id="tabpanel-info"
      aria-labelledby="tab-info"
      className="space-y-6"
    >
      {/* Top: at-a-glance */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">How the cohort works</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {SUMMER_COHORT_PHILOSOPHY}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Users className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              In your cohort
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{cohort1Count}</p>
            <p className="mt-0.5 text-xs text-neutral-500">people in Cohort 1</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              Program length
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">6</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              weeks · May 11 → Jun 19
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Video className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              Cadence
            </div>
            <p className="mt-1 text-sm font-semibold leading-tight">
              Twice-weekly Zoom
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {SUMMER_COHORT_MEETING_CADENCE.replace(/\.$/, "")}
            </p>
          </div>
        </div>
      </section>

      {/* Week-by-week */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-base font-semibold">Six weeks at a glance</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Click any week tab above for the full kickoff / submission /
          voting-call detail.
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
                      <Trophy
                        className="h-3 w-3"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
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
      </section>

      {/* Calendar anchors: immersion + demo day */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-base font-semibold">Anchor events</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Two dates that bracket the program. Block them on your calendar.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Calendar
                className="h-3.5 w-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {SUMMER_COHORT_IMMERSION.label}
            </div>
            <p className="mt-1 text-sm font-semibold">
              {SUMMER_COHORT_IMMERSION.title}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {SUMMER_COHORT_IMMERSION.description}
            </p>
            <a
              href={SUMMER_COHORT_IMMERSION.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 underline decoration-emerald-600/60 underline-offset-2 hover:decoration-emerald-600 dark:text-emerald-400"
            >
              RSVP on Luma →
            </a>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <Users
                className="h-3.5 w-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              Fri, Jun 19 — closing
            </div>
            <p className="mt-1 text-sm font-semibold">
              {SUMMER_COHORT_DEMO_DAY.title}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {SUMMER_COHORT_DEMO_DAY.description}
            </p>
          </div>
        </div>
      </section>

      {/* Winner commitments — preserved verbatim from the legacy card. */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-base font-semibold">If you win a week-1/2/3 vote</h3>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          Winners ship their platform somewhere public for the rest of the
          cohort to use, deal with real users (your fellow participants), and
          submit a short demo video at showcase time.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>Hosting at $0.</strong> At cohort scale (~100 users), every
            major free tier (Vercel, Netlify, Cloudflare Pages, Supabase,
            Neon, etc.) keeps you at $0 if you stay inside the limits. We
            don&apos;t reimburse hosting bills if you blow them.
          </li>
          <li>
            <strong>Domain.</strong> We&apos;ll hand you a{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
              yourthing.cursorboston.com
            </code>{" "}
            subdomain — no DNS service to buy.
          </li>
          <li>
            <strong>Real users are part of the value.</strong> Whatever you
            build will have actual users (your cohort). Operating it —
            answering questions, shipping fixes, deciding what&apos;s next —
            is part of the educational experience.
          </li>
          <li>
            <strong>You own the code.</strong> Win or not, the repo is yours.
            Keep it private, open it, evolve it.
          </li>
          <li>
            <strong>Submitting to win is optional.</strong> Build, vote, and
            attend everything without putting yourself up. You don&apos;t lose
            anything — just skip the &quot;submit to win&quot; step.
          </li>
        </ul>
      </section>
    </div>
  );
}
