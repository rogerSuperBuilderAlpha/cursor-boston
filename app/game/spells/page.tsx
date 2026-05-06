/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_SPELLS, SPELLS_BY_ID } from "@/lib/game/content";
import type {
  GamePlayer,
  MapTile,
  SpellDefinition,
  TurnReport,
} from "@/lib/game/types";

interface PlayerResponseError {
  message?: string;
  code?: string;
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: PlayerResponseError | string;
}

const SPELL_TURN_COST = 5;

export default function SpellsPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);
  const [armTargetTileId, setArmTargetTileId] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load";
        throw new Error(msg);
      }
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
        await refresh();
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      }
    },
    [user, refresh]
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

  const armDefense = useCallback(
    async (spellId: string) => {
      if (!armTargetTileId) {
        setError("Pick a tile to arm the spell on first.");
        return;
      }
      setBusyId(spellId);
      try {
        await callApi("/api/game/spell/arm", {
          spellId,
          tileId: armTargetTileId,
        });
      } finally {
        setBusyId(null);
      }
    },
    [callApi, armTargetTileId]
  );

  const casteSpells: SpellDefinition[] = player?.caste
    ? ALL_SPELLS.filter((s) => s.caste === player.caste)
    : [];

  const armableTiles = tiles.filter(
    (t) => t.type !== "unrevealed" && t.ownerId === player?.userId
  );

  const armedTiles = tiles.filter((t) => t.armedDefenseSpellId);

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
          Sign in
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

  if (!player.caste) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Choose a caste before you can browse your spell book — each caste
            has its own three spells.
          </p>
          <Link href="/game/setup" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
            Continue setup →
          </Link>
        </div>
      </div>
    );
  }

  const canSpend = player.turnsRemaining >= SPELL_TURN_COST;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold capitalize">
            {player.caste} spell book
          </h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p className="mb-2">
            Each caste has three spells, one per type:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              <strong>Defense</strong> — pre-armed on a specific tile, persists
              until consumed by an attacker.
            </li>
            <li>
              <strong>Offense</strong> — attached at attack time from a tile&apos;s
              attack form (not cast here).
            </li>
            <li>
              <strong>Production</strong> — cast globally; affects your unit cap
              or magic multiplier for the next 100 turns.
            </li>
          </ul>
          <p className="mt-2">
            Casts and arms each cost <strong>{SPELL_TURN_COST} turns</strong>.
            Strength is multiplied at runtime by your magic-land soft-cap and
            your caste&apos;s spell-type bonus.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="text-sm text-neutral-500 mb-6">
          Turns remaining: <strong>{player.turnsRemaining}</strong>
        </div>

        <h2 className="text-lg font-semibold mb-3">Your spells</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {casteSpells.map((s) => (
            <SpellCard
              key={s.id}
              spell={s}
              busy={busyId !== null}
              busyForThis={busyId === s.id}
              canSpend={canSpend}
              armTargetTileId={armTargetTileId}
              setArmTargetTileId={setArmTargetTileId}
              armableTiles={armableTiles}
              onCastProduction={() => castProduction(s.id)}
              onArmDefense={() => armDefense(s.id)}
            />
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3">Active production spells</h2>
        {(player.productionSpellsActive ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500 italic mb-8">
            No production spells active. Cast one above to boost your unit cap
            or magic multiplier for 100 turns.
          </p>
        ) : (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg mb-8 divide-y divide-neutral-200 dark:divide-neutral-800">
            {(player.productionSpellsActive ?? []).map((p) => {
              const def = SPELLS_BY_ID.get(p.spellId);
              return (
                <div
                  key={p.spellId + p.expiresAtTurn}
                  className="px-4 py-3 flex items-center justify-between text-sm"
                >
                  <span className="font-medium">
                    {def?.name ?? p.spellId}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Expires at turn {p.expiresAtTurn}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3">Tiles with defense armed</h2>
        {armedTiles.length === 0 ? (
          <p className="text-sm text-neutral-500 italic mb-8">
            No tiles armed yet. Pick one from your tiles list and arm a defense
            spell on it.
          </p>
        ) : (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg mb-8 divide-y divide-neutral-200 dark:divide-neutral-800">
            {armedTiles.map((t) => {
              const def = t.armedDefenseSpellId
                ? SPELLS_BY_ID.get(t.armedDefenseSpellId)
                : null;
              return (
                <Link
                  key={t.tileId}
                  href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span className="font-mono">{t.tileId}</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {def?.name ?? t.armedDefenseSpellId}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {recentReports.length > 0 && (
          <ReportLog reports={recentReports} />
        )}
      </div>
    </div>
  );
}

function SpellCard({
  spell,
  busy,
  busyForThis,
  canSpend,
  armTargetTileId,
  setArmTargetTileId,
  armableTiles,
  onCastProduction,
  onArmDefense,
}: {
  spell: SpellDefinition;
  busy: boolean;
  busyForThis: boolean;
  canSpend: boolean;
  armTargetTileId: string;
  setArmTargetTileId: (id: string) => void;
  armableTiles: MapTile[];
  onCastProduction: () => void;
  onArmDefense: () => void;
}) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold">{spell.name}</h3>
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          {spell.type}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
        {spell.description}
      </p>
      <div className="text-xs text-neutral-500 mb-3">
        Base strength <strong>{spell.baseStrength}</strong>
      </div>

      {spell.type === "production" && (
        <button
          onClick={onCastProduction}
          disabled={busy || !canSpend}
          className="mt-auto w-full px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busyForThis
            ? "Casting…"
            : canSpend
              ? `Cast (${SPELL_TURN_COST} turns)`
              : "Not enough turns"}
        </button>
      )}

      {spell.type === "defense" && (
        <div className="mt-auto space-y-2">
          <select
            value={armTargetTileId}
            onChange={(e) => setArmTargetTileId(e.target.value)}
            disabled={busy}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          >
            <option value="">Pick a tile to arm…</option>
            {armableTiles.map((t) => (
              <option key={t.tileId} value={t.tileId}>
                {t.tileId} ({t.type})
              </option>
            ))}
          </select>
          <button
            onClick={onArmDefense}
            disabled={busy || !canSpend || !armTargetTileId}
            className="w-full px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busyForThis
              ? "Arming…"
              : canSpend
                ? `Arm (${SPELL_TURN_COST} turns)`
                : "Not enough turns"}
          </button>
        </div>
      )}

      {spell.type === "offense" && (
        <p className="mt-auto text-xs text-neutral-500 italic leading-relaxed">
          Attached at attack time from a tile&apos;s attack form. Open an enemy
          tile from{" "}
          <Link
            href="/game/tiles"
            className="underline hover:no-underline"
          >
            Manage tiles
          </Link>{" "}
          and pick this spell in the attack panel.
        </p>
      )}
    </div>
  );
}

const RARITY_TEXT: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};

function ReportLog({ reports }: { reports: TurnReport[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Field reports
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
                  RARITY_TEXT[r.artifactFound.rarity] ?? ""
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
