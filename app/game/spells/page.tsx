/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_SPELLS, SPELLS_BY_ID } from "@/lib/game/content";
import {
  computeTileThreat,
  rankTileIdsByThreat,
  type ThreatOwnerInfo,
} from "@/lib/game/threat";
import type {
  Caste,
  GamePlayer,
  MapTile,
  SpellDefinition,
  SpellType,
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
  error?: PlayerResponseError | string;
}

// 5 tiers, in display order. Min-tiles & turn-cost come from each spell's own
// fields — this list is only used to render the row scaffolding so locked
// tiers still appear with their requirement.
const TIERS: Array<{ tier: 1 | 2 | 3 | 4 | 5; minTiles: number }> = [
  { tier: 1, minTiles: 0 },
  { tier: 2, minTiles: 500 },
  { tier: 3, minTiles: 1500 },
  { tier: 4, minTiles: 5000 },
  { tier: 5, minTiles: 20000 },
];

// Column order in the tier × type table. Defense first because that's the
// only column with bulk-arm UX, and reading "what should I cast right now"
// usually starts with "what's keeping me alive".
const TYPE_COLUMNS: SpellType[] = ["defense", "offense", "production"];

const TYPE_LABEL: Record<SpellType, string> = {
  defense: "Defense",
  offense: "Offense",
  production: "Production",
};

export default function SpellsPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [worldTiles, setWorldTiles] = useState<MapTile[]>([]);
  const [owners, setOwners] = useState<Map<string, OwnerSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);
  // Defense-spell single-arm picker (legacy flow, preserved as the "arm one"
  // shortcut alongside the new bulk panel).
  const [armTargetTileId, setArmTargetTileId] = useState<string>("");
  // Which defense spell, if any, has its bulk-arm panel open.
  const [bulkSpellId, setBulkSpellId] = useState<string | null>(null);
  const [bulkN, setBulkN] = useState<number>(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const [playerRes, worldRes] = await Promise.all([
        fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/world", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = (await playerRes.json()) as PlayerResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load";
        throw new Error(msg);
      }
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
      const worldData = (await worldRes.json()) as WorldResponse;
      if (worldData.success) {
        setWorldTiles(worldData.tiles ?? []);
        const map = new Map<string, OwnerSummary>();
        for (const o of worldData.owners ?? []) map.set(o.userId, o);
        setOwners(map);
      }
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
        if (Array.isArray(data.reports)) {
          setRecentReports((prev) =>
            [...(data.reports as TurnReport[]), ...prev].slice(0, 25)
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

  const armDefenseSingle = useCallback(
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

  const armDefenseBulk = useCallback(
    async (spellId: string, tileIds: string[]) => {
      if (tileIds.length === 0) return;
      setBusyId(spellId);
      try {
        const data = await callApi("/api/game/spell/arm", {
          spellId,
          tileIds,
        });
        if (data && Array.isArray(data.failed) && data.failed.length > 0) {
          // Surface partial failure prominently — the user just spent turns
          // and only some landed.
          const sample = data.failed
            .slice(0, 3)
            .map((f: { tileId: string; reason: string }) => `${f.tileId}: ${f.reason}`)
            .join("; ");
          setError(
            `Armed ${data.armed ?? 0} of ${tileIds.length}; ${data.failed.length} failed (${sample}${data.failed.length > 3 ? "…" : ""})`
          );
        }
        setBulkSpellId(null);
      } finally {
        setBusyId(null);
      }
    },
    [callApi]
  );

  // Build a (tier, type) → spell lookup so the table cells can pull their
  // spell in O(1). React Compiler memoizes this for us.
  const spellByTierAndType = (() => {
    const map = new Map<string, SpellDefinition>();
    if (!player?.caste) return map;
    for (const s of ALL_SPELLS) {
      if (s.caste !== player.caste) continue;
      map.set(`${s.tier}|${s.type}`, s);
    }
    return map;
  })();

  // Tiles eligible to receive a defense spell: owned, revealed, not already
  // armed. Sorted by per-tile threat for the bulk panel.
  const armableUnarmedTiles = useMemo(
    () =>
      tiles.filter(
        (t) =>
          t.type !== "unrevealed" &&
          t.ownerId === player?.userId &&
          !t.armedDefenseSpellId
      ),
    [tiles, player?.userId]
  );

  // Including armed tiles too — used by the legacy single-arm picker so
  // re-arming is still possible if the user wants to swap spells on a tile.
  const armableTiles = useMemo(
    () =>
      tiles.filter(
        (t) => t.type !== "unrevealed" && t.ownerId === player?.userId
      ),
    [tiles, player?.userId]
  );

  const armedTiles = tiles.filter((t) => t.armedDefenseSpellId);

  // Per-tile threat score, used to sort the bulk-arm preview.
  const threatRanked = useMemo(() => {
    if (!player) return [] as string[];
    const ownerInfo = new Map<string, ThreatOwnerInfo>();
    for (const [uid, o] of owners) ownerInfo.set(uid, { shielded: o.shielded });
    const threat = computeTileThreat({
      myTiles: armableUnarmedTiles,
      worldTiles,
      owners: ownerInfo,
      myUserId: player.userId,
    });
    return rankTileIdsByThreat(
      armableUnarmedTiles.map((t) => t.tileId),
      threat
    );
  }, [armableUnarmedTiles, worldTiles, owners, player]);

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

  const tilesHeld = player.stats?.tilesHeld ?? 0;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
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
          <p className="mb-1">
            Five tiers × three spell types. Higher tiers unlock as your
            territory grows. You currently hold{" "}
            <strong className="font-mono">{tilesHeld}</strong> tiles · turns
            remaining: <strong>{player.turnsRemaining}</strong>.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Tier × type spell book table */}
        <div className="space-y-6 mb-10">
          {TIERS.map(({ tier, minTiles }) => {
            const tierUnlocked = tilesHeld >= minTiles;
            return (
              <section
                key={tier}
                className={`border rounded-xl overflow-hidden ${
                  tierUnlocked
                    ? "border-neutral-200 dark:border-neutral-800"
                    : "border-neutral-200 dark:border-neutral-800 opacity-60"
                }`}
              >
                <header className="flex items-baseline justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="text-sm font-semibold uppercase tracking-wide">
                    Tier {tier}
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {tierUnlocked
                      ? `unlocked at ${minTiles.toLocaleString()} tiles`
                      : `locked — needs ${minTiles.toLocaleString()} tiles`}
                  </span>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800">
                  {TYPE_COLUMNS.map((col) => {
                    const spell = spellByTierAndType.get(`${tier}|${col}`);
                    return (
                      <SpellCell
                        key={col}
                        column={col}
                        spell={spell}
                        player={player}
                        tilesHeld={tilesHeld}
                        busy={busyId !== null}
                        busyForThis={
                          spell ? busyId === spell.id : false
                        }
                        armTargetTileId={armTargetTileId}
                        setArmTargetTileId={setArmTargetTileId}
                        armableTiles={armableTiles}
                        bulkSpellId={bulkSpellId}
                        setBulkSpellId={setBulkSpellId}
                        bulkN={bulkN}
                        setBulkN={setBulkN}
                        threatRanked={threatRanked}
                        armableUnarmedTiles={armableUnarmedTiles}
                        onCastProduction={castProduction}
                        onArmDefenseSingle={armDefenseSingle}
                        onArmDefenseBulk={armDefenseBulk}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
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
            No tiles armed yet. Use the bulk-arm panel on a defense spell — it
            sorts your tiles by threat (bordering enemies first).
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

        {recentReports.length > 0 && <ReportLog reports={recentReports} />}
      </div>
    </div>
  );
}

function SpellCell({
  column,
  spell,
  player,
  tilesHeld,
  busy,
  busyForThis,
  armTargetTileId,
  setArmTargetTileId,
  armableTiles,
  bulkSpellId,
  setBulkSpellId,
  bulkN,
  setBulkN,
  threatRanked,
  armableUnarmedTiles,
  onCastProduction,
  onArmDefenseSingle,
  onArmDefenseBulk,
}: {
  column: SpellType;
  spell: SpellDefinition | undefined;
  player: GamePlayer;
  tilesHeld: number;
  busy: boolean;
  busyForThis: boolean;
  armTargetTileId: string;
  setArmTargetTileId: (id: string) => void;
  armableTiles: MapTile[];
  bulkSpellId: string | null;
  setBulkSpellId: (id: string | null) => void;
  bulkN: number;
  setBulkN: (n: number) => void;
  threatRanked: string[];
  armableUnarmedTiles: MapTile[];
  onCastProduction: (spellId: string) => void;
  onArmDefenseSingle: (spellId: string) => void;
  onArmDefenseBulk: (spellId: string, tileIds: string[]) => void;
}) {
  if (!spell) {
    return (
      <div className="p-4 text-xs text-neutral-400 italic">
        {TYPE_LABEL[column]} — no spell at this tier for your caste.
      </div>
    );
  }

  const unlocked = tilesHeld >= spell.minTilesRequired;
  const affordable = player.turnsRemaining >= spell.turnCost;
  const canAct = unlocked && affordable;
  const buttonLabel = !unlocked
    ? `Locked`
    : !affordable
      ? "Out of turns"
      : "";

  // Bulk-arm bookkeeping for the defense column.
  const bulkOpen = bulkSpellId === spell.id;
  const maxByTurns = Math.floor(player.turnsRemaining / Math.max(1, spell.turnCost));
  const maxByTiles = armableUnarmedTiles.length;
  const cap = Math.max(0, Math.min(maxByTurns, maxByTiles));
  const effectiveN = Math.max(0, Math.min(bulkN, cap));
  const previewTileIds = threatRanked.slice(0, effectiveN);

  return (
    <div className="p-4 flex flex-col gap-3 min-h-[8rem]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-sm">{spell.name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
          {TYPE_LABEL[column]}
        </span>
      </div>
      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed flex-1">
        {spell.description}
      </p>
      <div className="text-[11px] text-neutral-500">
        Strength <strong>{spell.baseStrength}</strong> · cost{" "}
        <strong>{spell.turnCost}t</strong>
      </div>

      {column === "production" && (
        <button
          onClick={() => onCastProduction(spell.id)}
          disabled={busy || !canAct}
          className="w-full px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busyForThis
            ? "Casting…"
            : canAct
              ? `Cast (${spell.turnCost}t)`
              : buttonLabel || "Cast"}
        </button>
      )}

      {column === "defense" && !bulkOpen && (
        <div className="space-y-2">
          <button
            onClick={() => {
              // Default N: as many as the player can afford and has unarmed
              // tiles to receive — typical "arm everything I can" intent.
              setBulkSpellId(spell.id);
              setBulkN(cap);
            }}
            disabled={busy || !canAct || cap === 0}
            className="w-full px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {!canAct
              ? buttonLabel || "Bulk-arm"
              : cap === 0
                ? "All tiles already armed"
                : `Bulk-arm top tiles (max ${cap})`}
          </button>
          <details className="text-[11px]">
            <summary className="cursor-pointer text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
              Or arm one tile manually…
            </summary>
            <div className="mt-2 space-y-2">
              <select
                value={armTargetTileId}
                onChange={(e) => setArmTargetTileId(e.target.value)}
                disabled={busy || !unlocked}
                className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
              >
                <option value="">Pick a tile…</option>
                {armableTiles.map((t) => (
                  <option key={t.tileId} value={t.tileId}>
                    {t.tileId} ({t.type})
                    {t.armedDefenseSpellId ? " · armed" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onArmDefenseSingle(spell.id)}
                disabled={busy || !canAct || !armTargetTileId}
                className="w-full px-3 py-1 text-xs border border-emerald-500 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Arm one
              </button>
            </div>
          </details>
        </div>
      )}

      {column === "defense" && bulkOpen && (
        <div className="rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`bulk-n-${spell.id}`}
              className="text-[11px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
            >
              Arm on top
            </label>
            <input
              id={`bulk-n-${spell.id}`}
              type="number"
              min={1}
              max={cap}
              value={effectiveN}
              onChange={(e) => setBulkN(Number(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
            />
            <span className="text-[11px] text-neutral-500">/ {cap} tiles</span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-snug">
            Sorted by threat: tiles bordering an unshielded enemy first, then
            by hex distance to the nearest enemy. Cost:{" "}
            <strong>{effectiveN * spell.turnCost}t</strong>.
          </p>
          <div className="text-[11px] max-h-28 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-950 px-2 py-1 font-mono">
            {previewTileIds.length === 0 ? (
              <p className="italic text-neutral-400">
                No tiles in range — adjust N or close.
              </p>
            ) : (
              previewTileIds.map((id) => <div key={id}>{id}</div>)
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onArmDefenseBulk(spell.id, previewTileIds)}
              disabled={busy || effectiveN === 0}
              className="flex-1 px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busyForThis ? "Arming…" : `Arm ${effectiveN}`}
            </button>
            <button
              onClick={() => setBulkSpellId(null)}
              disabled={busy}
              className="px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {column === "offense" && (
        <p className="text-[11px] text-neutral-500 italic leading-relaxed">
          Attached at attack time. Open an enemy tile from{" "}
          <Link href="/game/tiles" className="underline hover:no-underline">
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
