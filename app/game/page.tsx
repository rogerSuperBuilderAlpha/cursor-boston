/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type {
  GamePlayer,
  LandType,
  MapTile,
  TurnReport,
} from "@/lib/game/types";

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: string;
}

interface EligibilityResponse {
  success: boolean;
  githubLogin: string | null;
  mergedPrCountThisWeek: number;
  nextRolloverIso: string;
  windowStartIso: string;
  error?: { message?: string } | string;
}

interface Eligibility {
  githubLogin: string | null;
  mergedPrCountThisWeek: number;
  nextRolloverIso: string;
}

export default function GameDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);
  const [exploreCount, setExploreCount] = useState(1);
  const [exploreProgress, setExploreProgress] = useState<{
    done: number;
    total: number;
    artifactsFound: number;
  } | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);
  const [distributing, setDistributing] = useState(false);
  const [distributeType, setDistributeType] = useState<LandType>("military");
  const [distributeCount, setDistributeCount] = useState(10);
  const [distributeProgress, setDistributeProgress] = useState<{
    done: number;
    total: number;
    artifactsFound: number;
  } | null>(null);

  const fetchPlayer = useCallback(async () => {
    setError(null);
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const [playerRes, elgRes] = await Promise.all([
        fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/eligibility", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = (await playerRes.json()) as PlayerResponse;
      if (!data.success) throw new Error(data.error ?? "Failed to load player");
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
      const elgData = (await elgRes.json()) as EligibilityResponse;
      if (elgData.success) {
        setEligibility({
          githubLogin: elgData.githubLogin,
          mergedPrCountThisWeek: elgData.mergedPrCountThisWeek,
          nextRolloverIso: elgData.nextRolloverIso,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load player");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    fetchPlayer();
  }, [authLoading, fetchPlayer]);

  const handleCreatePlayer = useCallback(async () => {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to create player");
      await fetchPlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create player");
    } finally {
      setCreating(false);
    }
  }, [user, fetchPlayer]);

  const handleFrontierExplore = useCallback(
    async (count: number) => {
      if (!user) return;
      // Bulk endpoint caps at 50 per call — match it on the client.
      const total = Math.max(1, Math.min(50, Math.floor(count)));
      setExploring(true);
      setError(null);
      setExploreProgress({ done: 0, total, artifactsFound: 0 });
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
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Explore failed";
          throw new Error(msg);
        }
        const reports: TurnReport[] = Array.isArray(data.reports)
          ? data.reports
          : [];
        let artifactsFound = 0;
        for (const r of reports) if (r.artifactFound) artifactsFound++;
        if (reports.length > 0) {
          setRecentReports((prev) =>
            [...reports.slice().reverse(), ...prev].slice(0, 50)
          );
        }
        setExploreProgress({
          done: reports.length,
          total,
          artifactsFound,
        });
        if (data.stoppedEarly) {
          setError(
            `Claimed ${reports.length} / ${total}: ${data.stoppedEarly}`
          );
        }
        await fetchPlayer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Explore failed");
      } finally {
        setExploring(false);
        setExploreProgress(null);
      }
    },
    [user, fetchPlayer]
  );

  const handleBulkDistribute = useCallback(
    async (
      targetType: LandType,
      count: number,
      sourceFilter: (t: MapTile) => boolean,
      sourceLabel: string
    ) => {
      if (!user) return;
      const sources = tiles.filter(sourceFilter).map((t) => t.tileId);
      const total = Math.min(sources.length, Math.max(1, Math.floor(count)));
      if (total === 0) {
        setError(`No ${sourceLabel} tiles to distribute.`);
        return;
      }
      setDistributing(true);
      setError(null);
      // Single bulk transaction — no per-step progress counter (the bulk txn
      // commits everything atomically). Show an indeterminate state via
      // distributeProgress.total so the existing progress UI reads as
      // "Reverting…" until done.
      setDistributeProgress({ done: 0, total, artifactsFound: 0 });
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
            type: targetType,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Distribute failed";
          throw new Error(msg);
        }
        const reports: TurnReport[] = Array.isArray(data.reports)
          ? data.reports
          : [];
        let artifactsFound = 0;
        for (const r of reports) if (r.artifactFound) artifactsFound++;
        if (reports.length > 0) {
          setRecentReports((prev) =>
            [...reports.slice().reverse(), ...prev].slice(0, 50)
          );
        }
        setDistributeProgress({
          done: reports.length,
          total,
          artifactsFound,
        });
        if (data.stoppedEarly) {
          setError(
            `Stopped early after ${reports.length} / ${total}: ${data.stoppedEarly}`
          );
        }
        await fetchPlayer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Distribute failed");
      } finally {
        setDistributing(false);
        setDistributeProgress(null);
      }
    },
    [user, tiles, fetchPlayer]
  );

  const handleAdminGrant = useCallback(async () => {
    if (!user) return;
    setError(null);
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
      if (!data.success) throw new Error(data.error?.message ?? "Grant failed");
      await fetchPlayer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grant failed");
    }
  }, [user, fetchPlayer]);

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
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold mb-4">Generals</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-3">
            A turn-based strategy game for the cursor-boston community. Sign in,
            claim a starting cluster of lands, and push outward into the world.
          </p>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
            <strong>The catch:</strong> turns are gated by PR merges. Merge a PR
            into this repo any time during a week and you&apos;ll receive 100
            turns the following Sunday at midnight EST. No PR, no turns.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xl w-full text-center">
          <h1 className="text-3xl font-bold mb-4">Begin your campaign</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-3">
            You haven&apos;t enlisted yet. Pressing the button below will:
          </p>
          <ul className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 inline-block text-left list-disc ml-5">
            <li>Claim a 25-tile starting cluster, all already revealed.</li>
            <li>Grant you 100 starter turns to assign land types and pick a caste.</li>
            <li>Drop a 3-week shield over you so no one can attack until you&apos;ve had a chance to develop your forces.</li>
            <li>From there: push the frontier, build armies, raid neighbors.</li>
          </ul>
          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            onClick={handleCreatePlayer}
            disabled={creating}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            {creating ? "Spawning…" : "Enlist as a general"}
          </button>
        </div>
      </div>
    );
  }

  const revealed = tiles.filter((t) => t.type !== "unrevealed").length;
  const distributed = tiles.filter(
    (t) => t.type === "military" || t.type === "food" || t.type === "magic"
  ).length;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="text-3xl font-bold">Generals — Dashboard</h1>
          <span className="text-sm text-neutral-500">{user.email}</span>
        </div>

        {error && (
          <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          {player.phase === "explore" && (
            <p>
              <strong>You&apos;re in the explore phase.</strong> Each turn you
              spend on the setup page reveals one of your starting lands. Once
              all are revealed, you&apos;ll auto-advance to the distribute phase.
            </p>
          )}
          {player.phase === "distribute" && (
            <p>
              <strong>You&apos;re in the distribute phase.</strong> Assign each
              of your lands a role: <em>military</em> (produces units),{" "}
              <em>food</em> (raises your unit cap), or <em>magic</em>{" "}
              (multiplies spell strength). Each assignment costs 1 turn. Pick a
              caste from the setup page when you&apos;re ready to start playing.
            </p>
          )}
          {player.phase === "play" && (
            <p>
              <strong>You&apos;re playing.</strong> Spend turns to build units,
              arm defense spells, attack bordering enemies, or push the frontier
              for a new tile (and a chance at an artifact). Your shield wall
              drops once <strong>both</strong> 3 weeks have passed since you
              enlisted <strong>and</strong> you&apos;ve spent at least 300
              turns. After that, you can attack and be attacked.
            </p>
          )}
        </div>

        {eligibility && <EligibilityBanner eligibility={eligibility} />}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat label="Phase" value={player.phase} />
          <Stat
            label="Turns remaining"
            value={String(player.turnsRemaining)}
          />
          <Stat label="Caste" value={player.caste ?? "—"} />
          <Stat label="Lands held" value={String(tiles.length)} />
          <Stat
            label="Tiles explored"
            value={`${revealed} / ${tiles.length}`}
          />
          <Stat
            label="Tiles distributed"
            value={`${distributed} / ${tiles.length}`}
          />
          <Stat label="Turns spent" value={String(player.turnsSpentTotal)} />
          <Stat label="Shield drops at turn" value={String(player.shieldDropAtTurn)} />
        </div>

        {player.phase === "play" && (
          <ExploreFrontier
            count={exploreCount}
            onCountChange={setExploreCount}
            busy={exploring}
            progress={exploreProgress}
            maxCount={Math.min(50, player.turnsRemaining)}
            onExplore={() => handleFrontierExplore(exploreCount)}
          />
        )}

        {(player.phase === "distribute" || player.phase === "play") &&
          tiles.some((t) => t.type === "unassigned") && (
            <BulkDistribute
              unassignedCount={
                tiles.filter((t) => t.type === "unassigned").length
              }
              turnsRemaining={player.turnsRemaining}
              type={distributeType}
              onTypeChange={setDistributeType}
              count={distributeCount}
              onCountChange={setDistributeCount}
              busy={distributing}
              progress={distributeProgress}
              onRun={() =>
                handleBulkDistribute(
                  distributeType,
                  distributeCount,
                  (t) => t.type === "unassigned",
                  "unassigned"
                )
              }
            />
          )}

        {player.phase === "play" &&
          tiles.some(
            (t) =>
              t.type === "military" ||
              t.type === "food" ||
              t.type === "magic"
          ) && (
            <BulkUnassign
              tiles={tiles}
              turnsRemaining={player.turnsRemaining}
              busy={distributing}
              progress={distributeProgress}
              onRun={(sourceType, count) =>
                handleBulkDistribute(
                  "unassigned",
                  count,
                  (t) => t.type === sourceType,
                  sourceType
                )
              }
            />
          )}

        <div className="flex flex-wrap gap-3">
          {player.phase !== "play" ? (
            <Link
              href="/game/setup"
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Continue setup →
            </Link>
          ) : (
            <>
              <Link
                href="/game/tiles"
                className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
              >
                Manage tiles →
              </Link>
              <Link
                href="/game/attacks"
                className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Attack log
              </Link>
            </>
          )}
          {player.phase === "play" && (
            <>
              <Link
                href="/game/recruit"
                className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Recruit
              </Link>
              <Link
                href="/game/spells"
                className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Spells
              </Link>
            </>
          )}
          <Link
            href="/game/artifacts"
            className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Artifacts
          </Link>
          <Link
            href="/game/leaderboard"
            className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Leaderboard
          </Link>
          <button
            onClick={handleAdminGrant}
            className="px-5 py-2.5 border border-amber-400 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            title="Admin-only manual override. The Saturday cron is the primary mechanism."
          >
            Grant 100 turns (admin)
          </button>
        </div>

        <DashboardReports reports={recentReports} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}

function ExploreFrontier({
  count,
  onCountChange,
  busy,
  progress,
  maxCount,
  onExplore,
}: {
  count: number;
  onCountChange: (n: number) => void;
  busy: boolean;
  progress: { done: number; total: number; artifactsFound: number } | null;
  maxCount: number;
  onExplore: () => void;
}) {
  const safeMax = Math.max(1, maxCount);
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Push the frontier</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        Spend turns to claim brand-new tiles adjacent to your territory. The
        further you push, the more likely your next tile spawns next to enemy
        ground. Every spent turn rolls a 3% chance for an artifact.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Tiles to claim:{" "}
          <input
            type="number"
            min={1}
            max={Math.min(50, safeMax)}
            value={count}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) onCountChange(n);
            }}
            disabled={busy}
            className="w-20 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={onExplore}
          disabled={busy || safeMax < 1}
          className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Pushing the frontier (${count} tile${count === 1 ? "" : "s"})…`
            : `Explore ×${count}`}
        </button>
        <span className="text-xs text-neutral-500">
          (you have {safeMax} turn{safeMax === 1 ? "" : "s"} available)
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-emerald-100 dark:bg-emerald-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles claimed
            </span>
            <span>
              {progress.artifactsFound} artifact
              {progress.artifactsFound === 1 ? "" : "s"} found
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkDistribute({
  unassignedCount,
  turnsRemaining,
  type,
  onTypeChange,
  count,
  onCountChange,
  busy,
  progress,
  onRun,
}: {
  unassignedCount: number;
  turnsRemaining: number;
  type: LandType;
  onTypeChange: (t: LandType) => void;
  count: number;
  onCountChange: (n: number) => void;
  busy: boolean;
  progress: { done: number; total: number; artifactsFound: number } | null;
  onRun: () => void;
}) {
  const max = Math.min(unassignedCount, turnsRemaining);
  const safeCount = Math.max(1, Math.min(max || 1, Math.floor(count)));
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Bulk-assign land types</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        You have{" "}
        <strong>
          {unassignedCount} unassigned tile{unassignedCount === 1 ? "" : "s"}
        </strong>
        . Pick a role and a count, and the next N unassigned tiles will be
        assigned to that role one at a time. Each assignment costs 1 turn and
        rolls a 3% chance for an artifact.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Assign:{" "}
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value as LandType)}
            disabled={busy}
            className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent capitalize"
          >
            <option value="military">military</option>
            <option value="food">food</option>
            <option value="magic">magic</option>
          </select>
        </label>
        <label className="text-sm">
          Count:{" "}
          <input
            type="number"
            min={1}
            max={Math.max(1, max)}
            value={count}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) onCountChange(n);
            }}
            disabled={busy}
            className="w-20 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={onRun}
          disabled={busy || max === 0}
          className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Assigning ${safeCount} tiles…`
            : `Assign ${safeCount} → ${type}`}
        </button>
        <span className="text-xs text-neutral-500">
          (cap: {max} — limited by turns or unassigned tiles)
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-amber-100 dark:bg-amber-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles assigned
            </span>
            <span>
              {progress.artifactsFound} artifact
              {progress.artifactsFound === 1 ? "" : "s"} found
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkUnassign({
  tiles,
  turnsRemaining,
  busy,
  progress,
  onRun,
}: {
  tiles: MapTile[];
  turnsRemaining: number;
  busy: boolean;
  progress: { done: number; total: number; artifactsFound: number } | null;
  onRun: (sourceType: "military" | "food" | "magic", count: number) => void;
}) {
  const [sourceType, setSourceType] = useState<"military" | "food" | "magic">(
    "military"
  );
  const [count, setCount] = useState(5);
  const sourceCount = tiles.filter((t) => t.type === sourceType).length;
  const max = Math.min(sourceCount, turnsRemaining);
  const safeCount = Math.max(1, Math.min(max || 1, Math.floor(count)));
  const pct = progress
    ? Math.round((progress.done / Math.max(1, progress.total)) * 100)
    : 0;
  return (
    <div className="rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Bulk-revert tiles to unassigned</h2>
        <span className="text-xs text-neutral-500">1 turn / tile</span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        Reset assigned tiles back to <em>unassigned</em>. Each revert costs 1
        turn and rolls for an artifact, just like a fresh assignment. You&apos;ll
        pay another turn each to re-assign them later, so use this when you
        actually want to redistribute the territory mix.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Source type:{" "}
          <select
            value={sourceType}
            onChange={(e) =>
              setSourceType(e.target.value as "military" | "food" | "magic")
            }
            disabled={busy}
            className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent capitalize"
          >
            <option value="military">military</option>
            <option value="food">food</option>
            <option value="magic">magic</option>
          </select>
        </label>
        <label className="text-sm">
          Count:{" "}
          <input
            type="number"
            min={1}
            max={Math.max(1, max)}
            value={count}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setCount(n);
            }}
            disabled={busy}
            className="w-20 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={() => onRun(sourceType, safeCount)}
          disabled={busy || max === 0}
          className="px-5 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy
            ? `Reverting ${safeCount} tiles…`
            : `Revert ${safeCount} ${sourceType} → unassigned`}
        </button>
        <span className="text-xs text-neutral-500">
          ({sourceCount} {sourceType} tile{sourceCount === 1 ? "" : "s"} · cap {max})
        </span>
      </div>
      {progress && (
        <div className="mt-3 space-y-1">
          <div className="h-2 w-full bg-rose-100 dark:bg-rose-950/40 rounded overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
            <span>
              {progress.done} / {progress.total} tiles reverted
            </span>
            <span>
              {progress.artifactsFound} artifact
              {progress.artifactsFound === 1 ? "" : "s"} found
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const REPORT_RARITY_TEXT: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};

function DashboardReports({ reports }: { reports: TurnReport[] }) {
  if (reports.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Field reports (this session)
      </h3>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-96 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
        {reports.map((r, idx) => (
          <div
            key={`${r.action}-${r.turnIndex}-${idx}`}
            className="px-4 py-3 text-sm leading-relaxed"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-medium">{r.summary}</span>
              <span className="text-xs text-neutral-500 capitalize ml-2 shrink-0">
                {r.action} · {r.cost}t
              </span>
            </div>
            {r.narrative.length > 0 && (
              <div className="text-neutral-600 dark:text-neutral-400 italic space-y-1">
                {r.narrative.map((line, lineIdx) => (
                  <p key={lineIdx}>{line}</p>
                ))}
              </div>
            )}
            {r.artifactFound && (
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
                  REPORT_RARITY_TEXT[r.artifactFound.rarity] ?? ""
                }`}
              >
                {r.artifactFound.rarity} artifact found —{" "}
                <span className="normal-case">{r.artifactFound.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "any moment now";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function EligibilityBanner({ eligibility }: { eligibility: Eligibility }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const rolloverAt = new Date(eligibility.nextRolloverIso).getTime();
  const remaining = rolloverAt - now;
  const eligible = eligibility.mergedPrCountThisWeek > 0;
  const githubConnected = eligibility.githubLogin !== null;

  if (!githubConnected) {
    return (
      <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm leading-relaxed">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <strong className="text-amber-900 dark:text-amber-200">
            ⚠ GitHub not connected
          </strong>
          <span className="text-xs text-amber-800 dark:text-amber-300 font-mono shrink-0">
            Next rollover: {formatCountdown(remaining)}
          </span>
        </div>
        <p className="text-amber-900 dark:text-amber-200">
          Generals earns turns by tracking PRs you merge into this repo. Without
          a connected GitHub account, the rollover can&apos;t see your merges.{" "}
          <Link
            href="/profile"
            className="underline hover:no-underline font-medium"
          >
            Connect GitHub on your profile →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm leading-relaxed ${
        eligible
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <strong>
          {eligible ? "✓" : "✗"} GitHub connected as{" "}
          <span className="font-mono">{eligibility.githubLogin}</span>
        </strong>
        <span className="text-xs font-mono shrink-0">
          Next rollover: {formatCountdown(remaining)}
        </span>
      </div>
      {eligible ? (
        <p>
          You&apos;ve merged{" "}
          <strong>
            {eligibility.mergedPrCountThisWeek} PR
            {eligibility.mergedPrCountThisWeek === 1 ? "" : "s"}
          </strong>{" "}
          this week. You&apos;ll receive 100 turns at the next rollover.
        </p>
      ) : (
        <p>
          You haven&apos;t merged a PR this week yet. Merge at least one before
          the rollover (Sunday 00:00 EST) to earn 100 turns next week. No PR,
          no turns.
        </p>
      )}
    </div>
  );
}
