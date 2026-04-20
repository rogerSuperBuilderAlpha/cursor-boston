/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_SHORT_NAME,
} from "@/lib/sports-hack-2026";

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
  lumaRegistered?: boolean;
};

type SignupData = {
  eventId: string;
  totalCount: number;
  websiteSignupCount: number;
  entries: SignupEntry[];
  creditTopN: number;
};

export default function SportsHack2026AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [checkinBusy, setCheckinBusy] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const getToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const loadSignups = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SignupData;
      setSignupData(json);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load signups.");
    }
  }, [getToken]);

  useEffect(() => {
    // Initial signup list load after auth resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    if (user) void loadSignups();
  }, [user, loadSignups]);

  useEffect(() => {
    if (!user || error) return;
    // 60s is a compromise between day-of responsiveness and Firestore reads:
    // the signup API has its own 30s server cache so organizers see fresh
    // data within ~30–60s of any change, and a tab left open generates
    // 60 calls/hour instead of 240.
    const t = window.setInterval(() => void loadSignups(), 60_000);
    return () => window.clearInterval(t);
  }, [user, error, loadSignups]);

  const toggleCheckin = useCallback(
    async (userId: string, currentlyCheckedIn: boolean) => {
      const token = await getToken();
      if (!token) return;
      setCheckinBusy((s) => new Set(s).add(userId));
      setSignupData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          entries: prev.entries.map((e) =>
            e.userId === userId ? { ...e, checkedIn: !currentlyCheckedIn } : e
          ),
        };
      });
      try {
        const res = await fetch(
          `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/checkin`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, checkedIn: !currentlyCheckedIn }),
          }
        );
        if (!res.ok) {
          setSignupData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              entries: prev.entries.map((e) =>
                e.userId === userId ? { ...e, checkedIn: currentlyCheckedIn } : e
              ),
            };
          });
          const body = await res.json().catch(() => ({}));
          console.error("Check-in failed:", body);
        }
      } catch {
        setSignupData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            entries: prev.entries.map((e) =>
              e.userId === userId ? { ...e, checkedIn: currentlyCheckedIn } : e
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
    [getToken]
  );

  const filteredEntries = useMemo(() => {
    if (!signupData) return [];
    if (!searchQuery.trim()) return signupData.entries;
    const q = searchQuery.toLowerCase();
    return signupData.entries.filter(
      (e) =>
        e.displayName?.toLowerCase().includes(q) ||
        e.githubLogin?.toLowerCase().includes(q)
    );
  }, [signupData, searchQuery]);

  const checkedInCount = useMemo(
    () => signupData?.entries.filter((e) => e.checkedIn).length ?? 0,
    [signupData]
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
        notOnLuma: 0,
      };
    }
    const confirmed = signupData.entries.filter((e) => e.status === "confirmed");
    const waitlisted = signupData.entries.filter((e) => e.status === "waitlisted");
    const confirmedIn = confirmed.filter((e) => e.checkedIn).length;
    const waitlistIn = waitlisted.filter((e) => e.checkedIn).length;
    const arrivingLate = signupData.entries.filter(
      (e) => e.status === "confirmed" && e.willBeLate === true
    ).length;
    const queueing = signupData.entries.filter(
      (e) => e.status === "waitlisted" && e.queuingForSpot === true
    ).length;
    // Website signups without a matching row in the latest Luma export.
    const notOnLuma = signupData.entries.filter(
      (e) => e.userId != null && !e.lumaRegistered
    ).length;
    return {
      confirmedTotal: confirmed.length,
      confirmedIn,
      waitlistIn,
      noShows: confirmed.length - confirmedIn,
      arrivingLate,
      queueing,
      notOnLuma,
    };
  }, [signupData]);

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
        <p className="text-neutral-500">Sign in to access admin check-in.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6">
        <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        <button
          onClick={() => void loadSignups()}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!signupData) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const confirmedEntries = filteredEntries.filter((e) => e.status === "confirmed");
  const waitlistedEntries = filteredEntries.filter(
    (e) => e.status === "waitlisted" && e.userId != null
  );
  const lumaOnlyEntries = filteredEntries.filter((e) => e.userId == null);

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-8 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500 mb-1">
                <Link
                  href={`/hackathons/${SPORTS_HACK_2026_EVENT_ID}`}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {SPORTS_HACK_2026_SHORT_NAME}
                </Link>
                {" / Admin"}
              </p>
              <h1 className="text-2xl font-bold text-foreground">Door Check-In</h1>
            </div>
            <div className="text-right text-sm text-neutral-500">
              <p>Auto-refresh: 15s</p>
              {lastRefresh && <p>Last: {lastRefresh}</p>}
              <button
                onClick={() => void loadSignups()}
                className="mt-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                Refresh now
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-4 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <StatCard
            label="Checked In"
            value={`${checkedInCount} / ${SPORTS_HACK_2026_CAPACITY}`}
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
          <StatCard
            label="Not on Luma"
            value={String(checkinStats.notOnLuma)}
            highlight={checkinStats.notOnLuma > 0}
            warn
          />
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or GitHub…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </section>

      <section className="py-6 px-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-foreground mb-3">Participants</h2>
          {confirmedEntries.length === 0 &&
          waitlistedEntries.length === 0 &&
          lumaOnlyEntries.length === 0 ? (
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
                      busy={e.userId ? checkinBusy.has(e.userId) : false}
                      onToggle={toggleCheckin}
                    />
                  ))}

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
                      busy={e.userId ? checkinBusy.has(e.userId) : false}
                      onToggle={toggleCheckin}
                    />
                  ))}

                  {lumaOnlyEntries.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-xs font-semibold text-neutral-400 bg-neutral-50 dark:bg-neutral-950/50 uppercase tracking-wide"
                        >
                          Luma-only ({lumaOnlyEntries.length}) — need cursorboston.com
                          account + event signup to check in
                        </td>
                      </tr>
                      {lumaOnlyEntries.map((e) => (
                        <CheckInRow
                          key={`luma-${e.rank}`}
                          entry={e}
                          busy={false}
                          onToggle={toggleCheckin}
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
    </div>
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
        <div className="flex flex-col gap-1 items-center">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
              e.status === "confirmed"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {e.status === "confirmed" ? "Confirmed" : "Waitlist"}
          </span>
          {e.userId != null ? (
            // Luma-only rows (userId == null) already live in a separate section —
            // no need to label them. Website signups get a second pill to flag
            // whether they've also registered on Luma.
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                e.lumaRegistered
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
              }`}
              title={
                e.lumaRegistered
                  ? "Matched to a registration in the latest Luma export"
                  : "No matching Luma registration found (by email or GitHub login)"
              }
            >
              {e.lumaRegistered ? "✓ Luma" : "⚠ No Luma"}
            </span>
          ) : null}
        </div>
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
