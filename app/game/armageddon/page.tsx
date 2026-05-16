/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ArmageddonEventRecord, SealRecord } from "@/lib/game/types";
import { SEAL_COUNT } from "@/lib/game/content/armageddon";

interface HistoryResponse {
  success: boolean;
  history?: ArmageddonEventRecord[];
  error?: string;
}

function formatAbsolute(value: SealRecord["brokenAt"]): string {
  if (!value) return "—";
  const d =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: () => Date }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : new Date(0);
  return d.toLocaleString();
}

/**
 * Hall of fame for past Armageddons. Lists every resolved season with its
 * 10 weighted-draw winners, the 7-seal audit trail, and a top-50-by-tiles
 * snapshot. The on-disk record persists across the world wipe — this page
 * is the only place glory survives a season reset.
 */
export default function ArmageddonHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<ArmageddonEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/armageddon", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as HistoryResponse;
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setHistory(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    void fetchHistory();
  }, [authLoading, fetchHistory]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-6">
        <p className="text-sm text-neutral-500">Loading hall of fame…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen py-12 px-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Sign in to view the hall of fame.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Hall of Fame — Past Armageddons</h1>
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

        {history.length === 0 ? (
          <div className="rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-6 text-sm text-neutral-700 dark:text-neutral-300">
            <p className="mb-2">
              No Armageddons have resolved yet. We are in the first age.
            </p>
            <p className="text-neutral-500 dark:text-neutral-400">
              When the seventh Seal breaks, a weighted lottery decides
              who carries glory into the next age — and their names are
              recorded here forever.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {history.map((ev) => (
              <ArmageddonCard key={ev.seasonNumber} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArmageddonCard({ ev }: { ev: ArmageddonEventRecord }) {
  return (
    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-700 dark:text-red-300 opacity-90">
            Season {ev.seasonNumber} — Armageddon
          </div>
          <h2 className="text-xl font-bold text-red-900 dark:text-red-100">
            {formatAbsolute(ev.triggeredAt)}
          </h2>
        </div>
        <div className="text-sm text-red-800 dark:text-red-200">
          The seventh Seal broken by{" "}
          <strong>{ev.triggeredBy.displayName}</strong>{" "}
          <span className="opacity-70">({ev.triggeredBy.caste})</span>
        </div>
      </div>

      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
        {ev.totalParticipants.toLocaleString()} participants ·{" "}
        {ev.totalTickets.toLocaleString()} total tickets
      </p>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs uppercase text-neutral-500 mb-2">
            The Seven Seals
          </div>
          <ol className="space-y-1 text-sm">
            {Array.from({ length: SEAL_COUNT }, (_, i) => {
              const s = ev.seals?.[i];
              return (
                <li key={i} className="font-mono text-xs">
                  <span className="text-red-700 dark:text-red-300">
                    ✦ Seal #{i + 1}
                  </span>{" "}
                  →{" "}
                  {s?.broken && s.brokenBy ? (
                    <>
                      <strong>{s.brokenBy.displayName}</strong>{" "}
                      <span className="opacity-70">({s.brokenBy.caste})</span>{" "}
                      <span className="opacity-60">
                        {formatAbsolute(s.brokenAt)}
                      </span>
                    </>
                  ) : (
                    <span className="opacity-50">unbroken (anomaly)</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs uppercase text-neutral-500 mb-2">
            Lottery winners
          </div>
          {ev.winners.length === 0 ? (
            <p className="text-sm opacity-60">No participants drew tickets.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {ev.winners.map((w) => (
                <li key={w.userId} className="flex justify-between gap-3">
                  <span className="truncate">
                    <span className="font-mono text-xs opacity-60 mr-2">
                      #{w.rank}
                    </span>
                    <strong>{w.displayName}</strong>{" "}
                    <span className="text-xs opacity-70">({w.caste})</span>
                  </span>
                  <span className="font-mono text-xs whitespace-nowrap opacity-70">
                    {w.tickets.toLocaleString()} tix
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {ev.topByTilesSnapshot.length > 0 && (
        <details className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <summary className="text-xs uppercase text-neutral-500 cursor-pointer">
            Top kingdoms by tiles ({ev.topByTilesSnapshot.length})
          </summary>
          <ol className="mt-2 space-y-1 text-sm">
            {ev.topByTilesSnapshot.map((p) => (
              <li key={p.userId} className="flex justify-between gap-3">
                <span className="truncate">
                  <span className="font-mono text-xs opacity-60 mr-2">
                    #{p.rank}
                  </span>
                  <strong>{p.displayName}</strong>{" "}
                  <span className="text-xs opacity-70">({p.caste})</span>
                </span>
                <span className="font-mono text-xs whitespace-nowrap opacity-70">
                  {p.tilesHeld.toLocaleString()} tiles · {p.sealsBroken} seals
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
