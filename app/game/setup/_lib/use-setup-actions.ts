/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import type { BatchProgress, RevealLog } from "./types";

interface Args {
  user: User | null;
  setError: (msg: string | null) => void;
  refresh: () => Promise<void>;
}

/**
 * Setup-page action handlers. `callApi` is the generic single-action
 * wrapper (distribute / caste pick); `runExploreBatch` is the bespoke
 * loop for the explore phase that runs N reveals in series and
 * accumulates field reports for the bottom-of-page log.
 *
 * Both share the `busy` flag so the UI can disable both kinds of
 * buttons while either is running.
 */
export function useSetupActions({ user, setError, refresh }: Args) {
  const [busy, setBusy] = useState(false);
  const [recentReveals, setRecentReveals] = useState<RevealLog[]>([]);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  const callApi = useCallback(
    async (path: string, body?: unknown) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message ?? data.error ?? "Action failed");
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [user, refresh, setError]
  );

  const runExploreBatch = useCallback(
    async (count: number) => {
      if (!user) return;
      const total = Math.max(1, Math.min(100, Math.floor(count)));
      setBusy(true);
      setError(null);
      setBatchProgress({ done: 0, total });
      const collected: RevealLog[] = [];
      try {
        const token = await user.getIdToken();
        for (let i = 0; i < total; i++) {
          const res = await fetch("/api/game/setup/explore", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (!data.success) {
            const msg =
              data.error?.message ?? data.error ?? "Exploration failed";
            // out of turns or auto-advanced — stop cleanly
            setError(`Stopped at ${i} / ${total}: ${msg}`);
            break;
          }
          if (data.tile) {
            collected.push({
              tileId: data.tile.tileId,
              type: data.tile.type,
              at: Date.now(),
              summary: data.report?.summary,
              narrative: data.report?.narrative,
              artifactFound: data.report?.artifactFound,
            });
          }
          setBatchProgress({ done: i + 1, total });
        }
        setRecentReveals((prev) =>
          [...collected.reverse(), ...prev].slice(0, 50)
        );
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
        setBatchProgress(null);
      }
    },
    [user, refresh, setError]
  );

  return {
    busy,
    recentReveals,
    batchProgress,
    callApi,
    runExploreBatch,
  };
}

export type SetupActions = ReturnType<typeof useSetupActions>;
