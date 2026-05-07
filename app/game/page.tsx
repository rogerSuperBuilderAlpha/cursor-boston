/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { effectiveUnitCap } from "@/lib/game/turns";
import type {
  Caste,
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

interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
}

interface WorldResponse {
  success: boolean;
  tiles?: MapTile[];
  owners?: OwnerSummary[];
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
  const { user, userProfile, loading: authLoading } = useAuth();
  const isAdmin = Boolean(
    (userProfile as { isAdmin?: boolean } | null)?.isAdmin
  );
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [worldTiles, setWorldTiles] = useState<MapTile[]>([]);
  const [worldOwners, setWorldOwners] = useState<Map<string, OwnerSummary>>(
    new Map()
  );
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
  const [nameInput, setNameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const fetchPlayer = useCallback(async () => {
    setError(null);
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const [playerRes, elgRes, worldRes] = await Promise.all([
        fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/eligibility", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/world", {
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
      const worldData = (await worldRes.json()) as WorldResponse;
      if (worldData.success) {
        setWorldTiles(worldData.tiles ?? []);
        const map = new Map<string, OwnerSummary>();
        for (const o of worldData.owners ?? []) map.set(o.userId, o);
        setWorldOwners(map);
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

  const handleCreatePlayer = useCallback(
    async (displayName: string) => {
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
          body: JSON.stringify({ displayName }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to create player";
          throw new Error(msg);
        }
        await fetchPlayer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create player");
      } finally {
        setCreating(false);
      }
    },
    [user, fetchPlayer]
  );

  const handleSetName = useCallback(
    async (displayName: string) => {
      if (!user) return;
      setError(null);
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
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to save name";
          throw new Error(msg);
        }
        await fetchPlayer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save name");
      }
    },
    [user, fetchPlayer]
  );

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
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/game/help"
              className="inline-block px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              How to play
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    const trimmed = nameInput.trim();
    const canSubmit = trimmed.length >= 3 && trimmed.length <= 32 && !creating;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xl w-full text-center">
          <h1 className="text-3xl font-bold mb-4">Begin your campaign</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-3">
            You haven&apos;t enlisted yet. Name your general and we&apos;ll:
          </p>
          <ul className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 inline-block text-left list-disc ml-5">
            <li>Claim a 25-tile starting cluster, all already revealed.</li>
            <li>Grant you 300 starter turns — enough to assign every tile, pick a caste, recruit a real army, and still push the frontier before next Sunday&apos;s rollover.</li>
            <li>Drop a 3-week shield over you so no one can attack until you&apos;ve had a chance to develop your forces.</li>
            <li>From there: explore outward, develop the lands you take, build units, raid neighbors.</li>
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) handleCreatePlayer(trimmed);
            }}
            className="mb-3"
          >
            <label
              htmlFor="general-name"
              className="block text-left text-xs uppercase tracking-wide text-neutral-500 mb-1"
            >
              Name your general
            </label>
            <input
              id="general-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Captain Ash, The Quiet Hand"
              maxLength={32}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-neutral-500 text-left">
              3-32 characters. Letters, digits, spaces, apostrophes, hyphens.
            </p>
          </form>
          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => handleCreatePlayer(trimmed)}
              disabled={!canSubmit}
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {creating ? "Spawning…" : "Enlist as a general"}
            </button>
            <Link
              href="/game/help"
              className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              How to play
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Legacy gate: players who spawned before names were required get bounced
  // through this picker on next visit.
  if (!player.displayName) {
    const trimmed = nameInput.trim();
    const canSubmit = trimmed.length >= 3 && trimmed.length <= 32;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-3">Name your general</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-6 text-sm leading-relaxed">
            We retired anonymous IDs. Pick a name your fellow generals will see
            on the map and the leaderboard. You can change it later.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) handleSetName(trimmed);
            }}
          >
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Captain Ash"
              maxLength={32}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm mb-2"
              autoComplete="off"
            />
            {error && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              Save name
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <DashboardView
      player={player}
      tiles={tiles}
      worldTiles={worldTiles}
      worldOwners={worldOwners}
      eligibility={eligibility}
      isAdmin={isAdmin}
      error={error}
      renaming={renaming}
      renameInput={renameInput}
      onRenameStart={() => {
        setRenameInput(player.displayName);
        setRenaming(true);
      }}
      onRenameChange={setRenameInput}
      onRenameCancel={() => setRenaming(false)}
      onRenameSubmit={async () => {
        const next = renameInput.trim();
        if (next && next !== player.displayName) {
          await handleSetName(next);
        }
        setRenaming(false);
      }}
      exploreCount={exploreCount}
      onExploreCountChange={setExploreCount}
      exploring={exploring}
      exploreProgress={exploreProgress}
      onExplore={() => handleFrontierExplore(exploreCount)}
      distributeType={distributeType}
      onDistributeTypeChange={setDistributeType}
      distributeCount={distributeCount}
      onDistributeCountChange={setDistributeCount}
      distributing={distributing}
      distributeProgress={distributeProgress}
      onBulkDistribute={() =>
        handleBulkDistribute(
          distributeType,
          distributeCount,
          (t) => t.type === "unassigned",
          "unassigned"
        )
      }
      onBulkUnassign={(sourceType, count) =>
        handleBulkDistribute(
          "unassigned",
          count,
          (t) => t.type === sourceType,
          sourceType
        )
      }
      onAdminGrant={handleAdminGrant}
      recentReports={recentReports}
    />
  );
}

interface DashboardViewProps {
  player: GamePlayer;
  tiles: MapTile[];
  worldTiles: MapTile[];
  worldOwners: Map<string, OwnerSummary>;
  eligibility: Eligibility | null;
  isAdmin: boolean;
  error: string | null;
  renaming: boolean;
  renameInput: string;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCancel: () => void;
  onRenameSubmit: () => void;
  exploreCount: number;
  onExploreCountChange: (n: number) => void;
  exploring: boolean;
  exploreProgress: { done: number; total: number; artifactsFound: number } | null;
  onExplore: () => void;
  distributeType: LandType;
  onDistributeTypeChange: (t: LandType) => void;
  distributeCount: number;
  onDistributeCountChange: (n: number) => void;
  distributing: boolean;
  distributeProgress: { done: number; total: number; artifactsFound: number } | null;
  onBulkDistribute: () => void;
  onBulkUnassign: (sourceType: LandType, count: number) => void;
  onAdminGrant: () => void;
  recentReports: TurnReport[];
}

function DashboardView(props: DashboardViewProps) {
  const {
    player,
    tiles,
    worldTiles,
    worldOwners,
    eligibility,
    isAdmin,
    error,
    renaming,
    renameInput,
    onRenameStart,
    onRenameChange,
    onRenameCancel,
    onRenameSubmit,
    exploreCount,
    onExploreCountChange,
    exploring,
    exploreProgress,
    onExplore,
    distributeType,
    onDistributeTypeChange,
    distributeCount,
    onDistributeCountChange,
    distributing,
    distributeProgress,
    onBulkDistribute,
    onBulkUnassign,
    onAdminGrant,
    recentReports,
  } = props;

  const counts = useMemo(() => {
    let military = 0;
    let food = 0;
    let magic = 0;
    let unassigned = 0;
    for (const t of tiles) {
      if (t.type === "military") military++;
      else if (t.type === "food") food++;
      else if (t.type === "magic") magic++;
      else if (t.type === "unassigned") unassigned++;
    }
    return { military, food, magic, unassigned, total: tiles.length };
  }, [tiles]);

  const army = useMemo(() => {
    let ground = 0;
    let siege = 0;
    let air = 0;
    for (const t of tiles) {
      ground += t.units.ground;
      siege += t.units.siege;
      air += t.units.air;
    }
    return { ground, siege, air, total: ground + siege + air };
  }, [tiles]);

  const unitCap = useMemo(
    () => effectiveUnitCap(player, counts.food, counts.magic),
    [player, counts.food, counts.magic]
  );

  const threats = useMemo(
    () => countUnshieldedNeighbors(player.userId, tiles, worldTiles, worldOwners),
    [player.userId, tiles, worldTiles, worldOwners]
  );

  const shieldStatus = useMemo(
    () => deriveShieldStatus(player),
    [player]
  );

  const recommended = useMemo(
    () => recommendNext(player, counts, army, threats, unitCap),
    [player, counts, army, threats, unitCap]
  );

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <DashboardHeader
          player={player}
          renaming={renaming}
          renameInput={renameInput}
          onRenameStart={onRenameStart}
          onRenameChange={onRenameChange}
          onRenameCancel={onRenameCancel}
          onRenameSubmit={onRenameSubmit}
        />

        {error && (
          <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {eligibility && <EligibilityBanner eligibility={eligibility} />}

        <HeroCard
          turnsRemaining={player.turnsRemaining}
          turnsSpent={player.turnsSpentTotal}
          shield={shieldStatus}
        />

        <RecommendedAction
          rec={recommended}
          phase={player.phase}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <LandsCard counts={counts} />
          <ArmyCard army={army} cap={unitCap} />
          <ThreatCard threats={threats} shielded={shieldStatus.shielded} />
          <ShieldCard shield={shieldStatus} />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 space-y-4">
            {player.phase === "play" && (
              <ExploreFrontier
                count={exploreCount}
                onCountChange={onExploreCountChange}
                busy={exploring}
                progress={exploreProgress}
                maxCount={Math.min(50, player.turnsRemaining)}
                onExplore={onExplore}
              />
            )}

            {(player.phase === "distribute" || player.phase === "play") &&
              counts.unassigned > 0 && (
                <BulkDistribute
                  unassignedCount={counts.unassigned}
                  turnsRemaining={player.turnsRemaining}
                  type={distributeType}
                  onTypeChange={onDistributeTypeChange}
                  count={distributeCount}
                  onCountChange={onDistributeCountChange}
                  busy={distributing}
                  progress={distributeProgress}
                  onRun={onBulkDistribute}
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
                  onRun={onBulkUnassign}
                />
              )}
          </div>

          <div>
            <MiniMap tiles={tiles} userId={player.userId} />
          </div>
        </div>

        <NavGrid phase={player.phase} />

        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-dashed border-neutral-300 dark:border-neutral-700">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">
              Admin
            </p>
            <button
              onClick={onAdminGrant}
              className="px-4 py-2 border border-amber-400 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-sm"
              title="Manual override. The Sunday cron is the primary mechanism."
            >
              Grant 100 turns (admin)
            </button>
          </div>
        )}

        <DashboardReports reports={recentReports} />
      </div>
    </div>
  );
}

// ============================================================================
// Pure helpers
// ============================================================================

interface ShieldStatus {
  shielded: boolean;
  daysLeft: number;
  turnsLeft: number;
  // The bottleneck — i.e. which condition is keeping the shield up. Useful for
  // the UI copy ("waiting on time" vs "waiting on you to spend more turns").
  bottleneck: "time" | "turns" | "both" | "none";
}

function deriveShieldStatus(player: GamePlayer): ShieldStatus {
  const shieldUntil = asDate(player.shieldUntil);
  const now = Date.now();
  const msLeft = shieldUntil.getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const turnsLeft = Math.max(
    0,
    player.shieldDropAtTurn - player.turnsSpentTotal
  );
  const timeStillUp = msLeft > 0;
  const turnsStillUp = turnsLeft > 0;
  const shielded = timeStillUp || turnsStillUp;
  let bottleneck: ShieldStatus["bottleneck"] = "none";
  if (timeStillUp && turnsStillUp) bottleneck = "both";
  else if (timeStillUp) bottleneck = "time";
  else if (turnsStillUp) bottleneck = "turns";
  return { shielded, daysLeft, turnsLeft, bottleneck };
}

function asDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in (value as Record<string, unknown>)
  ) {
    const v = value as { _seconds: number; _nanoseconds?: number };
    return new Date(v._seconds * 1000 + (v._nanoseconds ?? 0) / 1e6);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date(0);
}

// Six axial neighbor offsets for a pointy-top hex grid.
const HEX_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

interface ThreatSummary {
  unshieldedNeighbors: number;
  totalForeignNeighbors: number;
  // Names of unshielded foreign generals bordering you, deduplicated, up to 3.
  topNeighborNames: string[];
}

function countUnshieldedNeighbors(
  myUserId: string,
  myTiles: MapTile[],
  worldTiles: MapTile[],
  worldOwners: Map<string, OwnerSummary>
): ThreatSummary {
  if (worldTiles.length === 0) {
    return { unshieldedNeighbors: 0, totalForeignNeighbors: 0, topNeighborNames: [] };
  }
  const tilesByCoord = new Map<string, MapTile>();
  for (const t of worldTiles) {
    tilesByCoord.set(`${t.q},${t.r}`, t);
  }
  const foreignOwnerIds = new Set<string>();
  const unshieldedOwnerIds = new Set<string>();
  for (const t of myTiles) {
    for (const [dq, dr] of HEX_NEIGHBORS) {
      const neighbor = tilesByCoord.get(`${t.q + dq},${t.r + dr}`);
      if (!neighbor) continue;
      if (!neighbor.ownerId || neighbor.ownerId === myUserId) continue;
      foreignOwnerIds.add(neighbor.ownerId);
      const owner = worldOwners.get(neighbor.ownerId);
      if (owner && !owner.shielded) unshieldedOwnerIds.add(neighbor.ownerId);
    }
  }
  const topNeighborNames: string[] = [];
  for (const id of unshieldedOwnerIds) {
    const o = worldOwners.get(id);
    if (o?.displayName) topNeighborNames.push(o.displayName);
    if (topNeighborNames.length >= 3) break;
  }
  return {
    unshieldedNeighbors: unshieldedOwnerIds.size,
    totalForeignNeighbors: foreignOwnerIds.size,
    topNeighborNames,
  };
}

interface Recommendation {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  // If set, use this anchor to scroll to an inline widget on the dashboard.
  scrollTo?: string;
  tone: "primary" | "secondary";
}

function recommendNext(
  player: GamePlayer,
  counts: { military: number; food: number; magic: number; unassigned: number; total: number },
  army: { total: number },
  threats: ThreatSummary,
  unitCap: number
): Recommendation {
  if (player.phase === "explore") {
    return {
      title: "Reveal your starting lands",
      body:
        "Each tile you reveal costs 1 turn. The setup page walks you through it.",
      ctaLabel: "Continue setup →",
      ctaHref: "/game/setup",
      tone: "primary",
    };
  }
  if (counts.unassigned > 0) {
    return {
      title: `Assign your ${counts.unassigned} unassigned land${counts.unassigned === 1 ? "" : "s"}`,
      body:
        "Each tile gets a role: military builds units, food raises your unit cap, magic boosts spells. A balanced opening is roughly 10 / 10 / 5. Each assignment costs 1 turn.",
      ctaLabel: "Configure bulk distribute ↓",
      scrollTo: "bulk-distribute",
      tone: "primary",
    };
  }
  if (player.caste === null) {
    return {
      title: "Pick your caste",
      body:
        "Five factions, each with its own units, spells, and identity. The choice is permanent — read each card on the setup page before you commit.",
      ctaLabel: "Pick a caste →",
      ctaHref: "/game/setup",
      tone: "primary",
    };
  }
  if (army.total === 0 && counts.military > 0) {
    return {
      title: "Recruit your first army",
      body: `You have ${counts.military} military land${counts.military === 1 ? "" : "s"} and a unit cap of ${unitCap}. A recruit batch costs 5 turns.`,
      ctaLabel: "Recruit →",
      ctaHref: "/game/recruit",
      tone: "primary",
    };
  }
  if (player.turnsRemaining < 1) {
    return {
      title: "Out of turns this week",
      body:
        "Merge a PR into cursor-boston before Sunday midnight EST and you'll get 100 turns at the next rollover.",
      ctaLabel: "How turns work",
      ctaHref: "/game/help",
      tone: "secondary",
    };
  }
  // Shielded with army → push frontier (low risk, free progress)
  const shieldStatus = deriveShieldStatus(player);
  if (shieldStatus.shielded && army.total > 0 && player.phase === "play") {
    return {
      title: "Push the frontier while you're shielded",
      body:
        "Each frontier tile costs 1 turn and has a 3% chance to surface an artifact. Use the time before your shield drops.",
      ctaLabel: "Configure frontier explore ↓",
      scrollTo: "frontier-explore",
      tone: "primary",
    };
  }
  if (!shieldStatus.shielded && threats.unshieldedNeighbors > 0) {
    const names = threats.topNeighborNames.slice(0, 2).join(", ");
    return {
      title: `${threats.unshieldedNeighbors} unshielded neighbor${threats.unshieldedNeighbors === 1 ? "" : "s"} in attack range`,
      body: names
        ? `Bordering you: ${names}. Open the world map to scout, or jump straight to the attack page.`
        : "Open the world map to scout your borders.",
      ctaLabel: "Open the map →",
      ctaHref: "/game/tiles",
      tone: "primary",
    };
  }
  if (!shieldStatus.shielded) {
    return {
      title: "No targets in range — push the frontier",
      body:
        "You aren't bordering any unshielded enemies. Explore outward to find new neighbors and pick up artifacts along the way.",
      ctaLabel: "Configure frontier explore ↓",
      scrollTo: "frontier-explore",
      tone: "primary",
    };
  }
  return {
    title: "Keep building",
    body:
      "Recruit more units, arm a defense spell on a key tile, or push the frontier for artifacts.",
    ctaLabel: "Open the map →",
    ctaHref: "/game/tiles",
    tone: "secondary",
  };
}

// ============================================================================
// Header + hero + cards
// ============================================================================

const CASTE_DOT: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};

function DashboardHeader({
  player,
  renaming,
  renameInput,
  onRenameStart,
  onRenameChange,
  onRenameCancel,
  onRenameSubmit,
}: {
  player: GamePlayer;
  renaming: boolean;
  renameInput: string;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCancel: () => void;
  onRenameSubmit: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {player.caste && (
          <span
            aria-hidden="true"
            className="inline-block w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-700 shrink-0"
            style={{ background: CASTE_DOT[player.caste] }}
            title={`${player.caste} caste`}
          />
        )}
        {renaming ? (
          <form
            className="flex items-center gap-2 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              onRenameSubmit();
            }}
          >
            <input
              type="text"
              value={renameInput}
              onChange={(e) => onRenameChange(e.target.value)}
              maxLength={32}
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xl font-semibold w-64 max-w-full"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Escape") onRenameCancel();
              }}
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onRenameCancel}
              className="px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="text-3xl font-bold truncate">{player.displayName}</h1>
        )}
      </div>
      {!renaming && (
        <button
          onClick={onRenameStart}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline shrink-0"
          title="Rename your general"
        >
          Rename
        </button>
      )}
    </div>
  );
}

function HeroCard({
  turnsRemaining,
  turnsSpent,
  shield,
}: {
  turnsRemaining: number;
  turnsSpent: number;
  shield: ShieldStatus;
}) {
  const lowTurns = turnsRemaining < 5;
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-neutral-950 p-6 mb-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Turns remaining
          </div>
          <div
            className={`text-5xl font-bold tabular-nums ${
              lowTurns
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {turnsRemaining}
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            spend cost: 1 explore · 1 distribute · 1 attack · 5 recruit · 5 spell
          </div>
        </div>

        <div className="border-l border-neutral-200 dark:border-neutral-800 pl-6">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Shield wall
          </div>
          {shield.shielded ? (
            <div className="text-sm">
              <span className="text-amber-700 dark:text-amber-400">🛡 Active</span>
              <div className="text-xs text-neutral-500 mt-0.5">
                {describeShieldRemaining(shield)}
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-red-600 dark:text-red-400">Down</span>
              <div className="text-xs text-neutral-500 mt-0.5">
                You can attack and be attacked
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto text-xs text-neutral-500 text-right">
          <div>Turns spent total</div>
          <div className="font-semibold tabular-nums text-base text-neutral-700 dark:text-neutral-300">
            {turnsSpent}
          </div>
        </div>
      </div>
    </div>
  );
}

function describeShieldRemaining(s: ShieldStatus): string {
  if (!s.shielded) return "Down";
  const parts: string[] = [];
  if (s.bottleneck === "both" || s.bottleneck === "time") {
    parts.push(`${s.daysLeft}d left`);
  }
  if (s.bottleneck === "both" || s.bottleneck === "turns") {
    parts.push(`${s.turnsLeft} more turns to spend`);
  }
  return `Drops in ${parts.join(" and ")}`;
}

function RecommendedAction({
  rec,
  phase,
}: {
  rec: Recommendation;
  phase: GamePlayer["phase"];
}) {
  const accentClass =
    rec.tone === "primary"
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/10"
      : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30";
  return (
    <div className={`rounded-xl border ${accentClass} p-5 mb-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
            Recommended next · {phase} phase
          </div>
          <h2 className="text-lg font-semibold mb-1">{rec.title}</h2>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {rec.body}
          </p>
        </div>
        {rec.ctaHref ? (
          <Link
            href={rec.ctaHref}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm whitespace-nowrap"
          >
            {rec.ctaLabel}
          </Link>
        ) : rec.scrollTo ? (
          <a
            href={`#${rec.scrollTo}`}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm whitespace-nowrap"
          >
            {rec.ctaLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function LandsCard({
  counts,
}: {
  counts: { military: number; food: number; magic: number; unassigned: number; total: number };
}) {
  const total = counts.total || 1;
  const segments: Array<{ key: string; label: string; value: number; color: string }> = [
    { key: "military", label: "Military", value: counts.military, color: "#dc2626" },
    { key: "food", label: "Food", value: counts.food, color: "#16a34a" },
    { key: "magic", label: "Magic", value: counts.magic, color: "#2563eb" },
    { key: "unassigned", label: "Unassigned", value: counts.unassigned, color: "#737373" },
  ];
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Lands
        </div>
        <div className="text-2xl font-semibold tabular-nums">{counts.total}</div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-neutral-100 dark:bg-neutral-800">
        {segments.map((s) =>
          s.value === 0 ? null : (
            <div
              key={s.key}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
              title={`${s.label}: ${s.value}`}
            />
          )
        )}
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
        {segments.map((s) => (
          <div key={s.key} className="flex justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmyCard({
  army,
  cap,
}: {
  army: { ground: number; siege: number; air: number; total: number };
  cap: number;
}) {
  const pct = cap > 0 ? Math.min(100, (army.total / cap) * 100) : 0;
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Army
        </div>
        <div className="text-2xl font-semibold tabular-nums">{army.total}</div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-neutral-100 dark:bg-neutral-800">
        <div
          className="bg-emerald-500"
          style={{ width: `${pct}%` }}
          title={`${army.total} / ${cap}`}
        />
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
        <div className="flex justify-between">
          <span>Ground</span>
          <span className="tabular-nums">{army.ground}</span>
        </div>
        <div className="flex justify-between">
          <span>Siege</span>
          <span className="tabular-nums">{army.siege}</span>
        </div>
        <div className="flex justify-between">
          <span>Air</span>
          <span className="tabular-nums">{army.air}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 dark:border-neutral-800 mt-1 pt-1 text-neutral-500">
          <span>Cap</span>
          <span className="tabular-nums">{cap}</span>
        </div>
      </div>
    </div>
  );
}

function ThreatCard({
  threats,
  shielded,
}: {
  threats: ThreatSummary;
  shielded: boolean;
}) {
  if (shielded) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Threat
        </div>
        <div className="text-sm">
          <span className="text-amber-700 dark:text-amber-400 font-semibold">
            Shielded
          </span>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          No one can attack you yet.
          {threats.totalForeignNeighbors > 0 && (
            <>
              {" "}
              You border {threats.totalForeignNeighbors} other general
              {threats.totalForeignNeighbors === 1 ? "" : "s"}.
            </>
          )}
        </div>
      </div>
    );
  }
  if (threats.unshieldedNeighbors === 0 && threats.totalForeignNeighbors === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Threat
        </div>
        <div className="text-sm">No bordering generals</div>
        <div className="text-xs text-neutral-500 mt-1">
          Push the frontier outward.
        </div>
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border p-4 ${
        threats.unshieldedNeighbors > 0
          ? "border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-900/10"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Threat
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {threats.unshieldedNeighbors}
        </div>
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        unshielded neighbors in range
      </div>
      {threats.topNeighborNames.length > 0 && (
        <div className="text-xs text-neutral-500 mt-1 truncate">
          {threats.topNeighborNames.join(" · ")}
        </div>
      )}
      {threats.totalForeignNeighbors > threats.unshieldedNeighbors && (
        <div className="text-xs text-neutral-500 mt-0.5">
          + {threats.totalForeignNeighbors - threats.unshieldedNeighbors}{" "}
          shielded
        </div>
      )}
    </div>
  );
}

function ShieldCard({ shield }: { shield: ShieldStatus }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        Shield wall
      </div>
      {shield.shielded ? (
        <>
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            🛡 Active
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 space-y-0.5">
            <div>
              <span className="tabular-nums">{shield.daysLeft}</span>d remaining
              by clock
            </div>
            <div>
              <span className="tabular-nums">{shield.turnsLeft}</span> more
              turns to spend
            </div>
            <div className="text-neutral-500 italic mt-1">
              Drops once <em>both</em> hit zero.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            Down
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            You can attack and be attacked.
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Mini-map of own territory
// ============================================================================

const MINI_HEX = 8;
const MINI_SQRT3 = Math.sqrt(3);
const MINI_PADDING = MINI_HEX * 1.5;

const MINI_FILL: Record<LandType, string> = {
  unrevealed: "#262626",
  unassigned: "#525252",
  military: "#dc2626",
  food: "#16a34a",
  magic: "#2563eb",
};

function MiniMap({ tiles, userId }: { tiles: MapTile[]; userId: string }) {
  const own = tiles.filter((t) => t.ownerId === userId);
  const viewBox = useMemo(() => {
    if (own.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const t of own) {
      const x = MINI_HEX * MINI_SQRT3 * (t.q + t.r / 2);
      const y = MINI_HEX * (3 / 2) * t.r;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      x: minX - MINI_PADDING,
      y: minY - MINI_PADDING,
      width: maxX - minX + 2 * MINI_PADDING,
      height: maxY - minY + 2 * MINI_PADDING,
    };
  }, [own]);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50 dark:bg-neutral-950">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Your territory
        </div>
        <Link
          href="/game/tiles"
          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          Open map →
        </Link>
      </div>
      {viewBox ? (
        <Link href="/game/tiles" className="block">
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="w-full h-auto"
            style={{ maxHeight: 240 }}
          >
            {own.map((t) => {
              const cx = MINI_HEX * MINI_SQRT3 * (t.q + t.r / 2);
              const cy = MINI_HEX * (3 / 2) * t.r;
              const dx = (MINI_HEX * MINI_SQRT3) / 2;
              const dy = MINI_HEX / 2;
              const points = [
                [cx, cy - MINI_HEX],
                [cx + dx, cy - dy],
                [cx + dx, cy + dy],
                [cx, cy + MINI_HEX],
                [cx - dx, cy + dy],
                [cx - dx, cy - dy],
              ]
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join(" ");
              return (
                <polygon
                  key={t.tileId}
                  points={points}
                  fill={MINI_FILL[t.type]}
                  stroke="#171717"
                  strokeWidth={0.5}
                />
              );
            })}
          </svg>
        </Link>
      ) : (
        <p className="text-xs text-neutral-500 py-8 text-center">
          No tiles yet.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Grouped nav
// ============================================================================

function NavGrid({ phase }: { phase: GamePlayer["phase"] }) {
  const inSetup = phase !== "play";
  return (
    <div className="space-y-3">
      <NavGroup
        label="Take action"
        items={
          inSetup
            ? [
                { href: "/game/setup", label: "Continue setup", primary: true },
                { href: "/game/tiles", label: "World map" },
              ]
            : [
                { href: "/game/tiles", label: "World map", primary: true },
                { href: "/game/recruit", label: "Recruit" },
                { href: "/game/spells", label: "Spells" },
                { href: "/game/attacks", label: "Attack log" },
              ]
        }
      />
      <NavGroup
        label="Reference"
        items={[
          { href: "/game/artifacts", label: "Artifacts" },
          { href: "/game/leaderboard", label: "Leaderboard" },
          { href: "/game/help", label: "Help & Lore" },
        ]}
      />
    </div>
  );
}

function NavGroup({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={
              it.primary
                ? "px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm"
                : "px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
            }
          >
            {it.label}
          </Link>
        ))}
      </div>
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
    <div
      id="frontier-explore"
      className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 scroll-mt-24"
    >
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
    <div
      id="bulk-distribute"
      className="rounded-lg border-2 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 scroll-mt-24"
    >
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
