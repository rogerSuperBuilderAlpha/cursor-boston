/**
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
  error?: string;
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/leaderboard?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as LeaderboardResponse;
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setRows(data.players ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

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
            Top 50 generals ranked by tiles held. Conquering a tile bumps your
            number and drops your opponent&apos;s by the same amount. Your row
            is highlighted.
          </p>
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
                    {r.userId === user.uid
                      ? `${r.displayName || "You"} (you)`
                      : r.displayName || "—"}
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
      </div>
    </div>
  );
}
