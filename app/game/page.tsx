/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { GamePlayer, GameTile } from "@/lib/game/types";

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: GameTile[];
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
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            claim a hundred lands, and contest the world map.
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
            <li>Claim 100 lands as your starting territory.</li>
            <li>Grant you 100 starter turns to begin the setup ramp.</li>
            <li>Drop a 3-week shield over you so no one can attack until you&apos;ve had a chance to develop your forces.</li>
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
              spend on the setup page reveals one of your 100 lands. After all
              100 are revealed, the game auto-advances to the distribute phase.
            </p>
          )}
          {player.phase === "distribute" && (
            <p>
              <strong>You&apos;re in the distribute phase.</strong> Assign each
              of your 100 lands a role: <em>military</em> (produces units),{" "}
              <em>food</em> (raises your unit cap), or <em>magic</em>{" "}
              (multiplies spell strength). Each change costs 1 turn. Pick a
              caste from the setup page when you&apos;re ready to start playing.
            </p>
          )}
          {player.phase === "play" && (
            <p>
              <strong>You&apos;re playing.</strong> Build units on military
              tiles, arm defense spells, attack bordering enemies. Your shield
              wall drops once <strong>both</strong> 3 weeks have passed since
              you enlisted <strong>and</strong> you&apos;ve spent at least 300
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
          <Stat label="Tiles explored" value={`${revealed} / 100`} />
          <Stat label="Tiles distributed" value={`${distributed} / 100`} />
          <Stat label="Turns spent" value={String(player.turnsSpentTotal)} />
          <Stat label="Shield drops at turn" value={String(player.shieldDropAtTurn)} />
        </div>

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
