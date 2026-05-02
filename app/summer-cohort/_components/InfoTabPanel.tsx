/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import {
  SUMMER_COHORTS,
  SUMMER_COHORT_C1_DISCORD_INVITE_URL_PLACEHOLDER,
  SUMMER_COHORT_DEMO_DAY,
  SUMMER_COHORT_IMMERSION,
  SUMMER_COHORT_MEETING_CADENCE,
  SUMMER_COHORT_PHILOSOPHY,
  SUMMER_COHORT_WEEKS,
} from "@/lib/summer-cohort";
import { WinnerCommitmentsCard } from "./WinnerCommitmentsCard";

interface CompletedSetupApplication {
  isLocal: boolean | null;
  wantsToPresent: boolean | null;
  mayImmersionRsvped: boolean;
}

interface InfoTabPanelProps {
  cohort1Count: number;
  /** When provided, renders a small "setup recorded" summary at the top of
   *  the tab — mirrors the "done" rows previously shown in the What's-next
   *  card above the tabs, once those rows are all green. */
  application?: CompletedSetupApplication;
}

export function InfoTabPanel({ cohort1Count, application }: InfoTabPanelProps) {
  return (
    <div
      role="tabpanel"
      id="tabpanel-info"
      aria-labelledby="tab-info"
      className="space-y-6"
    >
      {application ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <CheckCircle2
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            Setup recorded
          </div>
          <ul className="mt-2 space-y-1 text-sm text-emerald-900 dark:text-emerald-200">
            <li>
              Locality: <strong>{application.isLocal ? "yes" : "no"}</strong> ·
              Comfortable presenting + maintaining if you win:{" "}
              <strong>{application.wantsToPresent ? "yes" : "no"}</strong>
            </li>
            <li>
              May 26 immersion event: <strong>RSVP confirmed</strong>
            </li>
          </ul>
        </section>
      ) : null}

      {/* Cohort Discord channel — direct join */}
      <section className="rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/5 p-4 dark:border-[#5865F2]/40 dark:bg-[#5865F2]/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5865F2]">
              <MessageCircle
                className="h-3.5 w-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              Cohort Discord
            </div>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              The cohort lives in #cohort-1 on Discord.
            </p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Day-to-day questions, build help, voting-call prep, and demos
              all happen there. Connect Discord on the My Info tab if you
              haven&apos;t — then jump in.
            </p>
          </div>
          <a
            href={SUMMER_COHORT_C1_DISCORD_INVITE_URL_PLACEHOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
          >
            Join channel
            <ExternalLink
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </a>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Stand-in invite — we&apos;ll swap in the real Discord URL before
          kickoff.
        </p>
      </section>

      {/* Dates */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Dates
        </h2>
        <ul className="mt-3 space-y-2">
          {SUMMER_COHORTS.map((cohort) => (
            <li
              key={cohort.id}
              className="rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{cohort.label}</span>
                <span className="text-xs text-neutral-600 dark:text-neutral-300">
                  {cohort.startLabel} – {cohort.endLabel}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {cohort.graduationLabel}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          First Zoom kickoffs: Cohort 1 on Mon May 11, Cohort 2 on Mon Jun 29.
          Watch your email and the Week tabs above for meeting links.
        </p>
      </section>

      {/* What to expect */}
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          What to expect
        </h2>
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          Each cohort runs <strong>six weeks</strong>, with twice-weekly Zoom
          for demos and Q&amp;A and periodic in-person sessions in Boston.
          You&apos;ll build, present, vote on each other&apos;s work, ship to
          real users, and close with a demo day in front of hiring partners.
        </p>
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          It&apos;s free. The only guarantee is the community itself — no jobs
          promised, no specific outcomes. The full week-by-week breakdown is
          in the Week tabs above.
        </p>
      </section>

      {/* How the cohort works (philosophy + at-a-glance stats) */}
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

      <WinnerCommitmentsCard />
    </div>
  );
}
