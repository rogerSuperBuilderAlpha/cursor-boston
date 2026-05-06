/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Caste, GamePlayer, GameTile, LandType } from "@/lib/game/types";

const CASTES: Caste[] = ["white", "blue", "black", "red", "green"];
const DISTRIBUTABLE: LandType[] = ["military", "food", "magic"];

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: GameTile[];
  error?: string;
}

export default function GameSetupPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    if (!user) {
      setLoading(false);
      return;
    }
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
    refresh();
  }, [authLoading, refresh]);

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
    [user, refresh]
  );

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
        <Link href="/login" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Sign in to begin
        </Link>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/game" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Enlist first
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Setup</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <span>Phase: <strong className="capitalize">{player.phase}</strong></span>
          <span>Turns: <strong>{player.turnsRemaining}</strong></span>
          <span>Explored: <strong>{tiles.filter((t) => t.type !== "unrevealed").length} / 100</strong></span>
        </div>

        {error && (
          <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {player.phase === "explore" && (
          <ExplorePanel
            player={player}
            tiles={tiles}
            busy={busy}
            onExplore={() => callApi("/api/game/setup/explore")}
          />
        )}

        {player.phase === "distribute" && (
          <DistributePanel
            tiles={tiles}
            busy={busy}
            onDistribute={(tileId, type) =>
              callApi("/api/game/setup/distribute", { tileId, type })
            }
            onChooseCaste={(caste) => callApi("/api/game/setup/caste", { caste })}
          />
        )}

        {player.phase === "play" && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Setup complete</h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6">
              Caste locked: <strong className="capitalize">{player.caste}</strong>.
              Combat and spells arrive in PR 3.
            </p>
            <Link
              href="/game"
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplorePanel({
  player,
  tiles,
  busy,
  onExplore,
}: {
  player: GamePlayer;
  tiles: GameTile[];
  busy: boolean;
  onExplore: () => void;
}) {
  const unrevealed = tiles.filter((t) => t.type === "unrevealed").length;
  return (
    <div>
      <p className="mb-4 text-neutral-600 dark:text-neutral-300">
        Each turn spent reveals one of your unrevealed lands. {unrevealed} remain.
      </p>
      <button
        onClick={onExplore}
        disabled={busy || player.turnsRemaining < 1 || unrevealed === 0}
        className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
      >
        {busy ? "Revealing…" : "Explore next tile (1 turn)"}
      </button>
    </div>
  );
}

function DistributePanel({
  tiles,
  busy,
  onDistribute,
  onChooseCaste,
}: {
  tiles: GameTile[];
  busy: boolean;
  onDistribute: (tileId: string, type: LandType) => void;
  onChooseCaste: (caste: Caste) => void;
}) {
  const distributable = tiles.filter((t) => t.type !== "unrevealed");
  const counts = {
    military: distributable.filter((t) => t.type === "military").length,
    food: distributable.filter((t) => t.type === "food").length,
    magic: distributable.filter((t) => t.type === "magic").length,
    unassigned: distributable.filter((t) => t.type === "unassigned").length,
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6 text-center text-sm">
        <Counter label="Military" value={counts.military} />
        <Counter label="Food" value={counts.food} />
        <Counter label="Magic" value={counts.magic} />
        <Counter label="Unassigned" value={counts.unassigned} />
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-3">Choose your caste to start playing</h2>
        <div className="flex flex-wrap gap-2">
          {CASTES.map((c) => (
            <button
              key={c}
              onClick={() => onChooseCaste(c)}
              disabled={busy}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors capitalize disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Caste choice is permanent. You can keep distributing tiles after, but
          choosing the caste advances you into the play phase.
        </p>
      </div>

      <h2 className="font-semibold mb-3">Tiles ({distributable.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
        {distributable.map((t) => (
          <div
            key={t.tileId}
            className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm"
          >
            <div>
              <span className="font-mono">{t.tileId}</span>
              <span className="ml-2 capitalize text-neutral-500">
                {t.type}
              </span>
            </div>
            <div className="flex gap-1">
              {DISTRIBUTABLE.map((type) => (
                <button
                  key={type}
                  onClick={() => onDistribute(t.tileId, type)}
                  disabled={busy || t.type === type}
                  className={`px-2 py-1 rounded text-xs border ${
                    t.type === type
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  } disabled:opacity-50`}
                >
                  {type[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
