/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Eye } from "lucide-react";
import {
  type SummerCohortRuntime,
  type SummerCohortId,
} from "@/lib/summer-cohort";
import { WeekSubmissionsCollapsible } from "./WeekSubmissionsCollapsible";

interface ObserverCohortPanelProps {
  runtime: SummerCohortRuntime;
  /** When set, the panel renders an explanation pointing back to the user's
   *  own admitted cohort. Lets us tell the difference between "you're a c1
   *  member peeking at c2" and "you're not in any cohort, just browsing". */
  memberCohortLabel?: string;
  /** Logged-in user's GitHub login — passed through to the submissions list
   *  for back-compat with the shared component, but observer mode ignores it
   *  for "is mine" / submit affordances. */
  currentUserGithubHandle: string | null;
  currentUserDisplayName: string | null;
  currentUserPhotoUrl: string | null;
}

export function ObserverCohortPanel({
  runtime,
  memberCohortLabel,
  currentUserGithubHandle,
  currentUserDisplayName,
  currentUserPhotoUrl,
}: ObserverCohortPanelProps) {
  return (
    <section className="mt-4 space-y-6">
      <div className="rounded-xl border border-sky-300 bg-sky-50 p-5 dark:border-sky-800 dark:bg-sky-950/30">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
          <Eye className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          Observer view — {runtime.label}
        </div>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {memberCohortLabel ? (
            <>
              You&apos;re admitted to <strong>{memberCohortLabel}</strong>, not{" "}
              <strong>{runtime.label}</strong>. You can browse{" "}
              {runtime.label}&apos;s vote-week submissions below, read-only.
              Voting and submitting are members-only.
            </>
          ) : (
            <>
              You&apos;re not admitted to <strong>{runtime.label}</strong>.
              You can browse the vote-week submissions below, read-only.
              Voting and submitting are members-only.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          Kickoff: {runtime.kickoffLabel}. Weeks 4–6 don&apos;t use the
          submission-PR format, so they&apos;re not shown here.
        </p>
      </div>

      {runtime.voteWeeks.map((week) => (
        <div key={week.submissionBranch}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Week {week.week}: {week.title}
          </h3>
          <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
            Kickoff {week.kickoffLabel} · Deadline {week.deadlineLabel}
          </p>
          <WeekSubmissionsCollapsible
            week={week}
            tabId={`week-${week.week}`}
            cohortId={runtime.cohortId as SummerCohortId}
            currentUserGithubHandle={currentUserGithubHandle}
            currentUserDisplayName={currentUserDisplayName}
            currentUserPhotoUrl={currentUserPhotoUrl}
            onSwitchToMyInfo={() => {
              /* no-op: observer view has no my-info tab to switch to */
            }}
            observer
          />
        </div>
      ))}
    </section>
  );
}
