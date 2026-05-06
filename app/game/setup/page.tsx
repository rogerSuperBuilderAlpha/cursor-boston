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

interface RevealLog {
  tileId: string;
  type: LandType;
  at: number; // Date.now()
  summary?: string;
  narrative?: string[];
  artifactFound?: {
    definitionId: string;
    name: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    type: "offense" | "defense" | "production" | "utility";
  };
}

export default function GameSetupPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentReveals, setRecentReveals] = useState<RevealLog[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

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
        <Link
          href="/game"
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
        >
          ← Back to dashboard
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Setup</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Finish the setup ramp here, then return to the dashboard to manage
            tiles, build units, and attack.
          </p>
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
            recentReveals={recentReveals}
            batchProgress={batchProgress}
            onExploreBatch={runExploreBatch}
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
  recentReveals,
  batchProgress,
  onExploreBatch,
}: {
  player: GamePlayer;
  tiles: GameTile[];
  busy: boolean;
  recentReveals: RevealLog[];
  batchProgress: { done: number; total: number } | null;
  onExploreBatch: (count: number) => void;
}) {
  const unrevealed = tiles.filter((t) => t.type === "unrevealed").length;
  const [batchInput, setBatchInput] = useState<string>("10");
  const parsedBatch = Math.max(
    1,
    Math.min(
      Math.min(unrevealed, player.turnsRemaining, 100),
      Number.parseInt(batchInput, 10) || 1
    )
  );
  const noTurns = player.turnsRemaining < 1;
  const allRevealed = unrevealed === 0;

  return (
    <div>
      <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
        <p className="font-semibold mb-1">Step 1 of 3 — Explore</p>
        <p>
          You spawned with 100 lands hidden under fog. Each turn spent reveals
          one of them. Use the batch input below to spend many turns at once —
          handy if you want to blast through the setup ramp quickly. Once all
          100 are revealed, you&apos;ll automatically move on to the distribute
          phase.
        </p>
      </div>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
        <strong>{unrevealed}</strong> land{unrevealed === 1 ? "" : "s"} remain
        unrevealed. You have <strong>{player.turnsRemaining}</strong> turns
        available.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <button
          onClick={() => onExploreBatch(1)}
          disabled={busy || noTurns || allRevealed}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          {busy && batchProgress?.total === 1 ? "Revealing…" : "Explore 1 tile (1 turn)"}
        </button>
        <div className="flex items-end gap-2">
          <label className="block text-xs text-neutral-500">
            Batch size
            <input
              type="number"
              min={1}
              max={Math.min(unrevealed, player.turnsRemaining, 100)}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              disabled={busy}
              className="mt-1 block w-24 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 disabled:opacity-50"
            />
          </label>
          <button
            onClick={() => onExploreBatch(parsedBatch)}
            disabled={busy || noTurns || allRevealed || parsedBatch < 1}
            className="px-5 py-2.5 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
          >
            {busy && batchProgress
              ? `Revealing ${batchProgress.done} / ${batchProgress.total}…`
              : `Explore ${parsedBatch} tile${parsedBatch === 1 ? "" : "s"} (${parsedBatch} turn${parsedBatch === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>

      <RevealLogList reveals={recentReveals} />
    </div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};

function RevealLogList({ reveals }: { reveals: RevealLog[] }) {
  if (reveals.length === 0) {
    return (
      <p className="text-xs text-neutral-500 italic mt-4">
        Field reports will appear here once you start exploring. Each spent
        turn yields a brief narrative — and, with luck, an ancient artifact.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">Field reports (newest first)</h3>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-96 overflow-y-auto">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {reveals.map((r, idx) => (
            <li
              key={`${r.tileId}-${r.at}-${idx}`}
              className="px-4 py-3 text-sm leading-relaxed"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-medium">
                  {r.summary ?? `Revealed ${r.tileId}`}
                </span>
                <span className="text-xs text-neutral-500 capitalize ml-2 shrink-0">
                  {r.type}
                </span>
              </div>
              {r.narrative && r.narrative.length > 0 && (
                <div className="text-neutral-600 dark:text-neutral-400 italic space-y-1">
                  {r.narrative.map((line, lineIdx) => (
                    <p key={lineIdx}>{line}</p>
                  ))}
                </div>
              )}
              {r.artifactFound && (
                <div
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
                    RARITY_COLORS[r.artifactFound.rarity] ?? ""
                  }`}
                >
                  {r.artifactFound.rarity} artifact found —{" "}
                  <span className="normal-case">{r.artifactFound.name}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        Showing the last {reveals.length} report{reveals.length === 1 ? "" : "s"} from this session.{" "}
        <Link href="/game/artifacts" className="underline hover:no-underline">
          View artifact inventory →
        </Link>
      </p>
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
      <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed space-y-2">
        <p className="font-semibold">Step 2 of 3 — Distribute</p>
        <p>Assign each tile a role. Each change (including re-changes) costs 1 turn:</p>
        <ul className="list-disc ml-5">
          <li><strong>Military (M)</strong> — the only tiles that can produce units. More military = faster army-building.</li>
          <li><strong>Food (F)</strong> — raises your <em>total</em> unit cap. Soft-capped: each food tile is +5 cap up to 50 tiles, then +2.5 each.</li>
          <li><strong>Magic (G)</strong> — multiplies your spell strength when you cast. Same soft-cap shape.</li>
        </ul>
        <p className="text-neutral-600 dark:text-neutral-400">
          A balanced empire usually wants ~30 military, ~30 food, ~30 magic. But specialize if you want — heavy military rushes early, heavy magic dominates spell-heavy castes.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6 text-center text-sm">
        <Counter label="Military" value={counts.military} />
        <Counter label="Food" value={counts.food} />
        <Counter label="Magic" value={counts.magic} />
        <Counter label="Unassigned" value={counts.unassigned} />
      </div>

      <div className="mb-6">
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed space-y-2">
          <p className="font-semibold">Step 3 of 3 — Pick a caste (permanent)</p>
          <p>Each caste tilts your unit and spell strengths. You cannot change later.</p>
          <ul className="list-disc ml-5">
            <li><strong>White</strong> — defense / order. Strong ground units, strongest defense spells. Good for turtling.</li>
            <li><strong>Blue</strong> — control / magic. Strong air units, strongest production spells (food cap boosts). Good for tempo.</li>
            <li><strong>Black</strong> — sacrifice / swarm. Cheap balanced units, strong offense spells. Good for grinding wars.</li>
            <li><strong>Red</strong> — aggression / fire. Strong siege, strongest offense spells. Good for blitzing.</li>
            <li><strong>Green</strong> — growth. +20% tile capacity (so your tiles hold more units), strong ground swarms. Good for fortified expansion.</li>
          </ul>
        </div>

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
          You can keep redistributing tiles after picking a caste — but caste itself is locked permanently.
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
