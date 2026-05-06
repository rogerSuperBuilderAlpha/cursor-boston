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

export default function GameDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<GameTile[]>([]);
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
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (!data.success) throw new Error(data.error ?? "Failed to load player");
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
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
