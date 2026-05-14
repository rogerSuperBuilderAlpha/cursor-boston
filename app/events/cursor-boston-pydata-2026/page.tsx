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

        {/* Challenge brief */}
        <Challenge />

        {/* Prizes */}
        <Prizes />

        {/* Datasets */}
        <Datasets />

        {/* Timeline */}
        <Timeline />

        {/* Submission mechanics — how to PR */}
        <SubmissionInstructions />

        {/* Best Submission + Best Presentation rules */}
        <PrizeRules />

        {/* Submissions grid */}
        <SubmissionsGrid submissions={submissions} />
      </main>
    </PyDataAccessGate>
  );
}

function Challenge() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          The challenge
        </h2>
        <p className="text-lg text-neutral-700 dark:text-neutral-300 max-w-3xl">
          Use Cursor and Marimo to build a notebook that uncovers{" "}
          <strong>one compelling insight</strong> from the dataset(s) below.
        </p>
        <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400 max-w-3xl">
          That&apos;s it. One notebook. One insight. Make it interesting.
        </p>
      </div>
    </section>
  );
}

function Prizes() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          Prizes
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          <PrizeCard
            amount="$200"
            unit="Cursor Credits × 3"
            title="Best presentations"
            body="Awarded to the top 3 presentations as scored by a panel of human judges on data story telling."
          />
          <PrizeCard
            amount="$200"
            unit="Cursor Credits × 3"
            title="Best submissions"
            body="Awarded to the top 3 notebooks as picked by an AI agent acting as a blind judge."
          />
          <PrizeCard
            amount="$20"
            unit="Cursor Credits"
            title="For submitting"
            body="Every attendee who submits a notebook gets $20 in Cursor Credits — no judging required."
          />
        </ul>
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400 max-w-3xl">
          Prizes are awarded to <strong>individuals, not teams</strong>. You can
          only win a single $200 voucher during the event — you can&apos;t win
          both &ldquo;best presentation&rdquo; and &ldquo;best submission&rdquo;
          at the same time.
        </p>
      </div>
    </section>
  );
}

function PrizeCard({
  amount,
  unit,
  title,
  body,
}: {
  amount: string;
  unit: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {amount}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {unit}
        </span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {body}
      </p>
    </li>
  );
}

const DATASET_GROUPS: ReadonlyArray<{
  heading: string;
  datasets: ReadonlyArray<{ name: string; url: string }>;
}> = [
  {
    heading: "Biological",
    datasets: [
      {
        name: "FLIP2: Expanding Protein Fitness Landscape Benchmarks",
        url: "https://flip.protein.properties/",
      },
      { name: "ProteinGym", url: "https://proteingym.org/" },
      {
        name: "1000 Genomes Project",
        url: "https://www.internationalgenome.org/data",
      },
      {
        name: "GTEx Datasets",
        url: "https://gtexportal.org/home/datasets",
      },
    ],
  },
  {
    heading: "Climate",
    datasets: [
      {
        name: "ERA5 Reanalysis (Copernicus)",
        url: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels",
      },
      {
        name: "NOAA Climate Data Online Datasets",
        url: "https://www.ncei.noaa.gov/cdo-web/datasets",
      },
    ],
  },
  {
    heading: "Robotics",
    datasets: [
      {
        name: "LeRobot Datasets (Hugging Face)",
        url: "https://huggingface.co/lerobot",
      },
      {
        name: "UCI Wall-Following Robot Navigation",
        url: "https://archive.ics.uci.edu/dataset/86/wall+following+robot+navigation+data",
      },
    ],
  },
  {
    heading: "Marketing",
    datasets: [
      {
        name: "UCI Bank Marketing",
        url: "https://archive.ics.uci.edu/dataset/222/bank+marketing",
      },
      {
        name: "Kaggle Marketing Campaign Datasets",
        url: "https://www.kaggle.com/search?q=marketing+campaign+dataset",
      },
    ],
  },
  {
    heading: "Retail / E-commerce",
    datasets: [
      {
        name: "UCI Online Retail",
        url: "https://archive.ics.uci.edu/dataset/352/online+retail",
      },
      {
        name: "Retailrocket E-commerce Dataset (Kaggle)",
        url: "https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset",
      },
    ],
  },
  {
    heading: "Local (Boston)",
    datasets: [
      {
        name: "Analyze Boston (City of Boston Open Data)",
        url: "https://data.boston.gov/",
      },
      { name: "MBTA Open Data", url: "https://www.mbta.com/developers" },
    ],
  },
];

function Datasets() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Competition datasets
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-3xl mb-8">
          These are the &ldquo;competition datasets&rdquo; for this hackathon.
          Use any one (or several) of them in your submission. You must use at
          least one of these to be eligible for the prizes.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DATASET_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.datasets.map((d) => (
                  <li key={d.url}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 text-sm text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                    >
                      <span className="underline underline-offset-2 decoration-emerald-500/30 hover:decoration-emerald-500">
                        {d.name}
                      </span>
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
                        className="mt-0.5 shrink-0"
                      >
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TIMELINE_ROWS: ReadonlyArray<{ time: string; title: string; sub?: string }> = [
  {
    time: "7:00",
    title: "Welcome",
    sub: "Sebastian Wallkoetter, Benjamin Batorsky",
  },
  {
    time: "7:15",
    title: "Marimo + Cursor for Data Science",
    sub: "Eric Ma",
  },
  {
    time: "8:15",
    title: "Q&A with Cursor",
    sub: "virtual, parallel",
  },
  { time: "9:00", title: "Presentations" },
  { time: "9:25", title: "Winners announced" },
  { time: "9:30", title: "End" },
];

function Timeline() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          Timeline
        </h2>
        <ol className="overflow-hidden rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-200 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {TIMELINE_ROWS.map((row) => (
            <li
              key={`${row.time}-${row.title}`}
              className="flex items-baseline gap-4 px-5 py-3"
            >
              <span className="w-16 shrink-0 font-mono text-sm tabular-nums text-neutral-500">
                {row.time}
              </span>
              <span className="text-sm text-foreground">
                <span className="font-semibold">{row.title}</span>
                {row.sub ? (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    · {row.sub}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Submissions close at <strong>9:00</strong>. You must have your
          notebook PR&apos;d before then to be eligible for either prize.
        </p>
      </div>
    </section>
  );
}

function PrizeRules() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          How the prizes are decided
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-3xl">
          Two prize tracks, judged independently. Submit your notebook for the
          AI-judged track; sign up at the event and pitch for the human-judged
          track.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Best Submission */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-foreground mb-1">
              Best submission
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              An AI agent reviews every notebook as a blind judge and picks the
              top 3.
            </p>

            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Process
            </h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              <li>Submit your final notebook before 9:00.</li>
              <li>Wait for winners to be announced.</li>
            </ol>

            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Eligibility
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              <li>Submit your final notebook (see Submission below).</li>
              <li>Use at least one of the competition datasets.</li>
            </ul>
          </div>

          {/* Best Presentation */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-foreground mb-1">
              Best presentation
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              <strong>25 slots, first-come first-serve</strong>. 1-minute hard
              limit. Sign up at the event by entering your name and GitHub
              handle into the presentation list — if it&apos;s full, it&apos;s
              full.
            </p>

            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Process
            </h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              <li>Sign up on the pitch list at the event (25 slots).</li>
              <li>Submit your final notebook before 9:00.</li>
              <li>Line up to present.</li>
              <li>Present — 1 minute, notebook as backdrop.</li>
              <li>Wait for winners to be announced.</li>
            </ol>

            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Eligibility
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              <li>Submit your final notebook before you present.</li>
              <li>Use at least one of the competition datasets.</li>
              <li>Actually present.</li>
            </ul>

            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Eval criteria
            </h4>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <strong>Data story telling.</strong> How clearly do you
              communicate your insight and its significance using the available
              dataset(s)? A panel of human judges scores each presentation;
              scores are combined and the top 3 win. Ties broken at random.
            </p>
          </div>
        </div>
      </div>
    </section>
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
                  submission.py
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
  const eligible = submissions.filter((s) => s.winnerEligible);
  const afterDeadline = submissions.filter((s) => !s.winnerEligible);

  return (
    <section className="px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Final judging board
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Merged submissions{" "}
                <span className="text-neutral-500 font-normal tabular-nums">
                  ({submissions.length})
                </span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
                Cards are sorted by AI judge score. Only PRs opened before 9:00
                PM Eastern on May 13 are winner eligible; later PRs are shown
                separately for showcase visibility.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-950">
                <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {eligible.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Eligible
                </p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-950">
                <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {afterDeadline.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  After 9 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        {submissions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            <SubmissionSection
              title="Winner eligible"
              description="PR opened before 9:00 PM Eastern on May 13."
              submissions={eligible}
              tone="eligible"
            />
            <SubmissionSection
              title="After deadline showcase"
              description="PR opened after 9:00 PM Eastern. Included on the page, but not eligible for winner selection."
              submissions={afterDeadline}
              tone="late"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function SubmissionSection({
  title,
  description,
  submissions,
  tone,
}: {
  title: string;
  description: string;
  submissions: PyDataSubmission[];
  tone: "eligible" | "late";
}) {
  const countColor =
    tone === "eligible"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-amber-700 dark:text-amber-300";

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-bold text-foreground">
            {title}{" "}
            <span className={`font-mono text-base font-semibold ${countColor}`}>
              ({submissions.length})
            </span>
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        </div>
      </div>
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-5 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
          No submissions in this group.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((s) => (
            <SubmissionCard
              key={s.githubHandle}
              submission={s}
              eligibilityTone={tone}
            />
          ))}
        </ul>
      )}
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

function SubmissionCard({
  submission,
  eligibilityTone,
}: {
  submission: PyDataSubmission;
  eligibilityTone: "eligible" | "late";
}) {
  const handleHref = `https://github.com/${submission.githubHandle}`;
  const badgeClass =
    eligibilityTone === "eligible"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  const badgeText =
    eligibilityTone === "eligible" ? "Winner eligible" : "After deadline";

  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-emerald-500/40 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
        >
          {badgeText}
        </span>
        {submission.submittedAt ? (
          <time
            dateTime={submission.submittedAt}
            className="text-[11px] text-neutral-500 dark:text-neutral-400"
          >
            {formatSubmissionTime(submission.submittedAt)}
          </time>
        ) : null}
      </div>
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

      {submission.score ? (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              AI judge score
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {submission.score.score}/10
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {submission.score.rationale}
          </p>
        </div>
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

function formatSubmissionTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}
