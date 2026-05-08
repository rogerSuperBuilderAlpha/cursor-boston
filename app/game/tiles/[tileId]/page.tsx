/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { computeSupplyMultiplier } from "@/lib/game/combat";
import { ALL_SPELLS, UPGRADES_BY_ID } from "@/lib/game/content";
import type {
  Caste,
  GamePlayer,
  GameTile,
  IntelReport,
  LandType,
  MapTile,
  TurnReport,
} from "@/lib/game/types";
import {
  loadCachedMap,
  mergeTiles as mergeTilesIntoCache,
} from "@/lib/game/local-map-cache";
import { neighbors as axialNeighbors, tileIdFromAxial } from "@/lib/game/world-gen";
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
  const [intelReport, setIntelReport] = useState<IntelReport | null>(null);
  // Snapshot of border tiles + owner records from the localStorage map cache.
  // Used to compute enemy supply readouts on the tile detail page (the
  // dashboard fetches /api/game/map/me; we read from its cache instead of
  // refetching on every tile-detail load).
  const [borderTiles, setBorderTiles] = useState<MapTile[]>([]);
  const [ownersByUserId, setOwnersByUserId] = useState<
    Map<string, { caste: Caste | null; displayName: string }>
  >(() => new Map());

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
      // Pull cached enemy-border and owner snapshots from the dashboard's
      // localStorage cache. Best-effort: if the cache is missing the relevant
      // tiles, the supply readout simply won't render.
      const cached = loadCachedMap(user.uid);
      if (cached) {
        setBorderTiles(cached.borderTiles);
        setOwnersByUserId(
          new Map(
            cached.owners.map((o) => [
              o.userId,
              { caste: o.caste, displayName: o.displayName },
            ])
          )
        );
      }
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
        // Both /api/game/spy and a Blue/Black-passive attack response can
        // return an intelReport. Surface the most recent one until the next
        // action overwrites it.
        if (data.intelReport) {
          setIntelReport(data.intelReport as IntelReport);
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

  // Hooks must run on every render, before any conditional returns.
  const isOwn = tile?.ownerId === user?.uid;
  const myCaste = player?.caste ?? null;

  // Lookup table covering every map tile we know about — own tiles and the
  // border ring around our kingdom. Used by both supply readouts (own + enemy)
  // and the Crow Network panel.
  const mapById = useMemo(() => {
    const m = new Map<string, MapTile>();
    for (const t of ownedTiles) m.set(t.tileId, t);
    for (const t of borderTiles) m.set(t.tileId, t);
    return m;
  }, [ownedTiles, borderTiles]);

  // Friendly neighbors of `tile` from a given owner's perspective. Filters
  // out unrevealed/unassigned tiles (they don't supply). Returns null when
  // we don't know enough — caller renders nothing.
  function friendlyNeighborsForOwner(
    targetTile: GameTile | MapTile,
    ownerId: string
  ): Array<{ tileId: string; landType: LandType }> {
    const out: Array<{ tileId: string; landType: LandType }> = [];
    for (const n of axialNeighbors(targetTile.q, targetTile.r)) {
      const id = tileIdFromAxial(n.q, n.r);
      const t = mapById.get(id);
      if (!t || t.ownerId !== ownerId) continue;
      if (t.type === "unrevealed" || t.type === "unassigned") continue;
      out.push({ tileId: id, landType: t.type });
    }
    return out;
  }

  const supplyInfo = useMemo(() => {
    if (!tile) return null;
    if (isOwn && myCaste) {
      const friendly = friendlyNeighborsForOwner(tile, user?.uid ?? "");
      const mult = computeSupplyMultiplier(myCaste, friendly);
      return {
        mult,
        friendlyCount: friendly.length,
        scope: "own" as const,
        friendly,
      };
    }
    // Enemy tile path: needs the defender's caste from the cached owner
    // record AND a non-empty cached map. Skip cleanly if either is missing.
    if (!isOwn && tile.ownerId) {
      const ownerCaste = ownersByUserId.get(tile.ownerId)?.caste ?? null;
      if (!ownerCaste) return null;
      // If we have ZERO map data for the enemy tile's neighborhood, skip —
      // an "isolated" calc on no data would mislead the player.
      let known = 0;
      for (const n of axialNeighbors(tile.q, tile.r)) {
        if (mapById.has(tileIdFromAxial(n.q, n.r))) known++;
      }
      if (known === 0) return null;
      const friendly = friendlyNeighborsForOwner(tile, tile.ownerId);
      const mult = computeSupplyMultiplier(ownerCaste, friendly);
      return {
        mult,
        friendlyCount: friendly.length,
        scope: "enemy" as const,
        friendly,
        knownNeighbors: known,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- friendlyNeighborsForOwner is stable per render
  }, [tile, isOwn, myCaste, mapById, ownersByUserId, user?.uid]);

  // Green Crow Network: while the player has Green caste + the
  // green-air-eagle-scout intel upgrade active, AND we're viewing one of
  // their own tiles that has air units stationed, show the supply network
  // breakdown. The base supply readout above is shown for all own tiles;
  // this panel additionally surfaces the per-tile breakdown of contributors.
  const crowNetwork = useMemo(() => {
    if (!tile || !player || !isOwn) return null;
    if (player.caste !== "green") return null;
    if (tile.units.air <= 0) return null;
    const upgrades = player.activeUpgrades ?? {};
    const airUpgradeId = upgrades["green-air-eagle-scout"];
    if (!airUpgradeId) return null;
    const def = UPGRADES_BY_ID.get(airUpgradeId);
    if (def?.intelPassive !== "green-crow-network") return null;
    const friendly = friendlyNeighborsForOwner(tile, user?.uid ?? "");
    return { friendly };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- friendlyNeighborsForOwner is stable per render
  }, [tile, player, isOwn, mapById, user?.uid]);

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
          {supplyInfo && (
            <Stat
              label={
                supplyInfo.scope === "enemy" ? "Supply (est.)" : "Supply"
              }
              value={`×${supplyInfo.mult.toFixed(2)} (${supplyInfo.friendlyCount} friendly${
                supplyInfo.scope === "enemy"
                  ? `, ${supplyInfo.knownNeighbors}/6 visible`
                  : ""
              })`}
            />
          )}
          {tile.isolatedSpawn && (
            <Stat label="Status" value="Isolated spawn" />
          )}
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
            onSpy={(spellId) =>
              callApi("/api/game/spy", {
                spellId,
                targetTileId: tile.tileId,
              })
            }
          />
        )}

        {crowNetwork && (
          <CrowNetworkPanel
            tile={tile}
            friendly={crowNetwork.friendly}
          />
        )}

        {intelReport && (
          <IntelReportPanel
            report={intelReport}
            onDismiss={() => setIntelReport(null)}
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

function IntelReportPanel({
  report,
  onDismiss,
}: {
  report: IntelReport;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-6 rounded-lg border-2 border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-4 space-y-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Intel report
        </h3>
        <button
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Dismiss
        </button>
      </div>
      <p className="text-neutral-700 dark:text-neutral-300">
        <strong>Target {report.targetTileId}</strong> ({report.target.landType}
        ) — units G{report.target.units.ground} / S{report.target.units.siege}{" "}
        / A{report.target.units.air}
        {report.target.armedDefenseSpellId
          ? ` · armed: ${report.target.armedDefenseSpellId}`
          : ""}
      </p>
      {report.weakFace && (
        <p className="text-neutral-700 dark:text-neutral-300">
          Forge Sight: lead with <strong>{report.weakFace}</strong>.
        </p>
      )}
      {report.neighbors && report.neighbors.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Neighbors
          </div>
          <ul className="space-y-1 text-xs font-mono">
            {report.neighbors.map((n) => (
              <li key={n.tileId}>
                {n.tileId} — {n.landType} ·{" "}
                {n.ownerId ? `owner ${n.ownerId.slice(0, 6)}…` : "unclaimed"}{" "}
                · G{n.units.ground} S{n.units.siege} A{n.units.air}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.kingdomDefender && (
        <p className="text-neutral-700 dark:text-neutral-300">
          Kingdom: {report.kingdomDefender.tilesHeld} tiles ·{" "}
          {report.kingdomDefender.unitsAlive} units alive ·{" "}
          {report.kingdomDefender.artifactCount} unused artifacts
          {report.kingdomDefender.activeProductionSpellIds.length > 0
            ? ` · ${report.kingdomDefender.activeProductionSpellIds.length} production spell(s) active`
            : ""}
          .
        </p>
      )}
      {report.supply && (
        <p className="text-neutral-700 dark:text-neutral-300">
          Supply ×{report.supply.supplyMultiplier.toFixed(2)} — backed by{" "}
          {report.supply.friendlyNeighbors.length} friendly tile
          {report.supply.friendlyNeighbors.length === 1 ? "" : "s"}.
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Source: {report.source} · {report.sourceId} · turn{" "}
        {report.capturedAtTurn}
      </p>
    </div>
  );
}

function CrowNetworkPanel({
  tile,
  friendly,
}: {
  tile: GameTile;
  friendly: ReadonlyArray<{ tileId: string; landType: LandType }>;
}) {
  return (
    <div className="mt-6 rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2 text-sm">
      <h3 className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Crow Network — supply graph
      </h3>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        While {tile.units.air} air unit{tile.units.air === 1 ? "" : "s"} roost
        at {tile.tileId}, this tile&apos;s 1-ring supply network is laid bare.
      </p>
      {friendly.length === 0 ? (
        <p className="text-xs text-neutral-500">
          No friendly tiles in the 1-ring — this tile is isolated. Air units
          here are scouting empty sky.
        </p>
      ) : (
        <ul className="space-y-1 text-xs font-mono">
          {friendly.map((n) => (
            <li key={n.tileId}>
              {n.tileId} — {n.landType}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
