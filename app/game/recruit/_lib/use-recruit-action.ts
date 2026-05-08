/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useState } from "react";
import type { User } from "firebase/auth";
import { mergeTiles as mergeTilesIntoCache } from "@/lib/game/local-map-cache";
import type {
  GamePlayer,
  MapTile,
  TurnReport,
  UnitType,
} from "@/lib/game/types";
import { UNITS_PER_CYCLE } from "./constants";
import { buildThreatPriorityPlan } from "./threat-priority-plan";
import type { RecruitProgress } from "./types";

interface Args {
  user: User | null;
  setError: (msg: string | null) => void;
  setPlayer: (p: GamePlayer | null) => void;
  setTiles: (update: (prev: MapTile[]) => MapTile[]) => void;
}

interface RecruitArgs {
  unitType: UnitType;
  totalCycles: number;
  selectedTileId: string;
  threatRankedMilitaryIds: string[];
}

/**
 * Owns the recruit action: builds a per-tile plan (auto-route by threat
 * unless `selectedTileId` is set), POSTs `/api/game/build/bulk`, then
 * merges the response into the page's local state + the localStorage
 * map cache. Surfaces partial-failure state via `progress` and `error`.
 */
export function useRecruitAction({
  user,
  setError,
  setPlayer,
  setTiles,
}: Args) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RecruitProgress | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);

  const handleRecruit = useCallback(
    async ({
      unitType,
      totalCycles,
      selectedTileId,
      threatRankedMilitaryIds,
    }: RecruitArgs) => {
      if (!user) return;
      if (totalCycles === 0) {
        setError("Not enough turns or capacity to recruit any units.");
        return;
      }
      setBusy(true);
      setError(null);
      setProgress({
        done: 0,
        total: totalCycles,
        unitsBuilt: 0,
        artifactsFound: 0,
      });
      try {
        const token = await user.getIdToken();
        const planEntries = selectedTileId
          ? [{ tileId: selectedTileId, cycles: totalCycles }]
          : buildThreatPriorityPlan(threatRankedMilitaryIds, totalCycles);
        const plan = planEntries.map(({ tileId, cycles }) => ({
          tileId,
          unitType,
          cycles,
        }));
        const res = await fetch("/api/game/build/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Recruit failed";
          throw new Error(msg);
        }
        const reports: TurnReport[] = Array.isArray(data.reports)
          ? data.reports
          : [];
        let artifactsFound = 0;
        for (const r of reports) if (r.artifactFound) artifactsFound++;
        const unitsBuilt =
          typeof data.produced === "number"
            ? data.produced
            : reports.length * UNITS_PER_CYCLE;
        if (reports.length > 0) {
          setRecentReports((prev) =>
            [...reports.slice().reverse(), ...prev].slice(0, 25)
          );
        }
        setProgress({
          done: reports.length,
          total: totalCycles,
          unitsBuilt,
          artifactsFound,
        });
        if (data.stoppedEarly) {
          setError(
            `Stopped early after ${reports.length} / ${totalCycles}: ${data.stoppedEarly}`
          );
        }
        // Merge the action response into local state + the localStorage map
        // cache. Recruit only mutates the player's own military tiles + player
        // stats; world tiles + owners never move.
        if (data.player) setPlayer(data.player as GamePlayer);
        if (Array.isArray(data.tiles)) {
          const updates = data.tiles as MapTile[];
          setTiles((prev) => {
            const byId = new Map(prev.map((t) => [t.tileId, t] as const));
            for (const u of updates) byId.set(u.tileId, u);
            return Array.from(byId.values());
          });
          mergeTilesIntoCache(user.uid, updates);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Recruit failed");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [user, setError, setPlayer, setTiles]
  );

  return { busy, progress, recentReports, handleRecruit };
}

export type RecruitAction = ReturnType<typeof useRecruitAction>;
