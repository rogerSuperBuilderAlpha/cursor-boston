/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import { mergeTiles as mergeTilesIntoCache } from "@/lib/game/local-map-cache";
import type { GamePlayer, MapTile, TurnReport } from "@/lib/game/types";

interface Args {
  user: User | null;
  setError: (msg: string | null) => void;
  setPlayer: (p: GamePlayer | null) => void;
  setTiles: (update: (prev: MapTile[]) => MapTile[]) => void;
}

/**
 * Spell action handlers (cast production / arm one / arm bulk) plus the
 * shared `callApi` plumbing. Owns `busyId` (which spell button is mid-
 * call) and `recentReports` (the field-report stack for the bottom of
 * the page).
 *
 * `callApi` merges any returned tile or player into local state + the
 * localStorage cache so the rest of the game pages see the change
 * without a refetch.
 */
export function useSpellActions({ user, setError, setPlayer, setTiles }: Args) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);

  const callApi = useCallback(
    async (path: string, body: unknown) => {
      if (!user) return null;
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Action failed";
          throw new Error(msg);
        }
        if (data.report) {
          setRecentReports((prev) =>
            [data.report as TurnReport, ...prev].slice(0, 25)
          );
        }
        if (Array.isArray(data.reports)) {
          setRecentReports((prev) =>
            [...(data.reports as TurnReport[]), ...prev].slice(0, 25)
          );
        }
        // Merge action response into local state + the localStorage cache.
        // Spell actions never change world tiles or owner summaries — only
        // the casting player's state and (for arm) the targeted tile(s).
        if (data.player) setPlayer(data.player as GamePlayer);
        const tileUpdates: MapTile[] = [];
        if (data.tile) tileUpdates.push(data.tile as MapTile);
        if (Array.isArray(data.tiles)) {
          tileUpdates.push(...(data.tiles as MapTile[]));
        }
        if (tileUpdates.length > 0) {
          setTiles((prev) => {
            const byId = new Map(prev.map((t) => [t.tileId, t] as const));
            for (const u of tileUpdates) byId.set(u.tileId, u);
            return Array.from(byId.values());
          });
          mergeTilesIntoCache(user.uid, tileUpdates);
        }
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      }
    },
    [user, setError, setPlayer, setTiles]
  );

  const castProduction = useCallback(
    async (spellId: string) => {
      setBusyId(spellId);
      try {
        await callApi("/api/game/spell/produce", { spellId });
      } finally {
        setBusyId(null);
      }
    },
    [callApi]
  );

  const armDefenseSingle = useCallback(
    async (spellId: string, tileId: string) => {
      if (!tileId) {
        setError("Pick a tile to arm the spell on first.");
        return;
      }
      setBusyId(spellId);
      try {
        await callApi("/api/game/spell/arm", { spellId, tileId });
      } finally {
        setBusyId(null);
      }
    },
    [callApi, setError]
  );

  const armDefenseBulk = useCallback(
    async (spellId: string, tileIds: string[]) => {
      if (tileIds.length === 0) return null;
      setBusyId(spellId);
      try {
        const data = await callApi("/api/game/spell/arm", { spellId, tileIds });
        if (data && Array.isArray(data.failed) && data.failed.length > 0) {
          // Surface partial failure prominently — the user just spent turns
          // and only some landed.
          const sample = data.failed
            .slice(0, 3)
            .map(
              (f: { tileId: string; reason: string }) =>
                `${f.tileId}: ${f.reason}`
            )
            .join("; ");
          setError(
            `Armed ${data.armed ?? 0} of ${tileIds.length}; ${data.failed.length} failed (${sample}${data.failed.length > 3 ? "…" : ""})`
          );
        }
        return data;
      } finally {
        setBusyId(null);
      }
    },
    [callApi, setError]
  );

  return {
    busyId,
    recentReports,
    castProduction,
    armDefenseSingle,
    armDefenseBulk,
  };
}

export type SpellActions = ReturnType<typeof useSpellActions>;
