/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import type { HackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

/* ─── Dashboard types ─── */

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

/* ─── Check-in types ─── */

type SignupEntry = {
  rank: number;
  userId: string | null;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAt: string;
  creditEligible: boolean;
  status: "confirmed" | "waitlisted";
  checkedIn: boolean;
  willBeLate?: boolean;
  queuingForSpot?: boolean;
};

type SignupData = {
  eventId: string;
  totalCount: number;
  websiteSignupCount: number;
  entries: SignupEntry[];
  creditTopN: number;
};

/* ─── Constants ─── */

const PHASE_LABEL: Record<HackASprint2026Phase, string> = {
  preEvent: "Pre-event",
  submissionOpen: "Build & submit (5:00 PM)",
  peerVotingOpen: "Peer voting & judging (7:15 PM)",
  resultsOpen: "Results open (7:45 PM)",
};

type Tab = "dashboard" | "checkin";

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("checkin");
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [checkinBusy, setCheckinBusy] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const getToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const loadDashboard = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(
        "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setDashData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load dashboard.");
    }
  }, [getToken]);

  const loadSignups = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `/api/hackathons/events/${HACK_A_SPRINT_2026_EVENT_ID}/signup`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SignupData;
      setSignupData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load signups.");
    }
  }, [getToken]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadDashboard(), loadSignups()]);
    setLastRefresh(new Date().toLocaleTimeString());
  }, [loadDashboard, loadSignups]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (!user || error) return;
    const t = window.setInterval(() => void loadAll(), 15_000);
    return () => window.clearInterval(t);
  }, [user, error, loadAll]);

  const toggleCheckin = useCallback(
    async (userId: string, currentlyCheckedIn: boolean) => {
      const token = await getToken();
      if (!token) return;
      setCheckinBusy((s) => new Set(s).add(userId));
      // Optimistic update
      setSignupData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          entries: prev.entries.map((e) =>
            e.userId === userId ? { ...e, checkedIn: !currentlyCheckedIn } : e,
          ),
        };
      });
      try {
        const res = await fetch(
          `/api/hackathons/events/${HACK_A_SPRINT_2026_EVENT_ID}/checkin`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, checkedIn: !currentlyCheckedIn }),
          },
        );
        if (!res.ok) {
          // Revert optimistic update
          setSignupData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              entries: prev.entries.map((e) =>
                e.userId === userId ? { ...e, checkedIn: currentlyCheckedIn } : e,
              ),
            };
          });
          const body = await res.json().catch(() => ({}));
          console.error("Check-in failed:", body);
        }
      } catch {
        // Revert on network error
        setSignupData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            entries: prev.entries.map((e) =>
              e.userId === userId ? { ...e, checkedIn: currentlyCheckedIn } : e,
            ),
          };
        });
      } finally {
        setCheckinBusy((s) => {
          const next = new Set(s);
          next.delete(userId);
          return next;
        });
      }
    },
    [getToken],
  );

  const filteredEntries = useMemo(() => {
    if (!signupData) return [];
    if (!searchQuery.trim()) return signupData.entries;
    const q = searchQuery.toLowerCase();
    return signupData.entries.filter(
      (e) =>
        (e.displayName?.toLowerCase().includes(q)) ||
        (e.githubLogin?.toLowerCase().includes(q)),
    );
  }, [signupData, searchQuery]);

  const checkedInCount = useMemo(
    () => signupData?.entries.filter((e) => e.checkedIn).length ?? 0,
    [signupData],
  );

  const checkinStats = useMemo(() => {
    if (!signupData) {
      return {
        confirmedTotal: 0,
        confirmedIn: 0,
        waitlistIn: 0,
        noShows: 0,
        arrivingLate: 0,
        queueing: 0,
      };
    }
    const confirmed = signupData.entries.filter((e) => e.status === "confirmed");
    const waitlisted = signupData.entries.filter((e) => e.status === "waitlisted");
    const confirmedIn = confirmed.filter((e) => e.checkedIn).length;
    const waitlistIn = waitlisted.filter((e) => e.checkedIn).length;
    const arrivingLate = signupData.entries.filter(
      (e) => e.status === "confirmed" && e.willBeLate === true,
    ).length;
    const queueing = signupData.entries.filter(
      (e) => e.status === "waitlisted" && e.queuingForSpot === true,
    ).length;
    return {
      confirmedTotal: confirmed.length,
      confirmedIn,
      waitlistIn,
      noShows: confirmed.length - confirmedIn,
      arrivingLate,
      queueing,
    };
  }, [signupData]);

  /* ─── Guards ─── */

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
          onClick={() => void loadAll()}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashData && !signupData) {
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
                onClick={() => void loadAll()}
                className="mt-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Refresh now
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
            {(["checkin", "dashboard"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                  tab === t
                    ? "bg-white dark:bg-neutral-900 text-foreground border border-b-0 border-neutral-200 dark:border-neutral-700 -mb-px"
                    : "text-neutral-500 hover:text-foreground"
                }`}
              >
                {t === "checkin" ? `Check-In (${checkedInCount})` : "Event Dashboard"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === "checkin" ? (
        <CheckInTab
          data={signupData}
          entries={filteredEntries}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          checkedInCount={checkedInCount}
          checkinStats={checkinStats}
          onToggle={toggleCheckin}
          busySet={checkinBusy}
        />
      ) : (
        <DashboardTab data={dashData} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Check-In Tab
   ═══════════════════════════════════════════════ */

function CheckInTab({
  data,
  entries,
  searchQuery,
  onSearchChange,
  checkedInCount,
  checkinStats,
  onToggle,
  busySet,
}: {
  data: SignupData | null;
  entries: SignupEntry[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  checkedInCount: number;
  checkinStats: {
    confirmedTotal: number;
    confirmedIn: number;
    waitlistIn: number;
    noShows: number;
    arrivingLate: number;
    queueing: number;
  };
  onToggle: (userId: string, current: boolean) => void;
  busySet: Set<string>;
}) {
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const confirmedEntries = entries.filter((e) => e.status === "confirmed");
  const waitlistedEntries = entries.filter((e) => e.status === "waitlisted" && e.userId != null);
  const lumaOnlyEntries = entries.filter((e) => e.userId == null);

  return (
    <>
      {/* Summary strip */}
      <section className="py-4 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <StatCard
            label="Checked In"
            value={`${checkedInCount} / ${data.creditTopN}`}
            highlight={checkedInCount > 0}
          />
          <StatCard
            label="Confirmed In"
            value={`${checkinStats.confirmedIn} / ${checkinStats.confirmedTotal}`}
          />
          <StatCard
            label="No-Shows"
            value={String(checkinStats.noShows)}
            highlight={checkinStats.noShows > 0}
            warn
          />
          <StatCard
            label="Waitlist Admitted"
            value={String(checkinStats.waitlistIn)}
            highlight={checkinStats.waitlistIn > 0}
          />
          <StatCard
            label="Arriving Late"
            value={String(checkinStats.arrivingLate)}
            highlight={checkinStats.arrivingLate > 0}
            warn
          />
          <StatCard
            label="Queueing"
            value={String(checkinStats.queueing)}
            highlight={checkinStats.queueing > 0}
          />
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or GitHub…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Participant table */}
      <section className="py-6 px-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-foreground mb-3">
            Participants
          </h2>
          {confirmedEntries.length === 0 && waitlistedEntries.length === 0 && lumaOnlyEntries.length === 0 ? (
            <p className="text-neutral-500">
              {searchQuery ? "No matches." : "No signups yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50">
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">GitHub</th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">PRs</th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">RSVP</th>
                    <th className="text-center px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-400">Check-In</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── Confirmed section ── */}
                  {confirmedEntries.length > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 uppercase tracking-wide"
                      >
                        Confirmed ({checkinStats.confirmedIn} / {checkinStats.confirmedTotal} checked in)
                      </td>
                    </tr>
                  )}
                  {confirmedEntries.map((e) => (
                    <CheckInRow
                      key={e.userId ?? `rank-${e.rank}`}
                      entry={e}
                      busy={e.userId ? busySet.has(e.userId) : false}
                      onToggle={onToggle}
                    />
                  ))}

                  {/* ── Waitlist section ── */}
                  {waitlistedEntries.length > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-500/10 uppercase tracking-wide"
                      >
                        Waitlist ({waitlistedEntries.length} people
                        {checkinStats.noShows > 0
                          ? ` — ${checkinStats.noShows} spot${checkinStats.noShows === 1 ? "" : "s"} available from no-shows`
                          : ""}
                        )
                      </td>
                    </tr>
                  )}
                  {waitlistedEntries.map((e) => (
                    <CheckInRow
                      key={e.userId ?? `rank-${e.rank}`}
                      entry={e}
                      busy={e.userId ? busySet.has(e.userId) : false}
                      onToggle={onToggle}
                    />
                  ))}

                  {/* ── Luma-only section ── */}
                  {lumaOnlyEntries.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-xs font-semibold text-neutral-400 bg-neutral-50 dark:bg-neutral-950/50 uppercase tracking-wide"
                        >
                          Luma-only ({lumaOnlyEntries.length}) — need cursorboston.com account + event signup to check in
                        </td>
                      </tr>
                      {lumaOnlyEntries.map((e) => (
                        <CheckInRow
                          key={`luma-${e.rank}`}
                          entry={e}
                          busy={false}
                          onToggle={onToggle}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function CheckInRow({
  entry: e,
  busy,
  onToggle,
}: {
  entry: SignupEntry;
  busy: boolean;
  onToggle: (userId: string, current: boolean) => void;
}) {
  const canCheckin = e.userId != null;
  return (
    <tr
      className={`border-b border-neutral-100 dark:border-neutral-800 transition-colors ${
        e.checkedIn
          ? "bg-emerald-500/10 dark:bg-emerald-500/15"
          : "bg-white dark:bg-neutral-900"
      }`}
    >
      <td className="px-4 py-3 text-neutral-500 font-mono">{e.rank}</td>
      <td className="px-4 py-3 font-medium text-foreground">
        {e.displayName || <span className="text-neutral-400 italic">—</span>}
      </td>
      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
        {e.githubLogin ? (
          <a
            href={`https://github.com/${e.githubLogin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            @{e.githubLogin}
          </a>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center font-mono">{e.mergedPrCount}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
            e.status === "confirmed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {e.status === "confirmed" ? "Confirmed" : "Waitlist"}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {e.willBeLate === true ? (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-amber-500/20 text-amber-800 dark:text-amber-300">
            LATE
          </span>
        ) : e.queuingForSpot === true ? (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-sky-500/20 text-sky-800 dark:text-sky-300">
            QUEUING
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {canCheckin ? (
          <button
            disabled={busy}
            onClick={() => onToggle(e.userId!, e.checkedIn)}
            role="switch"
            aria-checked={e.checkedIn}
            aria-label={e.checkedIn ? "Undo check-in" : "Check in"}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              e.checkedIn
                ? "bg-emerald-500"
                : "bg-neutral-300 dark:bg-neutral-600"
            } ${busy ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
            title={e.checkedIn ? "Undo check-in" : "Check in"}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                e.checkedIn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        ) : (
          <span className="text-neutral-400 text-xs">N/A</span>
        )}
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════
   Dashboard Tab (existing content)
   ═══════════════════════════════════════════════ */

function DashboardTab({ data }: { data: DashboardData | null }) {
  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <section className="py-6 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Phase" value={PHASE_LABEL[data.phase]} />
          <StatCard label="Submissions" value={String(data.totalSubmissions)} />
          <StatCard label="Signups" value={String(data.totalSignups)} />
          <StatCard
            label="Voted"
            value={`${data.totalVoters} / ${data.totalSignups}`}
            highlight={data.totalVoters > 0}
          />
          <StatCard label="Judges" value={String(data.judgeUids.length)} />
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
                          width:
                            j.total > 0
                              ? `${(j.scored / j.total) * 100}%`
                              : "0%",
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
    </>
  );
}

/* ─── Shared ─── */

function StatCard({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold ${
          highlight && warn
            ? "text-amber-600 dark:text-amber-400"
            : highlight
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
