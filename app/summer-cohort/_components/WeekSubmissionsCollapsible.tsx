/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { SummerCohortVoteWeek } from "@/lib/summer-cohort";

interface SubmissionRow {
  githubHandle: string;
  repoUrl: string | null;
  loomUrl: string | null;
  liveUrl: string | null;
  pitch: string | null;
  competeForWin: boolean;
  allFieldsPresent: boolean;
  displayName: string | null;
  photoUrl: string | null;
}

interface SubmissionsResponse {
  weekId: string;
  branch: string;
  path: string;
  merged: number;
  tryingToWin: number;
  submissions: SubmissionRow[];
}

interface VotesResponse {
  weekId: string;
  counts: Record<string, number>;
  myVotes: string[];
  authenticated: boolean;
}

interface WeekSubmissionsCollapsibleProps {
  week: SummerCohortVoteWeek;
  tabId: string;
  /** Logged-in user's GitHub login (lowercased), if connected. Used to surface
   *  "you're submitted" / "not yet" status and to gate expansion. */
  currentUserGithubHandle: string | null;
  /** From userProfile.displayName — used to pre-populate the JSON example. */
  currentUserDisplayName: string | null;
  /** From userProfile.photoURL — used to pre-populate the JSON example. */
  currentUserPhotoUrl: string | null;
  /** Switches the parent CohortTabs to "my-info" so the user can connect
   *  GitHub. Called from the gating CTA. */
  onSwitchToMyInfo: () => void;
}

const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

function buildExampleJson(
  week: SummerCohortVoteWeek,
  githubHandle: string | null,
  displayName: string | null,
  photoUrl: string | null
): string {
  const handle = githubHandle ?? "your-handle";
  const name = (displayName ?? "Your Name").replace(/"/g, '\\"');
  const photo = photoUrl ?? "https://example.com/your-photo.jpg";
  const liveLine = week.liveUrlRequired
    ? `\n  "liveUrl": "https://yourthing.example.com",`
    : "";
  return `{
  "githubHandle": "${handle}",
  "name": "${name}",
  "photoUrl": "${photo}",
  "repoUrl": "https://github.com/${handle}/your-week-${week.week}-build",${liveLine}
  "loomUrl": "https://www.loom.com/share/...",
  "pitch": "One sentence on why you should win this week.",
  "competeForWin": true
}`;
}

function buildSubmissionPath(
  week: SummerCohortVoteWeek,
  githubHandle: string | null
): string {
  if (!githubHandle) return week.submissionPath;
  return week.submissionPath.replace("<github-handle>", githubHandle);
}

function statusForUser(
  data: SubmissionsResponse | null,
  handle: string | null
):
  | { kind: "no-handle" }
  | { kind: "loading" }
  | { kind: "submitted"; row: SubmissionRow }
  | { kind: "not-submitted" } {
  if (!handle) return { kind: "no-handle" };
  if (!data) return { kind: "loading" };
  const row = data.submissions.find(
    (s) => s.githubHandle.toLowerCase() === handle.toLowerCase()
  );
  if (row) return { kind: "submitted", row };
  return { kind: "not-submitted" };
}

export function WeekSubmissionsCollapsible({
  week,
  tabId,
  currentUserGithubHandle,
  currentUserDisplayName,
  currentUserPhotoUrl,
  onSwitchToMyInfo,
}: WeekSubmissionsCollapsibleProps) {
  const githubConnected = Boolean(currentUserGithubHandle);
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/summer-cohort/submissions/${tabId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SubmissionsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tabId]);

  // Fetch vote tallies. Refetch when auth state changes so signed-in users
  // see their `myVotes` populated, and signed-out users get a clean view.
  useEffect(() => {
    let cancelled = false;
    const headers: Record<string, string> = {};
    const fetchVotes = async () => {
      if (user) {
        try {
          const token = await user.getIdToken();
          headers.Authorization = `Bearer ${token}`;
        } catch {
          // Fall back to unauthenticated read.
        }
      }
      const res = await fetch(
        `/api/summer-cohort/votes?weekId=${encodeURIComponent(tabId)}`,
        { cache: "no-store", headers }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VotesResponse;
    };
    fetchVotes()
      .then((json) => {
        if (cancelled) return;
        setVoteCounts(json.counts ?? {});
        setMyVotes(new Set(json.myVotes ?? []));
      })
      .catch(() => {
        // Silent: votes are a soft enhancement; failure shouldn't block the
        // main submissions UI.
      });
    return () => {
      cancelled = true;
    };
  }, [tabId, user]);

  const toggleVote = useCallback(
    async (submitterHandle: string) => {
      if (!user) return;
      const handleKey = submitterHandle.toLowerCase();
      if (pendingVotes.has(handleKey)) return;

      const wasVoted = myVotes.has(handleKey);
      // Optimistic update.
      setMyVotes((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.delete(handleKey);
        else next.add(handleKey);
        return next;
      });
      setVoteCounts((prev) => ({
        ...prev,
        [handleKey]: Math.max(0, (prev[handleKey] ?? 0) + (wasVoted ? -1 : 1)),
      }));
      setPendingVotes((prev) => new Set(prev).add(handleKey));
      setVoteError(null);

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/summer-cohort/votes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ weekId: tabId, submitterHandle: handleKey }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          voted: boolean;
          count: number;
        };
        // Reconcile with the server.
        setMyVotes((prev) => {
          const next = new Set(prev);
          if (json.voted) next.add(handleKey);
          else next.delete(handleKey);
          return next;
        });
        setVoteCounts((prev) => ({ ...prev, [handleKey]: json.count }));
      } catch (err) {
        // Roll back the optimistic update.
        setMyVotes((prev) => {
          const next = new Set(prev);
          if (wasVoted) next.add(handleKey);
          else next.delete(handleKey);
          return next;
        });
        setVoteCounts((prev) => ({
          ...prev,
          [handleKey]: Math.max(
            0,
            (prev[handleKey] ?? 0) + (wasVoted ? 1 : -1)
          ),
        }));
        setVoteError(err instanceof Error ? err.message : "Vote failed");
      } finally {
        setPendingVotes((prev) => {
          const next = new Set(prev);
          next.delete(handleKey);
          return next;
        });
      }
    },
    [user, myVotes, pendingVotes, tabId]
  );

  const yourStatus = useMemo(
    () => statusForUser(data, currentUserGithubHandle),
    [data, currentUserGithubHandle]
  );

  const merged = data?.merged ?? null;
  const tryingToWin = data?.tryingToWin ?? null;
  const branchUrl = `${REPO_URL}/tree/${week.submissionBranch}`;
  const dirUrl = data
    ? `${REPO_URL}/tree/${week.submissionBranch}/${data.path}`
    : null;
  const submissionPath = buildSubmissionPath(week, currentUserGithubHandle);
  const exampleJson = buildExampleJson(
    week,
    currentUserGithubHandle,
    currentUserDisplayName,
    currentUserPhotoUrl
  );

  const headerSummary = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <GitPullRequest
          className="h-4 w-4"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        Submissions — the focus of the week
      </div>
      <p className="mt-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {merged === null ? (
          error ? (
            <span className="text-amber-700 dark:text-amber-400">
              Couldn&apos;t load — refresh to retry.
            </span>
          ) : (
            <span className="text-neutral-500">Loading counts…</span>
          )
        ) : (
          <>
            <span className="tabular-nums">{merged}</span> merged ·{" "}
            <span className="tabular-nums">{tryingToWin}</span> trying to win
          </>
        )}
      </p>
      {yourStatus.kind === "submitted" ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2
            className="h-3 w-3"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          Your submission is merged
          {yourStatus.row.competeForWin && yourStatus.row.allFieldsPresent
            ? " · trying to win"
            : ""}
        </p>
      ) : yourStatus.kind === "not-submitted" ? (
        <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
          No submission from <strong>@{currentUserGithubHandle}</strong> yet —
          expand for the merge instructions.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/40 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/20">
      {githubConnected ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`submissions-${tabId}-body`}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition-colors hover:bg-emerald-100/40 dark:hover:bg-emerald-900/20"
        >
          {headerSummary}
          <span className="shrink-0 text-emerald-700 dark:text-emerald-400">
            {expanded ? (
              <ChevronUp className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            )}
          </span>
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4">
          {headerSummary}
          <button
            type="button"
            onClick={onSwitchToMyInfo}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            Connect GitHub
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      )}
      {!githubConnected ? (
        <p className="border-t border-emerald-200 px-5 py-3 text-xs text-emerald-900 dark:border-emerald-900 dark:text-emerald-200">
          Connect your GitHub on the My Info tab so we can match your
          submission to your profile and surface the merge instructions
          pre-populated with your name + photo.
        </p>
      ) : null}

      {expanded ? (
        <div
          id={`submissions-${tabId}-body`}
          className="border-t border-neutral-200 px-4 py-4 dark:border-neutral-800"
        >
          {/* Merge instructions — full set, pre-populated with your profile */}
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-300">
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              How to get on this list
            </p>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Required fields: repo URL, Loom URL
              {week.liveUrlRequired ? ", live URL" : ""}, and a one-sentence
              pitch. Set <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">competeForWin: true</code> to
              be counted as <em>trying to win</em>.
            </p>

            <ol className="mt-4 space-y-3">
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  1
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Open a PR against{" "}
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">
                      {week.submissionBranch}
                    </code>
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Base branch on{" "}
                    <a
                      href={REPO_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-emerald-600/60 underline-offset-2 hover:decoration-emerald-600"
                    >
                      rogerSuperBuilderAlpha/cursor-boston
                      <ExternalLink
                        className="ml-1 inline-block h-3 w-3"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                    </a>
                    .
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  2
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Add one JSON file
                  </p>
                  <p className="mt-1 break-all text-xs text-neutral-600 dark:text-neutral-400">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">
                      {submissionPath}
                    </code>
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    File contents — pre-filled with your profile
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Your name and photo are pulled from your Cursor Boston
                    profile so submissions render with your face. Tweak the
                    repo / Loom / pitch fields, then commit.
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                    <code>{exampleJson}</code>
                  </pre>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  4
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Sign your commit (DCO)
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Use{" "}
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold dark:bg-neutral-800">
                      git commit -s
                    </code>{" "}
                    so the Developer Certificate of Origin trailer is added.
                    See{" "}
                    <a
                      href={`${REPO_URL}/blob/develop/docs/FIRST_CONTRIBUTION.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-emerald-600/60 underline-offset-2 hover:decoration-emerald-600"
                    >
                      FIRST_CONTRIBUTION.md
                    </a>{" "}
                    if you&apos;re new to this repo.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  5
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Once merged, you appear here
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Roger merges your PR; your file lands on{" "}
                    <a
                      href={dirUrl ?? branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
                    >
                      the submissions directory
                      <ExternalLink
                        className="ml-1 inline-block h-3 w-3"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                    </a>
                    , and the count above ticks up.
                  </p>
                </div>
              </li>
            </ol>

            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <strong>Voting:</strong> anyone signed in can upvote any
              trying-to-win submission below — vote for all, some, or none.
              The submission with the most votes at the end wins the week.
            </p>
          </div>

          {/* List */}
          <div className="mt-4">
            {error ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Couldn&apos;t load submissions: {error}.
              </p>
            ) : !data ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : data.submissions.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No merged submissions yet — be the first.
              </p>
            ) : (<>

              <ul className="space-y-2">
                {data.submissions.map((s) => {
                  const isCompeting = s.allFieldsPresent && s.competeForWin;
                  const handleKey = s.githubHandle.toLowerCase();
                  const voteCount = voteCounts[handleKey] ?? 0;
                  const haveVoted = myVotes.has(handleKey);
                  const isPending = pendingVotes.has(handleKey);
                  const initial = (s.displayName || s.githubHandle || "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <li
                      key={s.githubHandle}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
                    >
                      {s.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs come from arbitrary OAuth providers (GitHub, Google), not the configured Next image domain list
                        <img
                          src={s.photoUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 shrink-0 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {initial}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {s.displayName || `@${s.githubHandle}`}
                        </p>
                        <a
                          href={`https://github.com/${s.githubHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-700"
                        >
                          @{s.githubHandle}
                        </a>
                      </div>
                      {isCompeting ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <Trophy
                            className="h-3 w-3"
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                          trying to win
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-neutral-200/60 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          submitted
                        </span>
                      )}
                      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        {s.repoUrl ? (
                          <a
                            href={s.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
                          >
                            repo
                          </a>
                        ) : null}
                        {s.loomUrl ? (
                          <a
                            href={s.loomUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
                          >
                            loom
                          </a>
                        ) : null}
                        {s.liveUrl ? (
                          <a
                            href={s.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
                          >
                            live
                          </a>
                        ) : null}
                        {isCompeting ? (
                          user ? (
                            <button
                              type="button"
                              onClick={() => toggleVote(s.githubHandle)}
                              disabled={isPending}
                              aria-pressed={haveVoted}
                              aria-label={
                                haveVoted
                                  ? `Remove your vote for ${s.githubHandle}`
                                  : `Upvote ${s.githubHandle}`
                              }
                              className={
                                haveVoted
                                  ? "inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-400"
                                  : "inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                              }
                            >
                              <ThumbsUp
                                className="h-3 w-3"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                              <span className="tabular-nums">{voteCount}</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
                              title="Sign in to vote"
                            >
                              <ThumbsUp
                                className="h-3 w-3"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              />
                              <span className="tabular-nums">{voteCount}</span>
                            </span>
                          )
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {voteError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Vote couldn&apos;t be saved: {voteError}.
                </p>
              ) : null}
              {!user ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Sign in to upvote submissions you want to win.
                </p>
              ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
