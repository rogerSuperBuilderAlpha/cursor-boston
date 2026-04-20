/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { LumaEmbed } from "@/components/hackathons/LumaEmbed";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_LOCATION,
  SPORTS_HACK_2026_LUMA_EMBED_ID,
  SPORTS_HACK_2026_LUMA_URL,
  SPORTS_HACK_2026_NAME,
} from "@/lib/sports-hack-2026";

type LeaderboardEntry = {
  rank: number;
  status?: "confirmed" | "waitlisted";
  creditEligible: boolean;
};

type LeaderboardResponse = {
  totalCount: number;
  websiteSignupCount?: number;
  entries: LeaderboardEntry[];
  creditTopN: number;
  me?: { signedUp: boolean; rank: number | null } | null;
};

export default function SportsHack2026LandingPage() {
  const { user, userProfile } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
      const res = await fetch(
        `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`,
        { headers }
      );
      if (!res.ok) return;
      setData((await res.json()) as LeaderboardResponse);
    } catch {
      // Non-critical — landing page still renders
    }
  }, [user]);

  useEffect(() => {
    // Initial leaderboard fetch for capacity counter; non-blocking.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    void load();
  }, [load]);

  const confirmedCount = data
    ? data.entries.filter((e) => (e.status ?? (e.creditEligible ? "confirmed" : "waitlisted")) === "confirmed").length
    : null;
  const isAdmin = Boolean((userProfile as { isAdmin?: boolean } | null)?.isAdmin);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link
            href="/hackathons"
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Hackathons
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">
            {SPORTS_HACK_2026_NAME}
          </span>
        </nav>

        <div className="grid gap-10 md:grid-cols-[1fr_minmax(320px,420px)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Boston Tech Week · May 26, 2026
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">
              {SPORTS_HACK_2026_NAME}
            </h1>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              A morning sports hackathon from Cursor Boston — networking, a guest
              lecture from LSE, a two-hour build sprint, AI-powered scoring, and live
              pitches. Tuesday May 26, 10:00 AM – 4:00 PM ET, {SPORTS_HACK_2026_LOCATION}.
            </p>

            <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FactCard label="When" value="Tue May 26 · 10 AM – 4 PM ET" />
              <FactCard label="Where" value={SPORTS_HACK_2026_LOCATION} />
              <FactCard
                label="Capacity"
                value={
                  confirmedCount != null && data
                    ? `${confirmedCount}/${SPORTS_HACK_2026_CAPACITY} confirmed · ${data.totalCount} registered`
                    : `${SPORTS_HACK_2026_CAPACITY} confirmed seats`
                }
              />
              <FactCard
                label="Prizes"
                value="$1,200 cash + Cursor credits + Red Bull merch"
              />
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href={`/hackathons/${SPORTS_HACK_2026_EVENT_ID}/signup`}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                {data?.me?.signedUp
                  ? `You're signed up${data.me.rank != null ? ` — rank #${data.me.rank}` : ""} · Manage`
                  : "Register on the website"}
              </Link>
              <a
                href={SPORTS_HACK_2026_LUMA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-3 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                RSVP on Luma →
              </a>
              {isAdmin ? (
                <Link
                  href={`/hackathons/${SPORTS_HACK_2026_EVENT_ID}/admin`}
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                >
                  Admin check-in →
                </Link>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 font-medium">
              You must register on <strong>both</strong>: Luma (for door entry) <strong>and</strong> the website (for hackathon ranking &amp; prizes). One without the other won&apos;t get you in.
            </p>

            <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-lg font-semibold">How selection works</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Luma approves your registration. Cursor Boston then ranks registrants by
                merged PRs to the{" "}
                <a
                  href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 underline dark:text-emerald-400"
                >
                  cursor-boston
                </a>{" "}
                community repo, with signup time as the tiebreaker. Top{" "}
                {SPORTS_HACK_2026_CAPACITY} get a confirmed seat; the rest join the
                waitlist. Merge a PR to move up.
              </p>
            </div>
          </div>

          <aside className="md:sticky md:top-24 md:self-start">
            <LumaEmbed
              embedId={SPORTS_HACK_2026_LUMA_EMBED_ID}
              title={`${SPORTS_HACK_2026_NAME} — Luma registration`}
              aspect="square"
            />
            <p className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Powered by{" "}
              <a
                href={SPORTS_HACK_2026_LUMA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Luma
              </a>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
