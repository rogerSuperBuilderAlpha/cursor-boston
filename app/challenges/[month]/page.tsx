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
  CalendarDays,
  Code2,
  ListChecks,
  Sparkles,
} from "lucide-react";
import {
  getChallengeById,
  getChallengeIds,
  getChallengeRubricTotal,
} from "@/lib/monthly-challenges";

const SITE_URL = "https://cursorboston.com";

interface Props {
  params: Promise<{ month: string }>;
}

export function generateStaticParams() {
  return getChallengeIds().map((month) => ({ month }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  const challenge = getChallengeById(month);

  if (!challenge) {
    return { title: "Challenge Not Found" };
  }

  const title = `${challenge.title} | Cursor Boston Challenges`;
  const url = `${SITE_URL}/challenges/${challenge.id}`;

  return {
    title,
    description: challenge.summary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: challenge.summary,
      type: "article",
      url,
    },
    twitter: {
      card: "summary",
      title,
      description: challenge.summary,
    },
  };
}

function buildJsonLd(challenge: NonNullable<ReturnType<typeof getChallengeById>>) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: challenge.title,
    description: challenge.summary,
    text: challenge.prompt,
    url: `${SITE_URL}/challenges/${challenge.id}`,
    dateCreated: challenge.monthLabel,
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: "Cursor Boston Monthly Code Challenges",
      url: `${SITE_URL}/challenges`,
    },
    keywords: [challenge.theme, ...challenge.cursorSkills].join(", "),
    publisher: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: SITE_URL,
    },
  };
}

export default async function MonthlyChallengeDetailPage({ params }: Props) {
  const { month } = await params;
  const challenge = getChallengeById(month);

  if (!challenge) {
    notFound();
  }

  const totalPoints = getChallengeRubricTotal(challenge);

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(challenge)) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <ol className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <li>
            <Link href="/challenges" className="hover:text-foreground">
              Challenges
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate text-foreground">{challenge.monthLabel}</li>
        </ol>
      </nav>

      <article className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              {challenge.status === "current" ? "Current" : "Archive"}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {challenge.monthLabel}
            </span>
            <span className="rounded-full bg-neutral-200 px-3 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {challenge.theme}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-neutral-950 dark:text-white md:text-5xl">
            {challenge.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            {challenge.summary}
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <InfoBox
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            label="Submission window"
            value={challenge.submissionWindow}
          />
          <InfoBox
            icon={<Code2 className="h-5 w-5" aria-hidden="true" />}
            label="Line limit"
            value={`${challenge.maxLines} lines`}
          />
          <InfoBox
            icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
            label="Rubric"
            value={`${totalPoints} points`}
          />
        </section>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-foreground">Prompt</h2>
          <p className="mt-3 text-base leading-7 text-neutral-700 dark:text-neutral-300">
            {challenge.prompt}
          </p>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-foreground">Deliverables</h2>
            <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              {challenge.deliverables.map((deliverable) => (
                <li key={deliverable} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1 text-emerald-600">
                    -
                  </span>
                  <span>{deliverable}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-foreground">
              Cursor Skills
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {challenge.cursorSkills.map((skill) => (
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
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Rubric</h2>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {totalPoints} points
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {challenge.rubric.map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{item.label}</h3>
                  <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {item.points}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {item.description}
                </p>
              </div>
            ))}
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
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
