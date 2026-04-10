/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import type { HackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

type SubmissionRow = {
  submissionId: string;
  githubLogin: string;
  title: string;
  aiScore: number | null;
  judgeScores: Record<string, number>;
  judgeAverage: number | null;
  peerVoteCount: number;
  rawScore: number | null;
};

type JudgeProgress = {
  uid: string;
  scored: number;
  total: number;
};

type DashboardData = {
  phase: HackASprint2026Phase;
  totalSubmissions: number;
  totalSignups: number;
  totalVoters: number;
  judgeUids: string[];
  judgeProgress: JudgeProgress[];
  submissions: SubmissionRow[];
};

const PHASE_LABEL: Record<HackASprint2026Phase, string> = {
  preUnlock: "Pre-unlock",
  passcodeUnlock: "Passcode unlock (5:00 PM)",
  submissionOpen: "Submissions open (6:30 PM)",
  peerVotingOpen: "Peer voting & judging (7:15 PM)",
  resultsOpen: "Results open (7:45 PM)",
};

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  useEffect(() => {
    if (!user || error) return;
    const t = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(t);
  }, [user, error, load]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
        <p className="text-neutral-500">Sign in to access admin dashboard.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
        <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <section className="py-8 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500 mb-1">
                <Link
                  href="/hackathons/hack-a-sprint-2026"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Hack-a-Sprint 2026
                </Link>
                {" / Admin"}
              </p>
              <h1 className="text-2xl font-bold text-foreground">
                Live Event Dashboard
              </h1>
            </div>
            <div className="text-right text-sm text-neutral-500">
              <p>Auto-refresh: 15s</p>
              {lastRefresh && <p>Last: {lastRefresh}</p>}
              <button
                onClick={() => void load()}
                className="mt-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Refresh now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="py-6 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Phase" value={PHASE_LABEL[data.phase]} />
          <StatCard
            label="Submissions"
            value={String(data.totalSubmissions)}
          />
          <StatCard label="Signups" value={String(data.totalSignups)} />
          <StatCard
            label="Voted"
            value={`${data.totalVoters} / ${data.totalSignups}`}
            highlight={data.totalVoters > 0}
          />
          <StatCard
            label="Judges"
            value={String(data.judgeUids.length)}
          />
        </div>
      </section>

      {/* Judge Progress */}
      {data.judgeProgress.length > 0 && (
        <section className="py-6 px-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg font-bold text-foreground mb-3">
              Judge Progress
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.judgeProgress.map((j) => (
                <div
                  key={j.uid}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900"
                >
                  <p className="text-xs text-neutral-500 font-mono truncate">
                    {j.uid}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: j.total > 0 ? `${(j.scored / j.total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {j.scored}/{j.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Submissions Table */}
      <section className="py-6 px-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-foreground mb-3">
            Submissions ({data.submissions.length})
          </h2>
          {data.submissions.length === 0 ? (
            <p className="text-neutral-500">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50">
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      #
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      Submitter
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      Title
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      AI
                    </th>
                    {data.judgeUids.map((uid) => (
                      <th
                        key={uid}
                        className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400"
                        title={uid}
                      >
                        J:{uid.slice(0, 4)}
                      </th>
                    ))}
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      Judge Avg
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      Peer
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">
                      Raw
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((s, i) => (
                    <tr
                      key={s.submissionId}
                      className={`border-b border-neutral-100 dark:border-neutral-800 ${
                        i < 6
                          ? "bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "bg-white dark:bg-neutral-900"
                      }`}
                    >
                      <td className="px-4 py-3 text-neutral-500 font-mono">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        @{s.githubLogin}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {s.title}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {s.aiScore ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      {data.judgeUids.map((uid) => (
                        <td
                          key={uid}
                          className="px-4 py-3 text-center font-mono"
                        >
                          {typeof s.judgeScores[uid] === "number" ? (
                            s.judgeScores[uid]
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-mono">
                        {s.judgeAverage != null ? (
                          s.judgeAverage.toFixed(1)
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {s.peerVoteCount}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">
                        {s.rawScore ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold ${
          highlight
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
