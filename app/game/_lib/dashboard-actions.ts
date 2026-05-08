/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { User } from "firebase/auth";
import type {
  GamePlayer,
  LandType,
  MapTile,
  TurnReport,
} from "@/lib/game/types";
import type { ActionProgress } from "./dashboard-types";

/**
 * Mutators the action handlers reach back into. Bundled into one bag so
 * `useDashboardData()` can hand them to action factories without each
 * one needing 6+ closure params.
 */
export interface DashboardMutators {
  setError: (msg: string | null) => void;
  setPlayer: (p: GamePlayer | null) => void;
  setRecentReports: (
    update: (prev: TurnReport[]) => TurnReport[]
  ) => void;
  mergeOwnedTiles: (updates: MapTile[]) => void;
  /** Update enemy/border tiles in the dashboard's worldTiles state and the
   *  localStorage map cache. Used by Far Expedition and Attack to surface
   *  newly-adjacent enemy tiles in the threat box without a page reload. */
  mergeBorderTiles: (updates: MapTile[]) => void;
}

/** Common error-message extraction for `data.error` (string | object). */
function asErrorMessage(data: { error?: unknown }, fallback: string): string {
  if (typeof data.error === "string") return data.error;
  const e = data.error as { message?: string } | undefined;
  return e?.message ?? fallback;
}


/**
 * POST /api/game/player — spawn the user's first general. Refetches on
 * success because we want the caller to re-mount with `player !== null`.
 */
export async function createPlayer(
  user: User,
  displayName: string,
  mut: { setError: DashboardMutators["setError"] },
  refetch: () => Promise<void>
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Failed to create player"));
    }
    await refetch();
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Failed to create player");
  }
}

/**
 * PATCH /api/game/player — rename the general. Patches local state from
 * the response instead of refetching since nothing else changes.
 */
export async function setPlayerName(
  user: User,
  displayName: string,
  mut: Pick<DashboardMutators, "setError" | "setPlayer">
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/player", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Failed to save name"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Failed to save name");
  }
}

/**
 * POST /api/game/explore/bulk — claim N adjacent unrevealed tiles in
 * one transaction. Caps at 50 per call (server enforces too).
 */
export async function frontierExplore(
  user: User,
  count: number,
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void
): Promise<void> {
  const total = Math.max(1, Math.min(50, Math.floor(count)));
  mut.setError(null);
  setProgress({ done: 0, total, artifactsFound: 0 });
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/explore/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ count: total }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Explore failed"));
    }
    consumeReports(data, mut, setProgress, total, "Claimed");
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (Array.isArray(data.tiles))
      mut.mergeOwnedTiles(data.tiles as MapTile[]);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Explore failed");
  } finally {
    setProgress(null);
  }
}

/**
 * POST /api/game/distribute/bulk — re-assign the type of N tiles
 * matched by `sourceFilter` to `targetType`. Used for both
 * "assign unassigned → military/food/magic" and
 * "revert military → unassigned" via the same endpoint.
 */
export async function bulkDistribute(
  user: User,
  args: {
    targetType: LandType;
    count: number;
    sourceFilter: (t: MapTile) => boolean;
    sourceLabel: string;
    tiles: MapTile[];
  },
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void
): Promise<void> {
  const sources = args.tiles.filter(args.sourceFilter).map((t) => t.tileId);
  const total = Math.min(sources.length, Math.max(1, Math.floor(args.count)));
  if (total === 0) {
    mut.setError(`No ${args.sourceLabel} tiles to distribute.`);
    return;
  }
  mut.setError(null);
  setProgress({ done: 0, total, artifactsFound: 0 });
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/distribute/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tileIds: sources.slice(0, total),
        type: args.targetType,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Distribute failed"));
    }
    consumeReports(data, mut, setProgress, total, "Stopped early after");
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (Array.isArray(data.tiles))
      mut.mergeOwnedTiles(data.tiles as MapTile[]);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Distribute failed");
  } finally {
    setProgress(null);
  }
}

/**
 * POST /api/game/explore/far — spend 2 turns to plant a tile next to a
 * random enemy. Patches local state from the response so the threat box
 * + supply UI reflect the new bordering general without a reload.
 */
export async function farExpedition(
  user: User,
  mut: DashboardMutators
): Promise<{ tileId: string; enemyTileId: string } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/explore/far", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Far Expedition failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.tile) mut.mergeOwnedTiles([data.tile as MapTile]);
    // Order matters: the cache's border-tile router checks "does this tile
    // touch one of mine?" against the snapshot of myTiles taken before the
    // current merge. Adding the new owned tile first lets the enemy tile
    // be recognized as a border tile in the second call.
    if (data.enemyTile) mut.mergeBorderTiles([data.enemyTile as MapTile]);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      tileId: (data.tile as MapTile | undefined)?.tileId ?? "",
      enemyTileId: (data.targetEnemyTileId as string | undefined) ?? "",
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Far Expedition failed");
    return null;
  }
}

/**
 * POST /api/game/spy — cast the player's caste intel spell on a target
 * enemy tile. Returns the IntelReport for inline display.
 */
export async function castIntelSpell(
  user: User,
  spellId: string,
  targetTileId: string,
  mut: DashboardMutators
): Promise<{ intelReport: unknown; detected: boolean } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/spy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ spellId, targetTileId }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Spy spell failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      intelReport: data.intelReport,
      detected: Boolean(data.detected),
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Spy spell failed");
    return null;
  }
}

/** POST /api/game/admin/grant — admin-only manual 100-turn override. */
export async function adminGrant(
  user: User,
  mut: Pick<DashboardMutators, "setError" | "setPlayer">
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/admin/grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Grant failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Grant failed");
  }
}

/**
 * Pull TurnReports off a bulk-action response, push them onto the
 * recent-reports stack, and update the per-action progress counter.
 * Shared between `frontierExplore` and `bulkDistribute`.
 */
function consumeReports(
  data: { reports?: unknown; stoppedEarly?: unknown },
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void,
  total: number,
  stoppedPrefix: string
): void {
  const reports: TurnReport[] = Array.isArray(data.reports)
    ? (data.reports as TurnReport[])
    : [];
  let artifactsFound = 0;
  for (const r of reports) if (r.artifactFound) artifactsFound++;
  if (reports.length > 0) {
    mut.setRecentReports((prev) =>
      [...reports.slice().reverse(), ...prev].slice(0, 50)
    );
  }
  setProgress({ done: reports.length, total, artifactsFound });
  if (data.stoppedEarly) {
    mut.setError(
      `${stoppedPrefix} ${reports.length} / ${total}: ${String(
        data.stoppedEarly
      )}`
    );
  }
}
