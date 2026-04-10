/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import { Suspense } from "react";
import { GitHubIcon } from "@/components/icons";
import {
  fetchRecentMergedPullRequests,
  getGithubRepoWebBaseUrl,
} from "@/lib/github-recent-merged-prs";

function formatMergedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function OpenSourceFeedContent() {
  const { prs, repoUrl, error } = await fetchRecentMergedPullRequests(8);

  if (error || prs.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/40 p-6 text-center">
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
          {error
            ? "We couldn't load the latest merges right now. You can still browse merged work on GitHub."
            : "No merged pull requests to show yet. Be the first on GitHub."}
        </p>
        <a
          href={`${repoUrl}/pulls?q=is%3Apr+is%3Amerged`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          <GitHubIcon size={16} />
          View merged PRs on GitHub
        </a>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Recently merged pull requests">
      {prs.map((pr) => (
        <li key={pr.number}>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/50 px-4 py-3 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-950"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <GitHubIcon size={18} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-medium text-foreground text-sm md:text-base leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors line-clamp-2">
                <span className="text-neutral-500 dark:text-neutral-400 font-normal tabular-nums">
                  #{pr.number}
                </span>{" "}
                {pr.title}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  @{pr.authorLogin}
                </span>
                {formatMergedDate(pr.mergedAt) ? (
                  <>
                    {" "}
                    · merged {formatMergedDate(pr.mergedAt)}
                  </>
                ) : null}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

function OpenSourceFeedSkeleton() {
  return (
    <ul className="space-y-2 animate-pulse" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/40 px-4 py-3"
        >
          <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-full max-w-md" />
            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Open-source explainer + live feed of merged PRs (below homepage hero).
 */
export function OpenSourceFeedSection() {
  const repoBase = getGithubRepoWebBaseUrl();
  const mergedPrsUrl = `${repoBase}/pulls?q=is%3Apr+is%3Amerged`;
  const contributingUrl = `${repoBase}?tab=contributing-ov-file#readme`;

  return (
    <section
      className="py-16 md:py-20 px-6 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/35"
      aria-labelledby="open-source-feed-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
              Open source
            </p>
            <h2
              id="open-source-feed-heading"
              className="text-2xl md:text-3xl font-bold text-foreground mb-4"
            >
              This site is built by the community
            </h2>
            <div className="space-y-4 text-neutral-600 dark:text-neutral-300 text-base leading-relaxed">
              <p>
                Cursor Boston runs as an{" "}
                <strong className="text-foreground font-semibold">
                  open source
                </strong>{" "}
                project. When you open a pull request, you are improving a real
                product other members use every day—events, profiles, and
                tooling that keep the chapter running.
              </p>
              <p>
                You do not need to be an expert. Small fixes (copy, a11y,
                styling), docs, and features are all welcome. Merged work ships
                to production and becomes part of the story we tell at meetups.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/open-source"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-950"
              >
                How to contribute
              </Link>
              <a
                href={contributingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-300 dark:border-neutral-600 text-foreground rounded-lg text-sm font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-950"
              >
                <GitHubIcon size={16} />
                Contributing guide
              </a>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Recently merged
              </h3>
              <a
                href={mergedPrsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              >
                All on GitHub →
              </a>
            </div>
            <Suspense fallback={<OpenSourceFeedSkeleton />}>
              <OpenSourceFeedContent />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
