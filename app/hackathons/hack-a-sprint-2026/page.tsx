"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getGithubRepoWebBaseUrl } from "@/lib/github-recent-merged-prs";
import {
  HACK_A_SPRINT_2026_LABEL,
  HACK_A_SPRINT_2026_SUBMISSIONS_PATH,
} from "@/lib/hackathon-showcase";
import type { ShowcaseSubmission } from "@/lib/hackathon-showcase";

type Channel = "participant" | "community" | "judge";

type VoteAgg = { up: number; down: number; net: number };

type MeResponse = {
  participantEligible: boolean;
  judgeEligible: boolean;
  githubLogin: string | null;
};

type SubmissionsResponse = {
  submissions: ShowcaseSubmission[];
  aggregates: Record<string, Record<Channel, VoteAgg>>;
  myVotes: Record<string, Partial<Record<Channel, number>>>;
};

const JSON_TEMPLATE = `{
  "projectRepoUrl": "https://github.com/your-username/your-hack-project",
  "deployedUrl": "https://your-app.example.com",
  "title": "Short title for your build",
  "description": "What you built, stack, and learnings.",
  "demoVideoUrl": "https://www.youtube.com/watch?v=optional"
}`;

function VoteButtons({
  disabled,
  disabledReason,
  current,
  onVote,
  busy,
}: {
  disabled: boolean;
  disabledReason?: string;
  current?: number;
  onVote: (value: 1 | -1 | 0) => void;
  busy: boolean;
}) {
  const activeUp = current === 1;
  const activeDown = current === -1;

  return (
    <div
      className="flex flex-col gap-1"
      title={disabled ? disabledReason : undefined}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onVote(activeUp ? 0 : 1)}
          className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-40 ${
            activeUp
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          }`}
          aria-label="Thumbs up"
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onVote(activeDown ? 0 : -1)}
          className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-40 ${
            activeDown
              ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
              : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          }`}
          aria-label="Thumbs down"
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function HackASprint2026ShowcasePage() {
  const { user, loading: authLoading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteBusy, setVoteBusy] = useState<string | null>(null);

  const repoBase = getGithubRepoWebBaseUrl();
  const submissionsPath = HACK_A_SPRINT_2026_SUBMISSIONS_PATH;

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, subRes] = await Promise.all([
        fetch("/api/hackathons/showcase/hack-a-sprint-2026/me", { headers }),
        fetch("/api/hackathons/showcase/hack-a-sprint-2026/submissions", {
          headers,
        }),
      ]);
      if (!meRes.ok) {
        throw new Error("Could not load eligibility");
      }
      if (!subRes.ok) {
        throw new Error("Could not load submissions");
      }
      setMe((await meRes.json()) as MeResponse);
      setData((await subRes.json()) as SubmissionsResponse);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadAll();
    } else {
      setMe(null);
      setData(null);
    }
  }, [user, loadAll]);

  const handleVote = async (
    submissionId: string,
    channel: Channel,
    value: 1 | -1 | 0
  ) => {
    if (!user) return;
    const key = `${submissionId}-${channel}`;
    setVoteBusy(key);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/vote",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submissionId, channel, value }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      await loadAll();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setVoteBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-neutral-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col">
        <section className="py-16 md:py-20 px-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Hack-a-Sprint 2026 — Showcase
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Sign in to view submissions, voting, and full instructions for
              submitting your project via GitHub.
            </p>
            <Link
              href="/login?redirect=/hackathons/hack-a-sprint-2026"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in to continue
            </Link>
            <p className="mt-6 text-sm text-neutral-500 space-x-3">
              <Link href="/hackathons/hack-a-sprint-2026/signup" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                Website signup &amp; ranking
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/hackathons" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                ← Back to Hackathons
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="py-10 md:py-14 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-2">
            April 13, 2026 · Back Bay, Boston
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Hack-a-Sprint 2026 — Showcase &amp; voting
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Build at the event, then submit your entry by opening a pull request
            to this site&apos;s repo. After your submission is merged, your card
            appears below. Three separate scores:{" "}
            <strong className="text-foreground">Participants</strong> (fellow
            builders with a merged submission PR),{" "}
            <strong className="text-foreground">Community</strong> (any signed-in
            member), and <strong className="text-foreground">Judges</strong>{" "}
            (designated reviewers).
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://luma.com/uixo8hl6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Event on Luma
            </a>
            <Link
              href="/hackathons/hack-a-sprint-2026/signup"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Website signup &amp; ranking
            </Link>
            <Link
              href="/hackathons"
              className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              Hackathons overview
            </Link>
          </div>
        </div>
      </section>

      <section className="py-10 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-xl font-bold text-foreground">
            How to submit (GitHub PR)
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-neutral-600 dark:text-neutral-400 text-sm md:text-base">
            <li>
              <a
                href={`${repoBase}/fork`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                Fork
              </a>{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">{repoBase}</code> on GitHub.
            </li>
            <li>
              Create a branch (e.g.{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                hack-a-sprint-submission
              </code>
              ).
            </li>
            <li>
              Add exactly one file:{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded break-all">
                {submissionsPath}/&lt;your-github-login&gt;.json
              </code>{" "}
              — the filename must match your GitHub username (the PR author).
            </li>
            <li>
              Copy the template below. Required fields:{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                projectRepoUrl
              </code>
              ,{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                deployedUrl
              </code>
              ,{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                title
              </code>
              ,{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                description
              </code>
              . Optional:{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                demoVideoUrl
              </code>
              .
            </li>
            <li>
              Open a PR that changes <strong>only</strong> that JSON file (no
              unrelated edits). CI will validate the schema.
            </li>
            <li>
              Ask a maintainer to add the label{" "}
              <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                {HACK_A_SPRINT_2026_LABEL}
              </code>{" "}
              when merging — that label is required for{" "}
              <strong>participant</strong> voting eligibility.
            </li>
            <li>
              Connect GitHub on your{" "}
              <Link href="/profile" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                profile
              </Link>{" "}
              so we can verify your merged submission PR.
            </li>
          </ol>
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              JSON template
            </p>
            <pre className="text-xs md:text-sm bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto border border-neutral-700">
              {JSON_TEMPLATE}
            </pre>
          </div>
        </div>
      </section>

      <section className="py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Submissions
          </h2>
          {me && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              Participant voting:{" "}
              {me.participantEligible
                ? "You’re eligible (merged PR with label)."
                : "Connect GitHub and merge a labeled submission PR to vote here."}{" "}
              · Community voting: everyone signed in. · Judges:{" "}
              {me.judgeEligible
                ? "you’re a judge."
                : "restricted to designated accounts."}
            </p>
          )}
          {loadError && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-4">
              {loadError}
            </p>
          )}
          {!data ? (
            <p className="text-neutral-500">Loading submissions…</p>
          ) : data.submissions.length === 0 ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              No submissions yet. Be the first to open a PR with your JSON file.
            </p>
          ) : (
            <ul className="space-y-8">
              {data.submissions.map((s) => {
                const agg = data.aggregates[s.submissionId] ?? {
                  participant: { up: 0, down: 0, net: 0 },
                  community: { up: 0, down: 0, net: 0 },
                  judge: { up: 0, down: 0, net: 0 },
                };
                const my = data.myVotes[s.submissionId] ?? {};
                return (
                  <li
                    key={s.submissionId}
                    className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1">
                          @{s.githubLogin}
                        </p>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {s.payload.title}
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mb-4">
                          {s.payload.description}
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <a
                            href={s.payload.projectRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                          >
                            GitHub repo
                          </a>
                          <a
                            href={s.payload.deployedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                          >
                            Live app
                          </a>
                          {s.payload.demoVideoUrl && (
                            <a
                              href={s.payload.demoVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                            >
                              Video
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-6">
                      {(
                        [
                          ["participant", "Participants", !me?.participantEligible],
                          ["community", "Community", false],
                          ["judge", "Judges", !me?.judgeEligible],
                        ] as const
                      ).map(([ch, label, disabled]) => (
                        <div
                          key={ch}
                          className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4"
                        >
                          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                            {label}
                          </p>
                          <p className="text-2xl font-bold text-foreground mb-3">
                            {agg[ch].net > 0 ? "+" : ""}
                            {agg[ch].net}
                            <span className="text-xs font-normal text-neutral-500 ml-2">
                              ({agg[ch].up}↑ {agg[ch].down}↓)
                            </span>
                          </p>
                          <VoteButtons
                            disabled={disabled}
                            disabledReason={
                              ch === "participant"
                                ? "Requires merged submission PR with label hack-a-sprint-2026"
                                : ch === "judge"
                                  ? "Judge-only"
                                  : undefined
                            }
                            current={my[ch]}
                            busy={voteBusy === `${s.submissionId}-${ch}`}
                            onVote={(v) =>
                              handleVote(
                                s.submissionId,
                                ch as Channel,
                                v as 1 | -1 | 0
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
