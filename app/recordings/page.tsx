/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import {
  BadgeCheck,
  Clock3,
  Filter,
  ListVideo,
  Tag,
  UsersRound,
} from "lucide-react";
import {
  filterPairRecordings,
  formatPairRecordingDuration,
  getPairRecordingDifficulties,
  getPairRecordingTopics,
  getPublishedPairRecordings,
} from "@/lib/pair-recordings";

interface RecordingsPageProps {
  searchParams: Promise<{ topic?: string; difficulty?: string }>;
}

export default async function RecordingsPage({ searchParams }: RecordingsPageProps) {
  const { topic, difficulty } = await searchParams;
  const recordings = filterPairRecordings({ topic, difficulty });
  const topics = getPairRecordingTopics();
  const difficulties = getPairRecordingDifficulties();
  const totalRecordings = getPublishedPairRecordings().length;

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <section className="border-b border-neutral-200 bg-white px-6 py-12 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <ListVideo className="h-4 w-4" aria-hidden="true" />
            Pair Session Recordings
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <h1 className="max-w-3xl text-3xl font-bold text-neutral-950 dark:text-white md:text-5xl">
                Learn from real Cursor pair programming sessions
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-700 dark:text-neutral-300 md:text-lg">
                Browse approved session highlights by topic and difficulty, with
                timestamped chapters and the Cursor skills practiced in each pair.
              </p>
            </div>

            <aside className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Library status
              </p>
              <dl className="mt-4 grid gap-3 text-sm">
                <LibraryMetric
                  icon={<ListVideo className="h-4 w-4" aria-hidden="true" />}
                  label="Approved sessions"
                  value={String(totalRecordings)}
                />
                <LibraryMetric
                  icon={<Tag className="h-4 w-4" aria-hidden="true" />}
                  label="Topics"
                  value={String(topics.length)}
                />
                <LibraryMetric
                  icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                  label="Consent state"
                  value="Approved"
                />
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filters
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/recordings" active={!topic && !difficulty}>
              All
            </FilterLink>
            {topics.map((recordingTopic) => (
              <FilterLink
                key={recordingTopic}
                href={`/recordings?topic=${encodeURIComponent(recordingTopic)}`}
                active={topic === recordingTopic}
              >
                {recordingTopic}
              </FilterLink>
            ))}
            {difficulties.map((recordingDifficulty) => (
              <FilterLink
                key={recordingDifficulty}
                href={`/recordings?difficulty=${recordingDifficulty}`}
                active={difficulty === recordingDifficulty}
              >
                {recordingDifficulty}
              </FilterLink>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {recordings.map((recording) => (
            <article
              key={recording.id}
              className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {recording.topic}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold capitalize text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {recording.difficulty}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-foreground">
                {recording.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {recording.summary}
              </p>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <LibraryMetric
                  icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                  label="Duration"
                  value={formatPairRecordingDuration(recording.durationMinutes)}
                />
                <LibraryMetric
                  icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
                  label="Pair"
                  value={`${recording.participants.length} people`}
                />
                <LibraryMetric
                  icon={<ListVideo className="h-4 w-4" aria-hidden="true" />}
                  label="Chapters"
                  value={String(recording.chapters.length)}
                />
              </dl>

              <Link
                href={`/recordings/${recording.id}`}
                className="mt-6 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Open recording
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors",
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Link>
  );
}

function LibraryMetric({
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
