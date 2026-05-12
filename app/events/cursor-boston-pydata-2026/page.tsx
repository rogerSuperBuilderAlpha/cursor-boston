/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import eventsData from "@/content/events.json";
import type { EventsData } from "@/types/events";
import { PyDataAccessGate } from "@/components/events/PyDataAccessGate";
import { CursorSubmitPromptButton } from "@/components/events/CursorSubmitPromptButton";
import {
  PYDATA_2026_EVENT_SLUG,
} from "@/lib/pydata-2026";
import {
  getPyDataSubmissions,
  PYDATA_SUBMISSIONS_BRANCH,
  PYDATA_SUBMISSIONS_DIR,
  PYDATA_SUBMISSIONS_REPO_URL,
  type PyDataSubmission,
} from "@/lib/pydata-submissions";

// Static path: this file shadows app/events/[slug]/page.tsx for the exact
// pydata slug. Other slugs continue to hit the dynamic [slug] route.

const typedEvents = eventsData as unknown as EventsData;

interface EventRecord {
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  location: string;
  venue?: { name: string; address: string };
  image: string;
  description: string;
}

function findPydataEvent(): EventRecord | null {
  const all = [
    ...(typedEvents.upcoming as unknown as EventRecord[]),
    ...(typedEvents.past as unknown as EventRecord[]),
    ...((typedEvents.oldEvents ?? []) as unknown as EventRecord[]),
  ];
  return all.find((e) => e.slug === PYDATA_2026_EVENT_SLUG) ?? null;
}

export const metadata: Metadata = {
  title: "Cursor Boston × PyData — Hackathon submissions",
  description:
    "Submit your hackathon notebook and browse merged submissions from the May 13 Cursor Boston × PyData evening hack at Moderna HQ.",
  // Gated page — no need to be in search results or social previews.
  robots: { index: false, follow: false },
};

// Linking to the branch (not /compare) so GitHub renders its "Contribute"
// dropdown automatically — that flow lets the attendee open a PR from their
// fork without us having to know the fork URL.
const BRANCH_URL = `${PYDATA_SUBMISSIONS_REPO_URL}/tree/${PYDATA_SUBMISSIONS_BRANCH}`;
const FORK_URL = `${PYDATA_SUBMISSIONS_REPO_URL}/fork`;
const README_URL = `${PYDATA_SUBMISSIONS_REPO_URL}/blob/main/${PYDATA_SUBMISSIONS_DIR}/README.md`;

export default function PyDataHackathonHubPage() {
  const event = findPydataEvent();
  const submissions = getPyDataSubmissions();

  return (
    <PyDataAccessGate>
      <main className="flex flex-col bg-neutral-50 dark:bg-neutral-950">
        {/* Breadcrumb */}
        <nav
          className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800"
          aria-label="Breadcrumb"
        >
          <div className="max-w-6xl mx-auto">
            <ol className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <li>
                <Link
                  href="/events"
                  className="hover:text-foreground transition-colors"
                >
                  Events
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground truncate">
                {event?.title ?? "Cursor Boston × PyData"}
              </li>
            </ol>
          </div>
        </nav>

        {/* Hero — event reference strip */}
        <section className="px-6 py-10 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="max-w-6xl mx-auto">
            <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full mb-3 uppercase tracking-wide">
              You&apos;re in
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {event?.title ?? "Cursor Boston × PyData — Hackathon hub"}
            </h1>
            {event?.subtitle ? (
              <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-4">
                {event.subtitle}
              </p>
            ) : null}
            <dl className="mt-4 grid gap-3 text-sm text-neutral-700 dark:text-neutral-300 sm:grid-cols-3">
              {event?.date ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Date
                  </dt>
                  <dd className="mt-1">
                    {event.date}
                    {event.time && event.time !== "TBD" ? ` · ${event.time}` : ""}
                  </dd>
                </div>
              ) : null}
              {event?.venue ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Venue
                  </dt>
                  <dd className="mt-1">
                    {event.venue.name}
                    <span className="block text-xs text-neutral-500">
                      {event.venue.address}
                    </span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Submission branch
                </dt>
                <dd className="mt-1 font-mono text-xs">
                  <a
                    href={BRANCH_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                  >
                    {PYDATA_SUBMISSIONS_BRANCH}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Instructions */}
        <SubmissionInstructions />

        {/* Submissions grid */}
        <SubmissionsGrid submissions={submissions} />
      </main>
    </PyDataAccessGate>
  );
}

function SubmissionInstructions() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          Submit your notebook
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-3xl">
          One PR per attendee, targeting the{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-mono dark:bg-neutral-800">
            {PYDATA_SUBMISSIONS_BRANCH}
          </code>{" "}
          branch. Once a maintainer merges it through to{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-mono dark:bg-neutral-800">
            main
          </code>
          , your card appears in the grid below.
        </p>

        <CursorSubmitPromptButton />

        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Or follow the manual steps
        </h3>

        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Step
            num={1}
            title="Fork the repo"
            body={
              <>
                Click{" "}
                <a
                  href={FORK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
                >
                  Fork
                </a>{" "}
                on{" "}
                <a
                  href={PYDATA_SUBMISSIONS_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
                >
                  cursor-boston
                </a>{" "}
                so you can push without write access to the upstream repo.
              </>
            }
          />
          <Step
            num={2}
            title="Add your folder"
            body={
              <>
                Create{" "}
                <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  {PYDATA_SUBMISSIONS_DIR}/&lt;your-gh-handle&gt;/
                </code>{" "}
                with{" "}
                <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  submission.ipynb
                </code>{" "}
                and{" "}
                <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  meta.json
                </code>{" "}
                inside.
              </>
            }
          />
          <Step
            num={3}
            title={
              <>
                Open PR into{" "}
                <code className="font-mono text-sm">
                  {PYDATA_SUBMISSIONS_BRANCH}
                </code>
              </>
            }
            body={
              <>
                Set the base branch to{" "}
                <a
                  href={BRANCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
                >
                  {PYDATA_SUBMISSIONS_BRANCH}
                </a>
                , not <code className="font-mono">main</code>. PRs to{" "}
                <code className="font-mono">main</code> will be redirected.
              </>
            }
          />
          <Step
            num={4}
            title="Wait for the deploy"
            body={
              <>
                A maintainer batches merges into{" "}
                <code className="font-mono">{PYDATA_SUBMISSIONS_BRANCH}</code>,
                then ships <code className="font-mono">develop</code> →{" "}
                <code className="font-mono">main</code>. Your card appears
                below after the Vercel deploy.
              </>
            }
          />
        </ol>

        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm font-semibold text-foreground mb-2">
            meta.json template
          </p>
          <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            <code>{META_TEMPLATE}</code>
          </pre>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Full rules + field reference:{" "}
            <a
              href={README_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
            >
              {PYDATA_SUBMISSIONS_DIR}/README.md
            </a>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={BRANCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Open the submission branch
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
          <a
            href={README_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Read the rules
          </a>
        </div>
      </div>
    </section>
  );
}

const META_TEMPLATE = `{
  "title": "Short, specific title for your notebook",
  "description": "1–3 sentences. What does the notebook do? What did you find?",
  "displayName": "Your name as you want it on the page",
  "tags": ["healthcare", "embeddings"],
  "collaborators": [
    { "displayName": "Pat Collaborator", "githubHandle": "pat-collab" }
  ]
}`;

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: React.ReactNode;
  body: React.ReactNode;
}) {
  return (
    <li className="relative rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <span className="absolute -top-3 left-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
        {num}
      </span>
      <h3 className="mt-1 mb-2 text-base font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
    </li>
  );
}

function SubmissionsGrid({ submissions }: { submissions: PyDataSubmission[] }) {
  return (
    <section className="px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Merged submissions{" "}
            <span className="text-neutral-500 font-normal tabular-nums">
              ({submissions.length})
            </span>
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Each card links to the rendered notebook on GitHub.
          </p>
        </div>

        {submissions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.map((s) => (
              <SubmissionCard key={s.githubHandle} submission={s} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-base font-semibold text-foreground">
        No merged submissions yet
      </p>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
        Be the first — once your PR lands in{" "}
        <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
          main
        </code>{" "}
        and the site redeploys, your card shows up here.
      </p>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: PyDataSubmission }) {
  const handleHref = `https://github.com/${submission.githubHandle}`;
  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-emerald-500/40 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-lg font-semibold text-foreground line-clamp-2">
        <a
          href={submission.notebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          {submission.title}
        </a>
      </h3>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        by{" "}
        <a
          href={handleHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-neutral-700 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400"
        >
          {submission.displayName}
        </a>
        <span className="text-neutral-400"> · @{submission.githubHandle}</span>
      </p>

      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-4">
        {submission.description}
      </p>

      {submission.tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {submission.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {submission.collaborators.length > 0 ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          With:{" "}
          {submission.collaborators.map((c, i) => (
            <span key={`${c.displayName}-${i}`}>
              {i > 0 ? ", " : ""}
              {c.githubHandle ? (
                <a
                  href={`https://github.com/${c.githubHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-700 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400"
                >
                  {c.displayName}
                </a>
              ) : (
                c.displayName
              )}
            </span>
          ))}
        </p>
      ) : null}

      <div className="mt-auto pt-5 flex items-center justify-between text-xs">
        <a
          href={submission.notebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          View notebook
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
        <a
          href={submission.folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Folder
        </a>
      </div>
    </li>
  );
}
