/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import eventsData from "@/content/events.json";
import type { EventsData } from "@/types/events";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_LUMA_URL,
} from "@/lib/sports-hack-2026";
import {
  getSportsHack2026Submissions,
  SPORTS_HACK_2026_SUBMISSIONS_BRANCH,
  SPORTS_HACK_2026_SUBMISSIONS_DIR,
  SPORTS_HACK_2026_SUBMISSIONS_REPO_URL,
  SPORTS_HACK_2026_WINNER_ELIGIBLE_CUTOFF_ISO,
  type SportsHack2026Submission,
} from "@/lib/sports-hack-2026-submissions";

// Static path: this file shadows app/events/[slug]/page.tsx for the exact
// sports-hack slug. Other slugs continue to hit the dynamic [slug] route.

const typedEvents = eventsData as unknown as EventsData;
const EVENT_SLUG = "cursor-boston-sports-hack-2026";

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

function findEvent(): EventRecord | null {
  const all = [
    ...(typedEvents.upcoming as unknown as EventRecord[]),
    ...(typedEvents.past as unknown as EventRecord[]),
    ...((typedEvents.oldEvents ?? []) as unknown as EventRecord[]),
  ];
  return all.find((e) => e.slug === EVENT_SLUG) ?? null;
}

export const metadata: Metadata = {
  title: "Boston Tech Week Sports Hack — Submissions",
  description:
    "Browse merged project submissions from the May 26 Cursor Boston × Hult Sports Hack — and submit your own by opening a PR before 4 PM ET on event day.",
};

const SIGNUP_URL = `/hackathons/${SPORTS_HACK_2026_EVENT_ID}/signup`;
const BRANCH_URL = `${SPORTS_HACK_2026_SUBMISSIONS_REPO_URL}/tree/${SPORTS_HACK_2026_SUBMISSIONS_BRANCH}`;
const FORK_URL = `${SPORTS_HACK_2026_SUBMISSIONS_REPO_URL}/fork`;
const README_URL = `${SPORTS_HACK_2026_SUBMISSIONS_REPO_URL}/blob/main/${SPORTS_HACK_2026_SUBMISSIONS_DIR}/README.md`;

export default function SportsHack2026HubPage() {
  const event = findEvent();
  const submissions = getSportsHack2026Submissions();

  return (
    <main className="flex flex-col bg-neutral-50 dark:bg-neutral-950">
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
              {event?.title ?? "Boston Tech Week Sports Hack"}
            </li>
          </ol>
        </div>
      </nav>

      <Hero event={event} />
      <HowToWinCredits />
      <HowToSubmit />
      <Prizes />
      <SubmissionsGrid submissions={submissions} />
    </main>
  );
}

function Hero({ event }: { event: EventRecord | null }) {
  return (
    <section className="px-6 py-10 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full mb-3 uppercase tracking-wide">
          Public showcase
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          {event?.title ?? "Boston Tech Week Sports Hack"}
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
                {SPORTS_HACK_2026_SUBMISSIONS_BRANCH}
              </a>
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={SIGNUP_URL}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
          >
            Claim your participation spot →
          </Link>
          <a
            href={SPORTS_HACK_2026_LUMA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            RSVP on Luma →
          </a>
        </div>
      </div>
    </section>
  );
}

function HowToWinCredits() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          How to win a Cursor credit
        </h2>
        <p className="text-lg text-neutral-700 dark:text-neutral-300 max-w-3xl mb-6">
          We have <strong>{SPORTS_HACK_2026_CAPACITY} Cursor credit codes</strong>{" "}
          for participants. They go to the top {SPORTS_HACK_2026_CAPACITY}{" "}
          ranked attendees on the website signup list — by{" "}
          <strong>merged PRs to the community repo</strong>, with signup time as
          the tiebreaker.
        </p>
        <ol className="grid gap-4 md:grid-cols-3">
          <Step
            num={1}
            title="Claim your spot on the site"
            body={
              <>
                Sign up at{" "}
                <Link
                  href={SIGNUP_URL}
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
                >
                  /hackathons/sports-hack-2026/signup
                </Link>
                . Required even if you&apos;re already on Luma — this is the
                list we rank from.
              </>
            }
          />
          <Step
            num={2}
            title="Merge PRs into cursor-boston"
            body={
              <>
                Every merged PR moves you up the leaderboard.{" "}
                <a
                  href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline"
                >
                  Browse open issues
                </a>{" "}
                — first-time contributors should look for{" "}
                <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  good first issue
                </code>
                .
              </>
            }
          />
          <Step
            num={3}
            title={`Stay in the top ${SPORTS_HACK_2026_CAPACITY}`}
            body={
              <>
                On event day the top {SPORTS_HACK_2026_CAPACITY} get a Cursor
                credit code. Watch your rank live on the signup page — Cohort 1
                applicants get a priority boost.
              </>
            }
          />
        </ol>
      </div>
    </section>
  );
}

function HowToSubmit() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          How to submit your project
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-3xl">
          On event day you submit by opening a PR into the{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-mono dark:bg-neutral-800">
            {SPORTS_HACK_2026_SUBMISSIONS_BRANCH}
          </code>{" "}
          branch — one folder per attendee, named after your GitHub handle, with
          a single <code className="font-mono">meta.json</code> describing the
          project. Once a maintainer merges through to{" "}
          <code className="font-mono">main</code>, your card appears in the grid
          below.
        </p>

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
                on cursor-boston so you can push without write access to the
                upstream repo.
              </>
            }
          />
          <Step
            num={2}
            title="Add your folder + meta.json"
            body={
              <>
                Create{" "}
                <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  {SPORTS_HACK_2026_SUBMISSIONS_DIR}/&lt;your-gh-handle&gt;/meta.json
                </code>{" "}
                with title, description, video URL, repo URL, and deployed URL.
              </>
            }
          />
          <Step
            num={3}
            title={
              <>
                Open PR into{" "}
                <code className="font-mono text-sm">
                  {SPORTS_HACK_2026_SUBMISSIONS_BRANCH}
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
                  {SPORTS_HACK_2026_SUBMISSIONS_BRANCH}
                </a>
                , not <code className="font-mono">main</code>.
              </>
            }
          />
          <Step
            num={4}
            title="Wait for the deploy"
            body={
              <>
                A maintainer batches merges into{" "}
                <code className="font-mono">
                  {SPORTS_HACK_2026_SUBMISSIONS_BRANCH}
                </code>
                , then ships <code className="font-mono">develop</code> →{" "}
                <code className="font-mono">main</code>. Your card appears below
                after Vercel redeploys.
              </>
            }
          />
        </ol>

        <div className="mt-8 rounded-xl border border-rose-300 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-900/10">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200 mb-1">
            ⏱ Hard deadline: 4:00 PM ET on Tuesday, May 26
          </p>
          <p className="text-sm text-rose-800 dark:text-rose-300">
            Your PR must be <strong>opened before</strong> 4 PM ET (event end)
            to be eligible for AI scoring. One second late and your AI eval is
            gone — but human judges still review every merged submission, so
            you can still win on the judges track.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
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
              {SPORTS_HACK_2026_SUBMISSIONS_DIR}/README.md
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
            Read the full rules
          </a>
        </div>
      </div>
    </section>
  );
}

const META_TEMPLATE = `{
  "title": "Short, specific project title",
  "description": "1–3 sentences. What did you build? What problem does it solve?",
  "displayName": "Your name as you want it on the page",
  "videoUrl": "https://www.loom.com/share/...",
  "repoUrl": "https://github.com/your-handle/your-project",
  "deployedUrl": "https://your-project.vercel.app",
  "tags": ["nba", "live-stats", "next.js"],
  "collaborators": [
    { "displayName": "Pat Collaborator", "githubHandle": "pat-collab" }
  ]
}`;

function Prizes() {
  return (
    <section className="px-6 py-12 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          How winners are picked
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-3xl">
          Two independent tracks, both running off the same submissions:
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <PrizeCard
            title="AI track — 3 winners"
            body="After the 4 PM deadline, an AI agent reads every eligible meta.json + video/repo/deployed link and scores the projects 1–10 with a written rationale. Top 3 win."
            badge="Closes 4 PM ET"
          />
          <PrizeCard
            title="Judges track — 3 winners"
            body="A panel of human judges reviews every merged submission — AI-eligible or not — and picks their top 3 based on the live presentations and the repo + deployed project."
            badge="Open to late submissions"
          />
        </div>
      </div>
    </section>
  );
}

function PrizeCard({
  title,
  body,
  badge,
}: {
  title: string;
  body: string;
  badge: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
        <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {badge}
        </span>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{body}</p>
    </div>
  );
}

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

function SubmissionsGrid({ submissions }: { submissions: SportsHack2026Submission[] }) {
  const eligible = submissions.filter((s) => s.aiEligible);
  const afterDeadline = submissions.filter((s) => !s.aiEligible);
  const empty = submissions.length === 0;

  return (
    <section className="px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Public submissions board
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
                Cards are sorted by combined AI + judge score. Only PRs opened
                before 4 PM ET on May 26 are eligible for the AI track; later
                PRs are shown separately and remain eligible for the judges
                track.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-950">
                <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {eligible.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  AI-eligible
                </p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-950">
                <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {afterDeadline.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  After 4 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        {empty ? (
          <EmptyState />
        ) : (
          <>
            {eligible.length > 0 && (
              <SubmissionBucket
                title="AI-eligible submissions"
                submissions={eligible}
              />
            )}
            {afterDeadline.length > 0 && (
              <SubmissionBucket
                title="After-deadline submissions (judges track only)"
                submissions={afterDeadline}
                muted
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  const cutoffPretty = new Date(
    SPORTS_HACK_2026_WINNER_ELIGIBLE_CUTOFF_ISO
  ).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-lg font-semibold text-foreground">
        No submissions yet.
      </p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
        Submissions open on May 26 — yours could be the first. Project PRs must
        be opened before <strong>{cutoffPretty}</strong> to be eligible for the
        AI track.
      </p>
      <div className="mt-5">
        <a
          href={BRANCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Open the submission branch
        </a>
      </div>
    </div>
  );
}

function SubmissionBucket({
  title,
  submissions,
  muted = false,
}: {
  title: string;
  submissions: SportsHack2026Submission[];
  muted?: boolean;
}) {
  return (
    <div className="mb-10">
      <h3
        className={`mb-4 text-sm font-semibold uppercase tracking-[0.18em] ${
          muted
            ? "text-amber-700 dark:text-amber-300"
            : "text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {title}{" "}
        <span className="font-mono normal-case text-neutral-500">
          ({submissions.length})
        </span>
      </h3>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {submissions.map((s) => (
          <SubmissionCard key={s.githubHandle} submission={s} />
        ))}
      </ul>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: SportsHack2026Submission }) {
  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-base font-bold text-foreground">{submission.title}</h4>
        <ScoreBadges submission={submission} />
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        by{" "}
        <a
          href={`https://github.com/${submission.githubHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          {submission.displayName}
        </a>
        {submission.collaborators.length > 0 ? (
          <>
            {" "}
            with{" "}
            {submission.collaborators.map((c, i) => (
              <span key={i}>
                {i > 0 ? ", " : ""}
                {c.githubHandle ? (
                  <a
                    href={`https://github.com/${c.githubHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    {c.displayName}
                  </a>
                ) : (
                  c.displayName
                )}
              </span>
            ))}
          </>
        ) : null}
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4 flex-1">
        {submission.description}
      </p>
      {submission.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {submission.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-mono text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {submission.videoUrl && (
          <ExternalLink href={submission.videoUrl} label="Video" />
        )}
        {submission.repoUrl && (
          <ExternalLink href={submission.repoUrl} label="Code" />
        )}
        {submission.deployedUrl && (
          <ExternalLink href={submission.deployedUrl} label="Live demo" />
        )}
        <a
          href={submission.folderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-200 px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Submission folder
        </a>
      </div>
      {(submission.aiScore?.rationale || submission.judgeScore?.rationale) && (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          {submission.aiScore?.rationale && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-foreground">AI judge:</span>{" "}
              {submission.aiScore.rationale}
            </p>
          )}
          {submission.judgeScore?.rationale && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-foreground">Judges:</span>{" "}
              {submission.judgeScore.rationale}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ScoreBadges({ submission }: { submission: SportsHack2026Submission }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {submission.aiScore ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          AI {submission.aiScore.score.toFixed(1)}
        </span>
      ) : submission.aiEligible ? (
        <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:border-neutral-700">
          AI pending
        </span>
      ) : null}
      {submission.judgeScore ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">
          Judges {submission.judgeScore.average.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md bg-neutral-100 px-2 py-1 font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
    >
      {label} →
    </a>
  );
}
