"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  CURSOR_CREDIT_TOP_N,
} from "@/lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAt: string;
  creditEligible: boolean;
};

type LeaderboardResponse = {
  eventId: string;
  totalCount: number;
  entries: LeaderboardEntry[];
  creditTopN: number;
  me: {
    signedUp: boolean;
    rank: number | null;
    mergedPrCount: number | null;
    signedUpAt: string | null;
    creditEligible: boolean;
  } | null;
};

export default function HackASprint2026SignupPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eventId = HACK_A_SPRINT_2026_EVENT_ID;
  const apiUrl = `/api/hackathons/events/${eventId}/signup`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      const res = await fetch(apiUrl, { headers });
      const json = (await res.json()) as LeaderboardResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Could not load leaderboard");
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [apiUrl, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignup = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Sign up failed");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!window.confirm("Remove yourself from the website signup list?")) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(apiUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not leave");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not leave");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/hackathons" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Hackathons
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/hackathons/hack-a-sprint-2026"
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Hack-a-Sprint 2026
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">Signup</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Hack-a-Sprint 2026 — website signup
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          This page is the on-site signup list for Hack-a-Sprint 2026. It does not replace{" "}
          <a
            href="https://luma.com/uixo8hl6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
          >
            Luma registration
          </a>
          —you still need Luma for event admission. After that, claim a spot below so we
          can rank builders by merged PRs to cursor-boston, then by signup time, for
          invitations and the top-{CURSOR_CREDIT_TOP_N} Cursor credit band.
        </p>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-foreground">How ranking works</h2>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong>Merged PRs</strong> to{" "}
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                cursor-boston
              </a>{" "}
              (higher first). Counts update as you merge more.
            </li>
            <li>
              <strong>Earlier website signups</strong> win ties (same PR count).
            </li>
            <li>
              The top {CURSOR_CREDIT_TOP_N} on this list are in the band eligible for{" "}
              <strong>$50 Cursor credit</strong> (subject to event selection and rules).
            </li>
          </ol>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:bg-amber-500/10">
          <h2 className="text-lg font-semibold text-foreground">After the event — Cursor credit</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Selected participants will claim <strong>$50 in Cursor credit</strong> after they{" "}
            <strong>merge their hackathon showcase PR</strong> to this repo. Official claim links
            and steps will be posted here when they are ready.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          {authLoading ? (
            <p className="text-sm text-neutral-500">Checking account…</p>
          ) : !user ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sign in to claim your spot on the list.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              {data?.me?.signedUp ? (
                <>
                  <div className="text-sm">
                    <span className="font-medium text-foreground">You are signed up.</span>{" "}
                    {data.me.rank != null && (
                      <>
                        Rank <strong>#{data.me.rank}</strong> of {data.totalCount} ·{" "}
                        <strong>{data.me.mergedPrCount ?? 0}</strong> merged PR
                        {(data.me.mergedPrCount ?? 0) !== 1 ? "s" : ""}
                        {data.me.creditEligible ? (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                            (top {CURSOR_CREDIT_TOP_N} — credit band)
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLeave()}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                  >
                    Leave list
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSignup()}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? "Working…" : "Claim my spot"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void load()}
                className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Refresh rankings
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold">Leaderboard</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {data ? `${data.totalCount} signed up on the site` : "Loading…"}
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900/80">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">GitHub</th>
                  <th className="px-4 py-3 font-medium">Merged PRs</th>
                  <th className="px-4 py-3 font-medium">Signed up</th>
                  <th className="px-4 py-3 font-medium">Credit band</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      Loading…
                    </td>
                  </tr>
                ) : data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      No one has signed up on the site yet. Be the first.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((row) => {
                    const isYou = user && row.userId === user.uid;
                    return (
                      <tr
                        key={row.userId}
                        className={`border-t border-neutral-200 dark:border-neutral-800 ${
                          row.creditEligible ? "bg-cyan-500/5 dark:bg-cyan-500/10" : ""
                        } ${isYou ? "ring-2 ring-inset ring-emerald-500/50" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono tabular-nums">{row.rank}</td>
                        <td className="px-4 py-3">
                          {row.displayName || "—"}
                          {isYou ? (
                            <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              (you)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.githubLogin ? (
                            <a
                              href={`https://github.com/${row.githubLogin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              @{row.githubLogin}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.mergedPrCount}</td>
                        <td className="px-4 py-3 text-neutral-500">
                          {new Date(row.signedUpAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {row.creditEligible ? (
                            <span className="text-cyan-700 dark:text-cyan-400">Top {data.creditTopN}</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-10 text-xs text-neutral-500">
          Luma approval and capacity rules still apply. This list helps organizers prioritize invites
          and credit; it does not replace Luma.
        </p>
      </div>
    </div>
  );
}
