/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ALL_SPELLS,
  getCasteProfile,
} from "@/lib/game/content";
import type {
  GamePlayer,
  GameTile,
  SpellDefinition,
  TurnReport,
  UnitStack,
  UnitType,
} from "@/lib/game/types";

interface TileResponse {
  success: boolean;
  tile?: GameTile;
  error?: { message: string } | string;
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: GameTile[];
  error?: string;
}

const UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];

export default function TileDetailPage({
  params,
}: {
  params: Promise<{ tileId: string }>;
}) {
  const { tileId: rawTileId } = use(params);
  const tileId = decodeURIComponent(rawTileId);
  const { user, loading: authLoading } = useAuth();
  const [tile, setTile] = useState<GameTile | null>(null);
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [ownedTiles, setOwnedTiles] = useState<GameTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const [tileRes, playerRes] = await Promise.all([
        fetch(`/api/game/tile/${encodeURIComponent(tileId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const tileData = (await tileRes.json()) as TileResponse;
      const playerData = (await playerRes.json()) as PlayerResponse;
      if (!tileData.success) {
        const msg =
          typeof tileData.error === "string"
            ? tileData.error
            : tileData.error?.message || "Failed to load tile";
        throw new Error(msg);
      }
      setTile(tileData.tile ?? null);
      setPlayer(playerData.player);
      setOwnedTiles(playerData.tiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, tileId]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh();
  }, [authLoading, refresh]);

  const callApi = useCallback(
    async (path: string, body: unknown) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      setMessage(null);
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
          throw new Error(data.error?.message ?? data.error ?? "Action failed");
        }
        await refresh();
        // Pull TurnReport(s) off the response and push them on top of the
        // recent-reports stack. Both single-report (`report`) and batch
        // (`reports`) shapes are accepted.
        const fromBatch: TurnReport[] = Array.isArray(data.reports)
          ? data.reports
          : [];
        const single: TurnReport | null = data.report ?? null;
        const newOnes = fromBatch.length > 0 ? fromBatch : single ? [single] : [];
        if (newOnes.length > 0) {
          setRecentReports((prev) =>
            [...newOnes.slice().reverse(), ...prev].slice(0, 25)
          );
        }
        setMessage(data.stoppedEarly ? `Stopped: ${data.stoppedEarly}` : "Done.");
        return data;
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
  if (!user || !player || !tile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 flex-col gap-4">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <Link href="/game/tiles" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Back to tiles
        </Link>
      </div>
    );
  }

  const isOwn = tile.ownerId === user.uid;
  const myCaste = player.caste;
  const myDefenseSpells = myCaste
    ? ALL_SPELLS.filter((s) => s.caste === myCaste && s.type === "defense")
    : [];

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold font-mono">{tile.tileId}</h1>
          <Link
            href="/game/tiles"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← All tiles
          </Link>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Stat label="Owner" value={isOwn ? "You" : tile.ownerId ? "Enemy" : "Unclaimed"} />
          <Stat label="Type" value={tile.type} />
          <Stat label="Ground" value={String(tile.units.ground)} />
          <Stat label="Siege" value={String(tile.units.siege)} />
          <Stat label="Air" value={String(tile.units.air)} />
          <Stat
            label="Armed defense"
            value={tile.armedDefenseSpellId ?? "—"}
          />
        </div>

        {isOwn ? (
          <OwnTilePanel
            tile={tile}
            player={player}
            myDefenseSpells={myDefenseSpells}
            busy={busy}
            onBuild={(unitType) =>
              callApi("/api/game/build", { tileId: tile.tileId, unitType })
            }
            onArmSpell={(spellId) =>
              callApi("/api/game/spell/arm", { tileId: tile.tileId, spellId })
            }
          />
        ) : (
          <EnemyTilePanel
            tile={tile}
            player={player}
            ownedTiles={ownedTiles}
            busy={busy}
            onAttack={(sourceTileId, units, offenseSpellId) =>
              callApi("/api/game/attack", {
                sourceTileId,
                targetTileId: tile.tileId,
                units,
                offenseSpellId,
              })
            }
          />
        )}

        <ReportLog reports={recentReports} />
      </div>
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
  if (reports.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Field reports
      </h3>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-96 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
        {reports.map((r, idx) => (
          <div key={`${r.action}-${r.turnIndex}-${idx}`} className="px-4 py-3 text-sm leading-relaxed">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-base font-semibold capitalize break-words">
        {value}
      </div>
    </div>
  );
}

function OwnTilePanel({
  tile,
  player,
  myDefenseSpells,
  busy,
  onBuild,
  onArmSpell,
}: {
  tile: GameTile;
  player: GamePlayer;
  myDefenseSpells: SpellDefinition[];
  busy: boolean;
  onBuild: (unitType: UnitType) => void;
  onArmSpell: (spellId: string) => void;
}) {
  const canBuild =
    player.phase === "play" &&
    tile.type === "military" &&
    player.turnsRemaining >= 5;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-3">Build units</h2>
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-3 mb-3 text-sm leading-relaxed space-y-1">
          <p>
            Each click spends 5 turns and produces 10 units of the chosen type
            on this tile. Your <strong>total</strong> unit cap is the sum of
            food-tile contributions plus any active production spells. If
            you&apos;re at the cap, build will return an error.
          </p>
          <p className="text-xs text-neutral-500">
            <strong>Unit RPS:</strong> Air beats Ground, Ground beats Siege,
            Siege beats Air. Build a mix or specialize based on what your
            opponents tend to field.
          </p>
        </div>
        {tile.type !== "military" ? (
          <p className="text-sm text-neutral-500">
            Only military tiles can build units. This tile is{" "}
            <strong className="capitalize">{tile.type}</strong>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {UNIT_TYPES.map((u) => (
              <button
                key={u}
                onClick={() => onBuild(u)}
                disabled={busy || !canBuild}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors capitalize disabled:opacity-50"
              >
                +10 {u} (5 turns)
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Arm a defense spell</h2>
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-3 mb-3 text-sm leading-relaxed">
          <p>
            Pre-arming a defense spell costs 5 turns. The spell sits dormant on
            this tile and triggers <em>automatically</em> the next time the tile
            is attacked, then is consumed. Spell strength scales with your
            magic-tile count. Tiles you expect to be attacked are good
            candidates.
          </p>
        </div>
        {tile.type === "unrevealed" ? (
          <p className="text-sm text-neutral-500">Reveal this tile first.</p>
        ) : myDefenseSpells.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Choose a caste to unlock defense spells.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myDefenseSpells.map((s) => (
              <button
                key={s.id}
                onClick={() => onArmSpell(s.id)}
                disabled={
                  busy ||
                  player.phase !== "play" ||
                  player.turnsRemaining < 5 ||
                  tile.armedDefenseSpellId === s.id
                }
                className="px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                title={s.description}
              >
                {s.name} (5 turns)
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EnemyTilePanel({
  tile,
  player,
  ownedTiles,
  busy,
  onAttack,
}: {
  tile: GameTile;
  player: GamePlayer;
  ownedTiles: GameTile[];
  busy: boolean;
  onAttack: (
    sourceTileId: string,
    units: UnitStack,
    offenseSpellId: string | null
  ) => void;
}) {
  const myBorders = ownedTiles.filter((t) =>
    t.neighborTileIds.includes(tile.tileId)
  );
  const myCaste = player.caste;
  const offenseSpells = myCaste
    ? ALL_SPELLS.filter((s) => s.caste === myCaste && s.type === "offense")
    : [];

  const [sourceTileId, setSourceTileId] = useState(myBorders[0]?.tileId ?? "");
  const [ground, setGround] = useState(0);
  const [siege, setSiege] = useState(0);
  const [air, setAir] = useState(0);
  const [offenseSpellId, setOffenseSpellId] = useState<string>("");

  const source = myBorders.find((t) => t.tileId === sourceTileId) ?? null;
  const sentTotal = ground + siege + air;
  const sourceTotal = source
    ? source.units.ground + source.units.siege + source.units.air
    : 0;

  const profile = player.caste ? getCasteProfile(player.caste) : null;
  const canAttack =
    !!source &&
    sentTotal > 0 &&
    sentTotal <= sourceTotal &&
    ground <= (source?.units.ground ?? 0) &&
    siege <= (source?.units.siege ?? 0) &&
    air <= (source?.units.air ?? 0) &&
    player.phase === "play" &&
    player.turnsRemaining >= 1 + (offenseSpellId ? 5 : 0);

  if (myBorders.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-sm text-neutral-500">
        None of your tiles border this enemy tile, so you can&apos;t attack it.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Launch attack</h2>
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-3 text-sm leading-relaxed space-y-1">
        <p>
          Pick a source tile that borders this enemy, choose how many ground /
          siege / air units to send, optionally attach an offense spell.
          Resolution is instant.
        </p>
        <p>
          <strong>Composition matters most.</strong> Air beats Ground, Ground
          beats Siege, Siege beats Air; the advantaged type does +50% damage
          and takes 25% less. So if the defender is heavy siege, send air. If
          they&apos;re heavy air, send ground. Mirror-matching is usually a bad
          trade.
        </p>
        <p>
          <strong>Capacity caps your force.</strong> A tile holds at most a
          fixed number of units (base 500 + adjustments). You can only send up
          to <em>(target capacity − defender units already there)</em>. Stuffed
          tiles are unattackable.
        </p>
        <p>
          <strong>If you win,</strong> the tile becomes yours and your
          surviving attackers garrison it. <strong>If you lose or stalemate,</strong>{" "}
          your survivors return to the source.
        </p>
      </div>
      {profile && (
        <p className="text-xs text-neutral-500">
          You are <strong className="capitalize">{player.caste}</strong>. Your caste tilts unit and spell strengths.
        </p>
      )}

      <label className="block text-sm font-medium">
        Source tile
        <select
          value={sourceTileId}
          onChange={(e) => setSourceTileId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          {myBorders.map((t) => (
            <option key={t.tileId} value={t.tileId}>
              {t.tileId} — G{t.units.ground} S{t.units.siege} A{t.units.air}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-3">
        <UnitInput
          label={`Ground / ${source?.units.ground ?? 0}`}
          value={ground}
          max={source?.units.ground ?? 0}
          onChange={setGround}
        />
        <UnitInput
          label={`Siege / ${source?.units.siege ?? 0}`}
          value={siege}
          max={source?.units.siege ?? 0}
          onChange={setSiege}
        />
        <UnitInput
          label={`Air / ${source?.units.air ?? 0}`}
          value={air}
          max={source?.units.air ?? 0}
          onChange={setAir}
        />
      </div>

      <label className="block text-sm font-medium">
        Offense spell (optional, +5 turns)
        <select
          value={offenseSpellId}
          onChange={(e) => setOffenseSpellId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          <option value="">— none —</option>
          {offenseSpells.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() =>
          onAttack(
            sourceTileId,
            { ground, siege, air },
            offenseSpellId || null
          )
        }
        disabled={busy || !canAttack}
        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
      >
        {busy ? "Resolving…" : `Send ${sentTotal} units (cost ${1 + (offenseSpellId ? 5 : 0)} turns)`}
      </button>
    </div>
  );
}

function UnitInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
        className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
      />
    </label>
  );
}
