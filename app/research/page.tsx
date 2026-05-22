/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, GitPullRequest, Info } from "lucide-react";
import {
  RESEARCH_REPO_NEW_FILE_URL,
  RESEARCH_REPO_README_URL,
  RESEARCH_TYPE_PLURAL,
  filterVisible,
  loadAllResearchEntries,
  sortByRecentlyActive,
  type ResearchType,
} from "@/lib/research";
import { ResearchCard } from "@/components/research/ResearchCard";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Community space for academic researchers to recruit study participants, share pre-prints, and publish datasets for the Cursor Boston community to explore.",
  alternates: { canonical: "https://cursorboston.com/research" },
};

type FilterValue = ResearchType | "all" | "samples";

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "recruiting", label: RESEARCH_TYPE_PLURAL.recruiting },
  { value: "preprint", label: RESEARCH_TYPE_PLURAL.preprint },
  { value: "dataset", label: RESEARCH_TYPE_PLURAL.dataset },
  { value: "samples", label: "Samples" },
];

function parseFilter(raw: string | string[] | undefined): FilterValue {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (
    v === "recruiting" ||
    v === "preprint" ||
    v === "dataset" ||
    v === "samples"
  )
    return v;
  return "all";
}

interface ResearchPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function ResearchPage({ searchParams }: ResearchPageProps) {
  const { type } = await searchParams;
  const filter = parseFilter(type);

  const all = filterVisible(sortByRecentlyActive(loadAllResearchEntries()));
  const real = all.filter((l) => l.entry.isSample !== true);
  const samples = all.filter((l) => l.entry.isSample === true);

  let filtered: typeof all;
  if (filter === "samples") {
    filtered = samples;
  } else if (filter === "all") {
    filtered = real;
  } else {
    filtered = real.filter((l) => l.entry.type === filter);
  }

  const counts: Record<FilterValue, number> = {
    all: real.length,
    recruiting: real.filter((l) => l.entry.type === "recruiting").length,
    preprint: real.filter((l) => l.entry.type === "preprint").length,
    dataset: real.filter((l) => l.entry.type === "dataset").length,
    samples: samples.length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <FlaskConical className="h-5 w-5" />
          </span>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Research
          </h1>
        </div>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          A community surface for academic research happening in and around
          Cursor Boston. Researchers post calls for study participants, share
          pre-prints for community discussion, and publish datasets the
          community can explore, cite, or build on. All entries are
          repo-backed — content lives in each researcher&apos;s own GitHub
          repo; this page is the discovery layer.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={RESEARCH_REPO_NEW_FILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
          >
            <GitPullRequest className="h-4 w-4" /> Submit via PR
          </a>
          <a
            href={RESEARCH_REPO_README_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Info className="h-4 w-4" /> Schema & submission guide
          </a>
        </div>
      </header>

      <nav
        aria-label="Filter by entry type"
        className="mb-6 flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const href = f.value === "all" ? "/research" : `/research?type=${f.value}`;
          const isSampleFilter = f.value === "samples";
          const activeClass = isSampleFilter
            ? "bg-amber-500 text-white"
            : "bg-emerald-600 text-white";
          const inactiveClass = isSampleFilter
            ? "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";
          const activeBadgeClass = isSampleFilter
            ? "bg-amber-600 text-amber-50"
            : "bg-emerald-700 text-emerald-50";
          return (
            <Link
              key={f.value}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? activeClass : inactiveClass
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active
                    ? activeBadgeClass
                    : "bg-white text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
                }`}
              >
                {counts[f.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      {filter === "samples" ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Sample entries.</strong> These are placeholders that show
          how a real submission renders. Authors, links, deadlines, and
          IRB numbers are fictional — please don&apos;t contact, sign up,
          or download. They&apos;ll be removed once real research lands.
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
          {filter === "samples" ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No sample entries — that&apos;s a good sign.
            </p>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {filter === "all"
                ? "No research entries yet."
                : `No ${RESEARCH_TYPE_PLURAL[filter].toLowerCase()} yet.`}{" "}
              <a
                href={RESEARCH_REPO_NEW_FILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Be the first to post →
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ entry }) => (
            <ResearchCard key={entry.slug} entry={entry} />
          ))}
        </div>
      )}

      <footer className="mt-12 border-t border-neutral-200 pt-6 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <p>
          Discussion of any entry happens through pull requests in this repo,
          or as issues / PRs on the researcher&apos;s linked source repo. See
          the{" "}
          <a
            href={RESEARCH_REPO_README_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            submission guide
          </a>{" "}
          for the schema and review process.
        </p>
      </footer>
    </div>
  );
}
