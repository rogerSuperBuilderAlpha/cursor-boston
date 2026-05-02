/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  Calendar,
  ExternalLink,
  Lightbulb,
  Trophy,
  Video,
} from "lucide-react";
import {
  SUMMER_COHORT_C1_WEEK_1,
  SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER,
  type SummerCohortVoteWeek,
} from "@/lib/summer-cohort";
import { WeekSubmissionsCollapsible } from "./WeekSubmissionsCollapsible";

const PRESENT_MINUTES = SUMMER_COHORT_C1_WEEK_1.presentMinutes;
const TOP_N = SUMMER_COHORT_C1_WEEK_1.topNFromAi;
const WILDCARDS = SUMMER_COHORT_C1_WEEK_1.wildcardSlots;

interface WeekVotePanelProps {
  week: SummerCohortVoteWeek;
  tabId: string;
  /** Lower-cased GitHub handle of the signed-in user, if connected — used by
   *  the submissions collapsible to render "you're submitted" status. */
  currentUserGithubHandle: string | null;
  /** Display name from the user's Cursor Boston profile (userProfile.displayName). */
  currentUserDisplayName: string | null;
  /** Photo URL from the user's Cursor Boston profile (userProfile.photoURL). */
  currentUserPhotoUrl: string | null;
  /** Switches the parent CohortTabs to "my-info" so the user can connect GitHub. */
  onSwitchToMyInfo: () => void;
}

export function WeekVotePanel({
  week,
  tabId,
  currentUserGithubHandle,
  currentUserDisplayName,
  currentUserPhotoUrl,
  onSwitchToMyInfo,
}: WeekVotePanelProps) {
  const zoomUrl = SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER;

  return (
    <section
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className="rounded-xl border-2 border-emerald-400 bg-white p-6 dark:border-emerald-700 dark:bg-neutral-900"
    >
      {/* Kickoff Zoom — top of the module */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Video className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Kickoff Zoom · {week.kickoffLabel}
        </div>
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
        <p className="mt-2 text-xs text-neutral-500">
          Stand-in link — we&apos;ll swap in the real Zoom URL before kickoff.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Cohort 1 · Week {week.week}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {week.deadlineLabel.split("·")[0]?.trim()} deadline
        </span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {week.title}
      </h2>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {week.oneLiner}
      </p>

      {week.weekNotes ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <strong>Note:</strong> {week.weekNotes}
        </div>
      ) : null}

      {/* Submissions list (collapsible) — the focus of the week */}
      <div className="mt-6">
        <WeekSubmissionsCollapsible
          week={week}
          tabId={tabId}
          currentUserGithubHandle={currentUserGithubHandle}
          currentUserDisplayName={currentUserDisplayName}
          currentUserPhotoUrl={currentUserPhotoUrl}
          onSwitchToMyInfo={onSwitchToMyInfo}
        />
      </div>

      {/* Inspiration */}
      {week.inspirationPlatforms.length > 0 ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <Lightbulb
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            Inspiration — what to study, not rebuild
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {week.inspirationScopeNote}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            {week.inspirationPlatforms.map((platform) => (
              <li
                key={platform.name}
                className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <a
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
                >
                  {platform.name}
                  <ExternalLink
                    className="ml-1 inline-block h-3 w-3"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </a>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {platform.takeaway}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Deadline */}
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
        <Calendar
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Deadline — {week.deadlineLabel}
          </p>
          <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90">
            Your PR must be open with all required URLs filled in by 5pm Friday.
            Late PRs don&apos;t qualify for the win, but you&apos;re still
            welcome to ship.
          </p>
        </div>
      </div>

      {/* Voting call */}
      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <Trophy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Voting call — {week.votingCallLabel}
        </div>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              Top <strong>{TOP_N}</strong> AI-scored submissions present
              automatically.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              <strong>{WILDCARDS}</strong> wildcard slots — self-nominate live on
              the call.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              Each presenter gets <strong>{PRESENT_MINUTES} minutes</strong> to
              pitch why they should win.{" "}
              <strong>No demo on the call</strong> — the cohort can watch your
              Loom and try your live URL on the site once submissions are
              merged.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-neutral-400" aria-hidden="true">•</span>
            <span>
              AI ranking is a starting point — the cohort vote on the call picks
              the winner.
            </span>
          </li>
        </ul>
        <a
          href={zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Video className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Voting-call Zoom (same link)
        </a>
      </div>

      {/* Winner commitment */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <Trophy
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            If you win
          </p>
          <p className="mt-0.5 text-emerald-900/90 dark:text-emerald-200/90">
            {week.winnerCommitment}
          </p>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        Submitting to win is optional. Build and ship without putting yourself
        up for the vote — you still get the kickoff, the cohort, and demo day.
      </p>
    </section>
  );
}
