/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type Report = {
  reportId: string;
  reporterUid: string;
  reporterDisplayName: string | null;
  targetMessageId: string;
  targetAuthorId: string | null;
  reason: string;
  notes: string;
  status: string;
  action: string | null;
  actionedBy: string | null;
  createdAt: string | null;
  actionedAt: string | null;
};

type Action = "dismiss" | "hide" | "suspend";

/**
 * Admin moderation queue. Lists open reports, supports per-row actions
 * (dismiss / hide message / suspend user). Auth gate is client-side
 * (useAuth().userProfile.isAdmin); the underlying API endpoints
 * also enforce isAdmin, so a non-admin who navigates here directly
 * still cannot fetch or mutate data.
 */
export default function ModerationPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Mirrors the pattern in app/hackathons/sports-hack-2026/page.tsx:64 —
  // `isAdmin` is set server-side on the user profile via custom claims
  // but is not present in the public UserProfile TS shape.
  const isAdmin = Boolean((userProfile as { isAdmin?: boolean } | null)?.isAdmin);

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      if (!user) return null;
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set("status", "open");
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/community/moderate?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as {
        reports: Report[];
        nextCursor: string | null;
        hasMore: boolean;
      };
    },
    [user]
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    try {
      const data = await fetchPage(null);
      if (!data) return;
      setReports(data.reports);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  }, [user, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(nextCursor);
      if (!data) return;
      setReports((prev) => [...prev, ...data.reports]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, fetchPage]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      router.push("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    void refresh();
  }, [loading, user, isAdmin, refresh, router]);

  const act = async (reportId: string, action: Action) => {
    if (!user) return;
    setPendingAction(`${reportId}:${action}`);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/community/moderate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Drop this report from the visible queue immediately rather than refetching.
      setReports((prev) => prev.filter((r) => r.reportId !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) return <p className="text-zinc-400">Loading…</p>;
  if (!user || !isAdmin) return null; // useEffect redirects

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderation queue</h1>
          <p className="text-sm text-zinc-400">
            {reports.length} open report{reports.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={fetching}
          className="px-3 py-1.5 bg-zinc-800 text-white rounded text-sm hover:bg-zinc-700 disabled:opacity-50"
        >
          {fetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-700/50 bg-red-950/40 p-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      {!fetching && reports.length === 0 && (
        <p className="text-zinc-400 text-sm">No open reports. ✓</p>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <article
            key={r.reportId}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <header className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <span className="font-medium text-white">{r.reason}</span>
                <span className="text-zinc-500 ml-2">
                  reported by {r.reporterDisplayName ?? r.reporterUid.slice(0, 8)}
                </span>
              </div>
              <time className="text-xs text-zinc-500">
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
              </time>
            </header>
            <div className="text-sm text-zinc-300 mb-3">
              <p>
                <span className="text-zinc-500">Message ID:</span>{" "}
                <code className="text-zinc-200">{r.targetMessageId}</code>
              </p>
              <p>
                <span className="text-zinc-500">Author:</span>{" "}
                <code className="text-zinc-200">{r.targetAuthorId ?? "?"}</code>
              </p>
              {r.notes && (
                <p className="mt-2 italic text-zinc-300">&ldquo;{r.notes}&rdquo;</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void act(r.reportId, "dismiss")}
                disabled={pendingAction !== null}
                className="px-3 py-1.5 bg-zinc-800 text-white rounded text-xs hover:bg-zinc-700 disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => void act(r.reportId, "hide")}
                disabled={pendingAction !== null}
                className="px-3 py-1.5 bg-amber-900/60 text-amber-100 border border-amber-700/50 rounded text-xs hover:bg-amber-900/80 disabled:opacity-50"
              >
                Hide message
              </button>
              <button
                type="button"
                onClick={() => void act(r.reportId, "suspend")}
                disabled={pendingAction !== null || !r.targetAuthorId}
                className="px-3 py-1.5 bg-red-900/60 text-red-100 border border-red-700/50 rounded text-xs hover:bg-red-900/80 disabled:opacity-50"
              >
                Suspend user
              </button>
            </div>
          </article>
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="px-4 py-2 bg-zinc-800 text-white rounded text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
