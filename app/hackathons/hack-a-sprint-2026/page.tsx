/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  prizeEligible: boolean;
  highScoreCount: number;
  requiredHighScores: number;
  participantEligible: boolean;
  judgeEligible: boolean;
  githubLogin: string | null;
};

type SubmissionRow = ShowcaseSubmission & {
  peerAverage: number | null;
  peerVoteCount: number | null;
  aiScore: number | null;
  aiRank: number | null;
  aiReasoning: string | null;
  judgeAverage: number | null;
  rawScore: number | null;
  myJudgeScore: number | null;
  myParticipantScore: number | null;
};

type SubmissionsResponse = {
  phase: HackASprint2026Phase;
  viewer: {
    checkedIn: boolean;
    signedUp: boolean;
    hasCompletedPeerVoting: boolean;
    judgeEligible: boolean;
    isJudge: boolean;
    peerScoresRevealed: boolean;
    myParticipantScores: Record<string, number>;
  };
  submissions: SubmissionRow[];
};

type GallerySortKey = "title" | "github" | "aiScore" | "peerAvg";

function compareSubmissionRows(
  a: SubmissionRow,
  b: SubmissionRow,
  key: GallerySortKey,
  asc: boolean
): number {
  const dir = asc ? 1 : -1;
  if (key === "title") {
    return (
      dir *
      a.payload.title.localeCompare(b.payload.title, "en", { sensitivity: "base" })
    );
  }
  if (key === "github") {
    return (
      dir *
      a.githubLogin.localeCompare(b.githubLogin, "en", { sensitivity: "base" })
    );
  }
  const na = key === "aiScore" ? a.aiScore : a.peerAverage;
  const nb = key === "aiScore" ? b.aiScore : b.peerAverage;
  if (na == null && nb == null) return 0;
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na === nb) return 0;
  return dir * (na < nb ? -1 : 1);
}

const JSON_TEMPLATE = `{
  "projectRepoUrl": "https://github.com/your-username/your-hack-project",
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

const PEER_VOTING_REDIRECT_KEY = "hackASprint2026_redirect_peer_voting";

export default function HackASprint2026ShowcasePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<SubmissionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [participantBusy, setParticipantBusy] = useState<string | null>(null);
  const [judgeBusy, setJudgeBusy] = useState<string | null>(null);
  const [creditCode, setCreditCode] = useState<{
    eligible: boolean;
    creditUrl?: string;
    reason?: string;
  } | null>(null);
  const [creditEmailBusy, setCreditEmailBusy] = useState(false);
  const [creditEmailMessage, setCreditEmailMessage] = useState<string | null>(null);
  const [gallerySearch, setGallerySearch] = useState("");
  const [gallerySortKey, setGallerySortKey] = useState<GallerySortKey>("title");
  const [gallerySortAsc, setGallerySortAsc] = useState(true);

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
      if (creditRes.ok) {
        setCreditCode(await creditRes.json());
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [user]);

  const isOwnSubmission = useCallback(
    (s: SubmissionRow) =>
      Boolean(
        me?.githubLogin &&
          s.githubLogin.trim().toLowerCase() ===
            me.githubLogin.trim().toLowerCase()
      ),
    [me?.githubLogin]
  );

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

  useEffect(() => {
    if (!me?.participantEligible || !me?.checkedIn) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(PEER_VOTING_REDIRECT_KEY)) return;
    sessionStorage.setItem(PEER_VOTING_REDIRECT_KEY, "1");
    router.replace(`${pathname}#peer-voting`);
  }, [me?.participantEligible, me?.checkedIn, pathname, router]);

  const submitParticipantScore = async (submissionId: string, score: number) => {
    if (!user) return;
    setParticipantBusy(submissionId);
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/participant-score",
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
        throw new Error((j as { error?: string }).error || "Could not save score");
      }
      await loadAll();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not save score");
    } finally {
      setParticipantBusy(null);
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

  const sendCreditEmail = async () => {
    if (!user) return;
    setCreditEmailBusy(true);
    setCreditEmailMessage(null);
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/credit-email",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        alreadySent?: boolean;
      };
      if (!res.ok) {
        throw new Error(j.error || "Could not send email");
      }
      setCreditEmailMessage(
        j.alreadySent
          ? j.message ?? "Already sent."
          : "Check your inbox for your Cursor credit link."
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not send email");
    } finally {
      setCreditEmailBusy(false);
    }
  };

  const peerProgress = useMemo(() => {
    if (!data?.submissions || !me?.githubLogin) {
      return { totalOthers: 0, scored: 0 };
    }
    const own = me.githubLogin.trim().toLowerCase();
    const others = data.submissions.filter(
      (s) => s.githubLogin.trim().toLowerCase() !== own
    );
    const scores = data.viewer?.myParticipantScores ?? {};
    let scored = 0;
    for (const s of others) {
      const v = scores[s.submissionId.toLowerCase()];
      if (typeof v === "number" && v >= 1 && v <= 10) scored++;
    }
    return { totalOthers: others.length, scored };
  }, [data?.submissions, data?.viewer?.myParticipantScores, me?.githubLogin]);

  const isJudgeView = data?.viewer.isJudge ?? false;
  const peerScoresRevealed = data?.viewer.peerScoresRevealed ?? false;
  const participantQueueMode = Boolean(
    data &&
      me &&
      !isJudgeView &&
      !data.viewer.hasCompletedPeerVoting
  );

  const { queueUnscored, queueScored, queueOwn, galleryList } = useMemo(() => {
    if (!data?.submissions?.length || !me?.githubLogin) {
      return {
        queueUnscored: [] as SubmissionRow[],
        queueScored: [] as SubmissionRow[],
        queueOwn: null as SubmissionRow | null,
        galleryList: data?.submissions ?? [],
      };
    }
    const ownGh = me.githubLogin.trim().toLowerCase();
    const q = gallerySearch.trim().toLowerCase();
    const matches = (s: SubmissionRow) =>
      !q ||
      s.payload.title.toLowerCase().includes(q) ||
      s.githubLogin.toLowerCase().includes(q);

    const others = data.submissions.filter(
      (s) => s.githubLogin.trim().toLowerCase() !== ownGh
    );
    const ownRow =
      data.submissions.find(
        (s) => s.githubLogin.trim().toLowerCase() === ownGh
      ) ?? null;

    const unscored = others
      .filter((s) => s.myParticipantScore == null)
      .filter(matches)
      .sort((a, b) =>
        a.payload.title.localeCompare(b.payload.title, "en", {
          sensitivity: "base",
        })
      );

    const scored = others
      .filter(
        (s) =>
          typeof s.myParticipantScore === "number" &&
          s.myParticipantScore >= 1 &&
          s.myParticipantScore <= 10
      )
      .filter(matches)
      .sort((a, b) =>
        a.payload.title.localeCompare(b.payload.title, "en", {
          sensitivity: "base",
        })
      );

    const galleryListSorted = [...data.submissions]
      .filter(matches)
      .sort((a, b) =>
        compareSubmissionRows(a, b, gallerySortKey, gallerySortAsc)
      );

    return {
      queueUnscored: unscored,
      queueScored: scored,
      queueOwn: ownRow,
      galleryList: galleryListSorted,
    };
  }, [
    data,
    me?.githubLogin,
    gallerySearch,
    gallerySortKey,
    gallerySortAsc,
  ]);

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
              Sign in for the live schedule, submission instructions, peer scoring,
              and results — all on this page during the event on April 13, 2026.
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

  function SubmissionCard({
    s,
    ownQueueNote,
  }: {
    s: SubmissionRow;
    ownQueueNote?: string;
  }) {
    const own = isOwnSubmission(s);
    const showCommunityBlock =
      peerScoresRevealed &&
      (phase === "peerVotingOpen" || phase === "resultsOpen") &&
      (s.peerAverage != null ||
        (phase === "resultsOpen" && s.judgeAverage != null) ||
        (phase === "resultsOpen" && s.rawScore != null));

    return (
      <li className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm bg-white dark:bg-neutral-900">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1">
              @{s.githubLogin}
              {own && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                  (you)
                </span>
              )}
            </p>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {s.payload.title}
            </h3>
            {ownQueueNote ? (
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                {ownQueueNote}
              </p>
            ) : null}
            {s.aiRank != null && s.aiScore != null && (
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                AI rank #{s.aiRank} · {s.aiScore}/10
              </p>
            )}
            <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mb-4">
              {s.payload.description.trim()
                ? s.payload.description
                : "No description in submission yet."}
            </p>
            <div className="flex flex-wrap gap-3 text-sm items-center">
              {s.payload.projectRepoUrl.trim() ? (
                <a
                  href={s.payload.projectRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Repo
                </a>
              ) : (
                <span className="text-neutral-500">No repo URL</span>
              )}
              {s.payload.deployedUrl ? (
                <a
                  href={s.payload.deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Live app
                </a>
              ) : null}
              {s.payload.loomVideoUrl?.trim() ? (
                <a
                  href={s.payload.loomVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Walkthrough video
                </a>
              ) : (
                <span className="text-neutral-500">No walkthrough yet</span>
              )}
            </div>
            {s.aiScore != null && (
              <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950/40 px-4 py-3 text-sm">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Automated evaluation (not based on peer scores).
                </p>
                <p className="font-semibold text-foreground mb-1">
                  Why this AI score
                </p>
                {s.aiReasoning ? (
                  <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
                    {s.aiReasoning}
                  </p>
                ) : (
                  <p className="text-neutral-500 dark:text-neutral-500 text-xs italic">
                    No written review stored yet — re-run AI evaluation to attach
                    reasoning.
                  </p>
                )}
              </div>
            )}
          </div>
          {!own && (
            <div className="shrink-0 flex flex-col gap-1">
              <label className="text-xs font-semibold text-neutral-500 uppercase">
                Your peer score (1–10)
              </label>
              <select
                disabled={participantBusy === s.submissionId}
                value={
                  s.myParticipantScore != null
                    ? String(s.myParticipantScore)
                    : ""
                }
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 10) {
                    void submitParticipantScore(s.submissionId, v);
                  }
                }}
                className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-1 text-sm min-w-[5rem]"
              >
                <option value="" disabled>
                  Set…
                </option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {participantBusy === s.submissionId && (
                <span className="text-xs text-neutral-500">Saving…</span>
              )}
            </div>
          )}
        </div>

        {judgeEligible && phase === "peerVotingOpen" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <label className="text-xs font-semibold text-neutral-500 uppercase">
              Judge score (1–10)
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

        {showCommunityBlock && (
          <div className="mt-4 space-y-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Community &amp; finals
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              Peer and judge figures are separate from the automated AI block
              above.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {(phase === "peerVotingOpen" || phase === "resultsOpen") &&
                s.peerAverage != null && (
                  <div>
                    <p className="text-xs text-neutral-500">Peer avg</p>
                    <p className="font-semibold text-foreground">
                      {s.peerAverage.toFixed(2)}
                    </p>
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
            </div>
          </div>
        )}
      </li>
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
              <strong className="text-foreground">GitHub repo</strong> for your
              project, a <strong className="text-foreground">title</strong>,{" "}
              <strong className="text-foreground">description</strong>, and a{" "}
              <strong className="text-foreground">Loom video</strong> (or similar)
              walkthrough. A live <strong className="text-foreground">deployedUrl</strong>{" "}
              is optional if you add one.
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
                Use the template below; add <code>loomVideoUrl</code> when you can — the gallery still lists your entry if some fields are missing.
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
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href={creditCode.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                Claim your $50 Cursor credit
              </a>
              <button
                type="button"
                disabled={creditEmailBusy}
                onClick={() => void sendCreditEmail()}
                className="inline-block rounded-lg border-2 border-emerald-600 px-5 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50"
              >
                {creditEmailBusy ? "Sending…" : "Email me this link"}
              </button>
            </div>
            {creditEmailMessage && (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                {creditEmailMessage}
              </p>
            )}
          </div>
        </section>
      )}

      <section id="peer-voting" className="py-10 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-2">
            Submissions &amp; peer scoring
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 max-w-3xl">
            <strong className="text-foreground">Peer scores</strong> are a community ballot
            (1–10 on every <em>other</em> project).{" "}
            <strong className="text-foreground">Automated AI scores</strong> and{" "}
            <strong className="text-foreground">community averages</strong> stay hidden until
            you have submitted a peer score for every other project. Judges and organizers see
            full scores immediately.
          </p>
          {loadError && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-4" role="alert">
              {loadError}
            </p>
          )}
          {!data || !me ? (
            <p className="text-neutral-500">Loading…</p>
          ) : data.submissions.length === 0 ? (
            <p className="text-neutral-600 dark:text-neutral-400">
              No merged submissions yet.
            </p>
          ) : (
            <>
              <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900/50 space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {participantQueueMode ? (
                      <>
                        Below you only see <strong className="text-foreground">projects you
                        have not scored yet</strong>. Use{" "}
                        <strong className="text-foreground">Change a score</strong> if you need
                        to fix a rating. Your own project is listed separately — you cannot
                        score it.
                      </>
                    ) : (
                      <>
                        Score <strong>every other project</strong> from <strong>1–10</strong>.
                        You can change peer scores anytime. AI and community averages are
                        visible now that your ballot is complete.
                      </>
                    )}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Progress:{" "}
                    <strong className="text-foreground">
                      {peerProgress.scored}/{peerProgress.totalOthers}
                    </strong>{" "}
                    scored.
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      me.prizeEligible
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    Prize eligibility: give a score <strong>above 8</strong> (9 or 10) to
                    at least{" "}
                    <strong>
                      {me.requiredHighScores}
                    </strong>{" "}
                    other project{me.requiredHighScores === 1 ? "" : "s"}. You have{" "}
                    <strong>{me.highScoreCount}</strong> so far.
                    {me.prizeEligible
                      ? " You meet this bar."
                      : " Keep scoring to qualify to win."}
                  </p>
                  {viewer?.hasCompletedPeerVoting && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      Peer ballot complete — AI scores, your scores, and community averages are
                      shown on each card (judge/raw row when results are open).
                    </p>
                  )}
                  {!peerScoresRevealed && !isJudgeView && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Finish scoring <strong className="text-foreground">every other</strong>{" "}
                      project to unlock automated AI scores and peer averages.
                    </p>
                  )}
                </div>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="flex flex-col gap-1 text-sm min-w-[12rem] flex-1">
                  <span className="font-medium text-neutral-600 dark:text-neutral-400">
                    Search (title or @github)
                  </span>
                  <input
                    type="search"
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                    placeholder="Filter…"
                    className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                  />
                </label>
                {!participantQueueMode && (
                  <>
                    <label className="flex flex-col gap-1 text-sm min-w-[10rem]">
                      <span className="font-medium text-neutral-600 dark:text-neutral-400">
                        Sort by
                      </span>
                      <select
                        value={gallerySortKey}
                        onChange={(e) =>
                          setGallerySortKey(e.target.value as GallerySortKey)
                        }
                        className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2 py-2 text-sm"
                      >
                        <option value="title">Project title</option>
                        <option value="github">GitHub name</option>
                        <option value="aiScore">AI score</option>
                        <option value="peerAvg">Peer average</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setGallerySortAsc((v) => !v)}
                      className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      {gallerySortAsc ? "Ascending" : "Descending"}
                    </button>
                  </>
                )}
              </div>
              {phase === "resultsOpen" && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                  <strong className="text-foreground">Official order</strong> uses raw score
                  from judges and automated AI only (independent of peer ballots). Average
                  peer score (1–10) breaks ties. The AI rank on each card is for context and
                  is not derived from peer voting.
                </p>
              )}
              {peerScoresRevealed &&
                data.submissions.some((s) => s.aiRank != null) && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                  Cards show <strong className="text-foreground">AI rank</strong> (1 = best)
                  and reasoning when available. Use sort above to reorder the gallery.
                </p>
              )}
              {participantQueueMode ? (
                <>
                  {queueOwn ? (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                        Your submission
                      </h3>
                      <ul className="space-y-8">
                        <SubmissionCard
                          key={queueOwn.submissionId}
                          s={queueOwn}
                          ownQueueNote="Automated AI score and community peer average for your project unlock after you finish scoring everyone else."
                        />
                      </ul>
                    </div>
                  ) : null}
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
                    Projects to score next ({queueUnscored.length})
                  </h3>
                  {queueUnscored.length === 0 && !queueOwn ? (
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
                      No submissions match your filter, or there is nothing left to score.
                    </p>
                  ) : null}
                  <ul className="space-y-8 mb-8">
                    {queueUnscored.map((s) => (
                      <SubmissionCard key={s.submissionId} s={s} />
                    ))}
                  </ul>
                  {queueScored.length > 0 ? (
                    <details className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/50 p-4 mb-8">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">
                        Change a score you already gave ({queueScored.length})
                      </summary>
                      <ul className="space-y-8 mt-4">
                        {queueScored.map((s) => (
                          <SubmissionCard key={s.submissionId} s={s} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : (
                <ul className="space-y-8">
                  {galleryList.map((s) => (
                    <SubmissionCard key={s.submissionId} s={s} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
