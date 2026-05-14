/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { GitPullRequest, Sparkles, Trophy, ExternalLink } from "lucide-react";
import {
  SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL,
  SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS,
  isWithinSummerCohortC1AutoAdmitWindow,
} from "@/lib/summer-cohort";

const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const FIRST_CONTRIB_URL = `${REPO_URL}/blob/develop/docs/FIRST_CONTRIBUTION.md`;
const ISSUES_URL = `${REPO_URL}/issues`;

/**
 * Shown to pending Cohort 1 applicants while we're inside the
 * auto-admit-on-PR-merge window (≤ May 9, 2026 11:59pm ET).
 *
 * The actual promotion happens server-side: when GitHub fires a `pull_request
 * closed + merged` webhook on the community repo, the webhook calls
 * `maybeAutoAdmitOnPRMerge`, which flips a matching pending application to
 * admitted. This card is the user-facing surface for that flow.
 */
export function ClaimSpotByPRCard() {
  if (!isWithinSummerCohortC1AutoAdmitWindow()) return null;

  const deadlineDate = new Date(SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS);
  const deadlineIso = deadlineDate.toISOString();

  return (
    <section className="mt-6 rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-emerald-50/40 p-6 shadow-sm dark:border-amber-700 dark:from-amber-950/30 dark:to-emerald-950/20">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        Claim your spot now
      </div>
      <h3 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Skip the queue — get a PR merged by{" "}
        <time dateTime={deadlineIso}>
          {SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL}
        </time>
      </h3>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        Get one PR merged into the community repo before the deadline and
        you&apos;re <strong>auto-admitted to Cohort 1 immediately</strong> —
        no need to wait for the May 10 admit round. The next time you load
        this page, your status will read <em>Admitted</em>.
      </p>

      <ol className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
            1
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              Pick something to ship
            </p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              Open issues are a good shopping list. Or fix a typo, tighten a
              doc, polish a component — small + correct beats big + half-done.
            </p>
            <p className="mt-2 flex flex-wrap gap-3 text-xs">
              <a
                href={ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline decoration-emerald-600/60 underline-offset-2 hover:decoration-emerald-600 dark:text-emerald-400"
              >
                Browse open issues
                <ExternalLink
                  className="h-3 w-3"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </a>
              <a
                href={FIRST_CONTRIB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline decoration-emerald-600/60 underline-offset-2 hover:decoration-emerald-600 dark:text-emerald-400"
              >
                FIRST_CONTRIBUTION.md
                <ExternalLink
                  className="h-3 w-3"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </a>
            </p>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
            2
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              Open a PR against{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">
                develop
              </code>
            </p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              Sign your commits with{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">
                git commit -s
              </code>{" "}
              (DCO is required) and link any related issue.
            </p>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
            3
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              Once merged →{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                you&apos;re in
              </span>
            </p>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              The merge fires a webhook that flips your status to{" "}
              <em>Admitted</em> automatically. No email needed; no waiting on
              us. Refresh the page after the merge to see it land.
            </p>
          </div>
        </li>
      </ol>

      <a
        href={FIRST_CONTRIB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
      >
        <GitPullRequest className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Read the contributor guide
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
      </a>

      <p className="mt-4 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <Trophy
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <span>
          Even if you don&apos;t make the deadline — we&apos;re still admitting
          more people in the regular round on May 10. The PR-merge route is
          just a fast lane.
        </span>
      </p>
    </section>
  );
}
