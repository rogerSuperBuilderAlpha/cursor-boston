/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  FileText,
  ListVideo,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  formatPairRecordingDuration,
  getPairRecordingById,
  getPairRecordingIds,
} from "@/lib/pair-recordings";

const SITE_URL = "https://cursorboston.com";

interface RecordingPageProps {
  params: Promise<{ sessionId: string }>;
}

export function generateStaticParams() {
  return getPairRecordingIds().map((sessionId) => ({ sessionId }));
}

export async function generateMetadata({
  params,
}: RecordingPageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const recording = getPairRecordingById(sessionId);

  if (!recording) {
    return { title: "Recording Not Found" };
  }

  const title = `${recording.title} | Cursor Boston Recordings`;
  const url = `${SITE_URL}/recordings/${recording.id}`;

  return {
    title,
    description: recording.summary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: recording.summary,
      type: "article",
      url,
    },
    twitter: {
      card: "summary",
      title,
      description: recording.summary,
    },
  };
}

function buildJsonLd(recording: NonNullable<ReturnType<typeof getPairRecordingById>>) {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: recording.title,
    description: recording.summary,
    url: `${SITE_URL}/recordings/${recording.id}`,
    datePublished: recording.publishedAt,
    timeRequired: `PT${recording.durationMinutes}M`,
    educationalLevel: recording.difficulty,
    teaches: recording.cursorSkills,
    about: recording.topic,
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: "Cursor Boston Pair Session Recordings",
      url: `${SITE_URL}/recordings`,
    },
    publisher: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: SITE_URL,
    },
  };
}

export default async function RecordingDetailPage({ params }: RecordingPageProps) {
  const { sessionId } = await params;
  const recording = getPairRecordingById(sessionId);

  if (!recording) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(recording)) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <ol className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <li>
            <Link href="/recordings" className="hover:text-foreground">
              Recordings
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-foreground">{recording.title}</li>
        </ol>
      </nav>

      <article className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {recording.topic}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 capitalize text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {recording.difficulty}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {recording.sessionType}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-neutral-950 dark:text-white md:text-5xl">
            {recording.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            {recording.summary}
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <InfoBox
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            label="Duration"
            value={formatPairRecordingDuration(recording.durationMinutes)}
          />
          <InfoBox
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            label="Published"
            value={recording.publishedAt}
          />
          <InfoBox
            icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
            label="Participants"
            value={recording.participants.join(", ")}
          />
          <InfoBox
            icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />}
            label="Consent"
            value="Approved"
          />
        </section>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <ListVideo className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">
              Timestamped Highlights
            </h2>
          </div>
          <div className="grid gap-4">
            {recording.chapters.map((chapter) => (
              <div
                key={`${chapter.start}-${chapter.title}`}
                className="grid gap-3 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-950 sm:grid-cols-[72px_1fr]"
              >
                <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {chapter.start}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{chapter.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {chapter.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-foreground">
              Cursor Skills
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {recording.cursorSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-foreground">Resources</h2>
            <div className="mt-4 grid gap-2">
              {recording.resources.map((resource) => (
                <Link
                  key={resource.url}
                  href={resource.url}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-950"
                >
                  <FileText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {resource.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
