/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import {
  CalendarDays,
  Code2,
  ListChecks,
  Trophy,
} from "lucide-react";
import {
  MONTHLY_CHALLENGES,
  getChallengeRubricTotal,
  getCurrentChallenge,
} from "@/lib/monthly-challenges";

export default function MonthlyChallengesPage() {
  const current = getCurrentChallenge();

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <section className="border-b border-neutral-200 bg-white px-6 py-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Monthly Code Challenge
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <h1 className="max-w-3xl text-3xl font-bold text-foreground md:text-5xl">
                Small builds that showcase Cursor workflows
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400 md:text-lg">
                Each month has a focused prompt, a line limit, and a rubric for
                AI-assisted engineering craft.
              </p>
            </div>
            <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Current challenge
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                {current.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {current.summary}
              </p>
              <Link
                href={`/challenges/${current.id}`}
                className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                View current challenge
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-5 md:grid-cols-2">
          {MONTHLY_CHALLENGES.map((challenge) => (
            <article
              key={challenge.id}
              className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {challenge.monthLabel}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {challenge.status === "current" ? "Current" : "Archive"}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-foreground">
                {challenge.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {challenge.summary}
              </p>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <ChallengeMetric
                  icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                  label="Window"
                  value={challenge.submissionWindow}
                />
                <ChallengeMetric
                  icon={<Code2 className="h-4 w-4" aria-hidden="true" />}
                  label="Limit"
                  value={`${challenge.maxLines} lines`}
                />
                <ChallengeMetric
                  icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
                  label="Rubric"
                  value={`${getChallengeRubricTotal(challenge)} pts`}
                />
              </dl>

              <Link
                href={`/challenges/${challenge.id}`}
                className="mt-6 inline-flex rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Open challenge
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ChallengeMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-950">
      <dt className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
