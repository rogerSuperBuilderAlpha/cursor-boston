/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Caste, Phase } from "@/lib/game/types";

interface LeaderRow {
  userId: string;
  displayName: string;
  caste: Caste | null;
  phase: Phase;
  tilesHeld: number;
  unitsAlive: number;
  attacksWon: number;
  attacksLost: number;
}

interface LeaderboardResponse {
  success: boolean;
  players?: LeaderRow[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
}

const PAGE_LIMIT = 20;

type Audience = "all" | "real" | "npc";

const AUDIENCE_TABS: { value: Audience; label: string }[] = [
  { value: "all", label: "All" },
  { value: "real", label: "Real Players" },
  { value: "npc", label: "NPCs" },
];

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("all");

  const fetchPage = useCallback(
    async (
      cursor: string | null,
      aud: Audience
    ): Promise<LeaderboardResponse | null> => {
      if (!user) return null;
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);
      if (aud !== "all") params.set("audience", aud);
      const res = await fetch(`/api/game/leaderboard?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as LeaderboardResponse;
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      return data;
    },
    [user]
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await fetchPage(null, audience);
      if (!data) return;
      setRows(data.players ?? []);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, fetchPage, audience]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(nextCursor, audience);
      if (!data) return;
      setRows((prev) => [...prev, ...(data.players ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage, audience]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh();
  }, [authLoading, refresh]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/login" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Generals ranked by tiles held. Conquering a tile bumps your number
            and drops your opponent&apos;s by the same amount. Your row is
            highlighted.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter leaderboard by player type"
          className="inline-flex mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 bg-neutral-50 dark:bg-neutral-900/40"
        >
          {AUDIENCE_TABS.map((tab) => {
            const active = audience === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (audience === tab.value) return;
                  setAudience(tab.value);
                  setNextCursor(null);
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active
                    ? "bg-white dark:bg-neutral-800 shadow-sm font-medium"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">No generals yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">General</th>
                <th className="py-2 pr-2">Caste</th>
                <th className="py-2 pr-2 text-right">Tiles</th>
                <th className="py-2 pr-2 text-right">Units</th>
                <th className="py-2 pr-2 text-right">W / L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.userId}
                  className={`border-b border-neutral-100 dark:border-neutral-900 ${
                    r.userId === user.uid
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-2 font-mono text-neutral-500">
                    {i + 1}
                  </td>
                  <td className="py-2 pr-2 text-sm">
                    <Link
                      href={`/game/players/${r.userId}`}
                      className="hover:underline"
                    >
                      {r.userId === user.uid
                        ? `${r.displayName || "You"} (you)`
                        : r.displayName || "—"}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 capitalize">{r.caste ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{r.tilesHeld}</td>
                  <td className="py-2 pr-2 text-right">{r.unitsAlive}</td>
                  <td className="py-2 pr-2 text-right">
                    {r.attacksWon} / {r.attacksLost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {nextCursor && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
