/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_SPELLS } from "@/lib/game/content";
import type {
  GamePlayer,
  GameTile,
  MapTile,
  TurnReport,
} from "@/lib/game/types";
import { mergeTiles as mergeTilesIntoCache } from "@/lib/game/local-map-cache";
import {
  EnemyTilePanel,
  OwnTilePanel,
  Stat,
} from "../_components/tile-action-panels";

interface TileResponse {
  success: boolean;
  tile?: GameTile;
  error?: { message: string } | string;
}

function asMapTile(t: GameTile): MapTile {
  return {
    tileId: t.tileId,
    q: t.q,
    r: t.r,
    type: t.type,
    ownerId: t.ownerId ?? null,
    units: t.units,
    armedDefenseSpellId: t.armedDefenseSpellId ?? null,
  };
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: string;
}

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
  const [ownedTiles, setOwnedTiles] = useState<MapTile[]>([]);
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
        // Merge action response into local state instead of refetching
        // /api/game/player + /api/game/tile. Single-tile actions never need
        // a full reload: the server returns the updated player + tile (and
        // for attack: the targetTile).
        if (data.player) setPlayer(data.player as GamePlayer);
        // Attack returns attackerPlayer/defenderPlayer instead of player.
        if (data.attackerPlayer)
          setPlayer(data.attackerPlayer as GamePlayer);
        const tilesToCache: MapTile[] = [];
        if (data.tile) {
          const t = data.tile as GameTile;
          setTile(t);
          // Also patch the owned-tiles mini-list if this tile is in it.
          setOwnedTiles((prev) => {
            const idx = prev.findIndex((p) => p.tileId === t.tileId);
            if (idx === -1) return prev;
            const next = prev.slice();
            next[idx] = {
              ...next[idx],
              type: t.type,
              ownerId: t.ownerId ?? null,
              units: t.units,
              armedDefenseSpellId: t.armedDefenseSpellId ?? null,
            };
            return next;
          });
          tilesToCache.push(asMapTile(t));
        }
        if (data.targetTile) {
          const t = data.targetTile as GameTile;
          setTile(t);
          tilesToCache.push(asMapTile(t));
        }
        // Push tile updates into the localStorage map cache so the world
        // map + threat displays on other pages reflect this action without
        // a manual refresh.
        if (tilesToCache.length > 0 && user) {
          mergeTilesIntoCache(user.uid, tilesToCache);
        }
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
    [user]
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
            onAssign={(targetType) =>
              callApi("/api/game/setup/distribute", {
                tileId: tile.tileId,
                type: targetType,
              })
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
