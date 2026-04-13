/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getGithubRepoWebBaseUrl } from "@/lib/github-recent-merged-prs";
import {
  HACK_A_SPRINT_2026_LABEL,
  HACK_A_SPRINT_2026_SUBMISSIONS_PATH,
} from "@/lib/hackathon-showcase";
import type { ShowcaseSubmission } from "@/lib/hackathon-showcase";
import type { HackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

type MeResponse = {
  phase: HackASprint2026Phase;
  signedUp: boolean;
  checkedIn: boolean;
  hasCompletedPeerVoting: boolean;
  participantEligible: boolean;
  judgeEligible: boolean;
  githubLogin: string | null;
};

type SubmissionRow = ShowcaseSubmission & {
  peerVoteCount: number | null;
  aiScore: number | null;
  judgeAverage: number | null;
  rawScore: number | null;
  myJudgeScore: number | null;
};

type SubmissionsResponse = {
  phase: HackASprint2026Phase;
  viewer: {
    checkedIn: boolean;
    signedUp: boolean;
    hasCompletedPeerVoting: boolean;
    judgeEligible: boolean;
    myPeerPicks: string[];
  };
  submissions: SubmissionRow[];
};

const JSON_TEMPLATE = `{
  "projectRepoUrl": "https://github.com/your-username/your-hack-project",
  "deployedUrl": "https://your-app.example.com",
  "title": "Short title for your build",
  "description": "What you built, stack, and learnings.",
  "loomVideoUrl": "https://www.loom.com/share/your-recording"
}`;

const PHASE_LABEL: Record<HackASprint2026Phase, string> = {
  preEvent: "Before event (opens 5:00 PM ET)",
  submissionOpen: "Build & submit",
  peerVotingOpen: "Peer voting & judging",
  resultsOpen: "Final results",
};

export default function HackASprint2026ShowcasePage() {
  const { user, loading: authLoading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [peerSelected, setPeerSelected] = useState<Set<string>>(new Set());
  const [peerBusy, setPeerBusy] = useState(false);
  const [judgeBusy, setJudgeBusy] = useState<string | null>(null);
  const [creditCode, setCreditCode] = useState<{
    eligible: boolean;
    creditUrl?: string;
    reason?: string;
  } | null>(null);

  const repoBase = getGithubRepoWebBaseUrl();
  const submissionsPath = HACK_A_SPRINT_2026_SUBMISSIONS_PATH;

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, subRes, creditRes] = await Promise.all([
        fetch("/api/hackathons/showcase/hack-a-sprint-2026/me", { headers }),
        fetch("/api/hackathons/showcase/hack-a-sprint-2026/submissions", {
          headers,
        }),
        fetch("/api/hackathons/showcase/hack-a-sprint-2026/credit-code", {
          headers,
        }),
      ]);
      if (!meRes.ok) {
        throw new Error("Could not load eligibility");
      }
      if (!subRes.ok) {
        throw new Error("Could not load submissions");
      }
      const meJson = (await meRes.json()) as MeResponse;
      const subJson = (await subRes.json()) as SubmissionsResponse;
      setMe(meJson);
      setData(subJson);
      setPeerSelected(new Set(subJson.viewer.myPeerPicks ?? []));
      if (creditRes.ok) {
        setCreditCode(await creditRes.json());
      }
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

  useEffect(() => {
    if (!user || !me) return;
    const t = window.setInterval(() => void loadAll(), 45_000);
    return () => window.clearInterval(t);
  }, [user, me, loadAll]);

  const togglePeerPick = (submissionId: string) => {
    setPeerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else if (next.size < 6) {
        next.add(submissionId);
      }
      return next;
    });
  };

  const submitPeerPicks = async () => {
    if (!user || peerSelected.size !== 6) return;
    setPeerBusy(true);
    setLoadError(null);
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
          body: JSON.stringify({ submissionIds: [...peerSelected] }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || "Could not save picks");
      }
      await loadAll();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not save picks");
    } finally {
      setPeerBusy(false);
    }
  };

  const submitJudgeScore = async (submissionId: string, score: number) => {
    if (!user) return;
    setJudgeBusy(submissionId);
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/judge-score",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submissionId, score }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || "Judge save failed");
      }
      await loadAll();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Judge save failed");
    } finally {
      setJudgeBusy(null);
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
              Hack-a-Sprint 2026
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Sign in for the live schedule, event passcode, submission
              instructions, and voting — all on this page during the event on April
              13, 2026.
            </p>
            <Link
              href="/login?redirect=/hackathons/hack-a-sprint-2026"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in to continue
            </Link>
            <p className="mt-6 text-sm text-neutral-500 space-x-3">
              <Link
                href="/hackathons/hack-a-sprint-2026/signup"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Website signup &amp; ranking
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/hackathons/hack-a-sprint-2026/instructions"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Pre-event instructions
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/hackathons"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                ← Hackathons
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  const phase = me?.phase ?? data?.phase;
  const checkedIn = me?.checkedIn ?? data?.viewer.checkedIn;

  const viewer = data?.viewer;
  const judgeEligible = me?.judgeEligible ?? viewer?.judgeEligible;

  if (!me && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-neutral-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!checkedIn) {
    return (
      <div className="flex flex-col">
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Hack-a-Sprint 2026
            </h1>
            <div className="rounded-2xl border-2 border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/30 p-8 mb-6">
              <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mb-2">
                BLOCKED
              </p>
              <p className="text-sm text-rose-600 dark:text-rose-400">
                You have not been checked in for the hackathon. Ask an organizer
                at the door to check you in.
              </p>
            </div>
            <p className="text-sm text-neutral-500 space-x-3">
              <Link
                href="/hackathons/hack-a-sprint-2026/instructions"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Pre-event instructions
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/hackathons"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                ← Hackathons
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
            Hack-a-Sprint 2026 — Live hub
          </h1>
          {phase && (
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
              Current phase: {PHASE_LABEL[phase]}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/hackathons/hack-a-sprint-2026/instructions"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Instructions &amp; challenge details
            </Link>
            <Link
              href="/hackathons/hack-a-sprint-2026/signup"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Signup &amp; ranking
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

      {(phase === "submissionOpen" ||
        phase === "peerVotingOpen" ||
        phase === "resultsOpen") && (
        <section className="py-10 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-foreground">
              How to submit (GitHub PR)
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your submission is one JSON file merged into this repo. It must
              include a public{" "}
              <strong className="text-foreground">GitHub repo</strong>, a{" "}
              <strong className="text-foreground">deployed link</strong>,{" "}
              <strong className="text-foreground">title</strong>,{" "}
              <strong className="text-foreground">description</strong>, and a{" "}
              <strong className="text-foreground">Loom video</strong> of you
              explaining the project.
            </p>
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
                <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                  {repoBase}
                </code>
                .
              </li>
              <li>Create a branch (e.g. hack-a-sprint-submission).</li>
              <li>
                Add one file:{" "}
                <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded break-all">
                  {submissionsPath}/&lt;your-github-login&gt;.json
                </code>{" "}
                (filename must match the PR author).
              </li>
              <li>
                Use the template below; <code>loomVideoUrl</code> is required.
              </li>
              <li>
                Open a PR that only changes that JSON file. CI validates the
                schema.
              </li>
              <li>
                Maintainers add label{" "}
                <code className="text-xs bg-neutral-200 dark:bg-neutral-800 px-1 rounded">
                  {HACK_A_SPRINT_2026_LABEL}
                </code>{" "}
                when merging. Connect GitHub on your{" "}
                <Link href="/profile" className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  profile
                </Link>
                .
              </li>
            </ol>
            <pre className="text-xs md:text-sm bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto border border-neutral-700">
              {JSON_TEMPLATE}
            </pre>
          </div>
        </section>
      )}

      {creditCode?.eligible && creditCode.creditUrl && (
        <section className="py-6 px-6">
          <div className="max-w-3xl mx-auto rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 p-6">
            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-2">
              Your $50 Cursor Credit
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4">
              Thank you for submitting your project! Here is your personal Cursor credit link. This code is unique to you — do not share it.
            </p>
            <a
              href={creditCode.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
            >
              Claim your $50 Cursor credit
            </a>
          </div>
        </section>
      )}

      <section className="py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Submissions &amp; voting
          </h2>
          {loadError && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-4" role="alert">
              {loadError}
            </p>
          )}
          {!data || !me ? (
            <p className="text-neutral-500">Loading…</p>
          ) : phase === "submissionOpen" ? (
            <p className="text-neutral-600 dark:text-neutral-400 text-sm">
              Project gallery opens at 7:15 PM ET for peer voting. Finish your PR
              submission before then.
            </p>
          ) : data.submissions.length === 0 ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              No merged submissions yet.
            </p>
          ) : (
            <>
              {phase === "peerVotingOpen" && (
                <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900/50">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                    Pick exactly <strong>6</strong> favorite projects ({peerSelected.size}
                    /6 selected). Submit to lock in your vote and reveal AI scores.
                    Judge scores stay hidden until 7:45 PM ET.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={peerBusy || peerSelected.size !== 6}
                      onClick={() => void submitPeerPicks()}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {peerBusy ? "Saving…" : "Submit my 6 picks"}
                    </button>
                    {viewer?.hasCompletedPeerVoting && (
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 self-center">
                        Picks saved — AI scores unlocked for you below.
                      </span>
                    )}
                  </div>
                </div>
              )}
              {phase === "resultsOpen" && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                  Final ordering: raw score (average of judges + AI, rounded up), then
                  peer votes as tiebreaker.
                </p>
              )}
              <ul className="space-y-8">
                {data.submissions.map((s) => {
                  const isPicked = peerSelected.has(s.submissionId);
                  const showScores =
                    phase === "resultsOpen" ||
                    (phase === "peerVotingOpen" && viewer?.hasCompletedPeerVoting);
                  return (
                    <li
                      key={s.submissionId}
                      className={`rounded-2xl border p-6 shadow-sm ${
                        isPicked && phase === "peerVotingOpen"
                          ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                      }`}
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
                              Repo
                            </a>
                            <a
                              href={s.payload.deployedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                            >
                              Live app
                            </a>
                            <a
                              href={s.payload.loomVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                            >
                              Loom
                            </a>
                          </div>
                        </div>
                        {phase === "peerVotingOpen" && (
                          <button
                            type="button"
                            onClick={() => togglePeerPick(s.submissionId)}
                            disabled={
                              !isPicked && peerSelected.size >= 6
                            }
                            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
                              isPicked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            } disabled:opacity-40`}
                          >
                            {isPicked ? "Selected" : "Pick"}
                          </button>
                        )}
                      </div>

                      {judgeEligible && phase === "peerVotingOpen" && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                          <label className="text-xs font-semibold text-neutral-500 uppercase">
                            Your score (1–10)
                          </label>
                          {s.myJudgeScore != null && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Scored: {s.myJudgeScore}
                            </span>
                          )}
                          <select
                            defaultValue=""
                            disabled={judgeBusy === s.submissionId}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (v >= 1 && v <= 10) {
                                void submitJudgeScore(s.submissionId, v);
                              }
                              e.target.value = "";
                            }}
                            className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1 text-sm"
                          >
                            <option value="" disabled>
                              {s.myJudgeScore != null ? "Change…" : "Set…"}
                            </option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                          {judgeBusy === s.submissionId && (
                            <span className="text-xs text-neutral-500">Saving…</span>
                          )}
                        </div>
                      )}

                      {showScores && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-neutral-200 dark:border-neutral-700 pt-4">
                          {s.aiScore != null && (
                            <div>
                              <p className="text-xs text-neutral-500">AI score</p>
                              <p className="font-semibold text-foreground">{s.aiScore}</p>
                            </div>
                          )}
                          {phase === "resultsOpen" && s.judgeAverage != null && (
                            <div>
                              <p className="text-xs text-neutral-500">Judge avg</p>
                              <p className="font-semibold text-foreground">
                                {s.judgeAverage.toFixed(2)}
                              </p>
                            </div>
                          )}
                          {phase === "resultsOpen" && s.rawScore != null && (
                            <div>
                              <p className="text-xs text-neutral-500">Raw score</p>
                              <p className="font-semibold text-foreground">{s.rawScore}</p>
                            </div>
                          )}
                          {phase === "resultsOpen" && s.peerVoteCount != null && (
                            <div>
                              <p className="text-xs text-neutral-500">Peer votes</p>
                              <p className="font-semibold text-foreground">
                                {s.peerVoteCount}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
