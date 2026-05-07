/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_SPELLS } from "@/lib/game/content";
import type { GamePlayer, GameTile, MapTile } from "@/lib/game/types";
import {
  EnemyTilePanel,
  OwnTilePanel,
  Stat,
} from "./tile-action-panels";

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

interface TileActionsModalProps {
  tile: MapTile;
  player: GamePlayer;
  ownedTiles: MapTile[];
  ownerName?: string | null;
  onClose: () => void;
  onTileUpdate: (t: MapTile) => void;
  onPlayerUpdate: (p: GamePlayer) => void;
}

/**
 * Inline tile-actions modal opened from the world map. Same actions as the
 * /game/tiles/[tileId] page (recruit, reassign, arm spell, attack), but
 * without unmounting the map. Action responses are pushed up to the parent
 * via `onTileUpdate` / `onPlayerUpdate`, which feed into the localStorage
 * map cache so the world map reflects mutations immediately.
 */
export function TileActionsModal({
  tile,
  player,
  ownedTiles,
  ownerName,
  onClose,
  onTileUpdate,
  onPlayerUpdate,
}: TileActionsModalProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        if (data.player) onPlayerUpdate(data.player as GamePlayer);
        if (data.attackerPlayer)
          onPlayerUpdate(data.attackerPlayer as GamePlayer);
        if (data.tile) onTileUpdate(asMapTile(data.tile as GameTile));
        if (data.targetTile)
          onTileUpdate(asMapTile(data.targetTile as GameTile));
        setMessage(
          data.stoppedEarly ? `Stopped: ${data.stoppedEarly}` : "Done."
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setBusy(false);
      }
    },
    [user, onPlayerUpdate, onTileUpdate]
  );

  // Esc to close. Standard modal contract — outside listeners on document
  // since the dialog isn't always focused on open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOwn = tile.ownerId === player.userId;
  const myCaste = player.caste;
  const myDefenseSpells = myCaste
    ? ALL_SPELLS.filter((s) => s.caste === myCaste && s.type === "defense")
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold font-mono">{tile.tileId}</h2>
            <p className="text-sm text-neutral-500 capitalize">
              {isOwn
                ? "Your tile"
                : tile.ownerId
                  ? ownerName
                    ? `Held by ${ownerName}`
                    : "Foreign tile"
                  : "Unclaimed"}{" "}
              — {tile.type}
              {tile.armedDefenseSpellId && (
                <span className="text-blue-600 dark:text-blue-400">
                  {" · "}armed: {tile.armedDefenseSpellId}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 text-3xl leading-none -mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-5">
          <Stat label="Ground" value={String(tile.units.ground)} />
          <Stat label="Siege" value={String(tile.units.siege)} />
          <Stat label="Air" value={String(tile.units.air)} />
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

        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {isOwn && (
            <Link
              href="/game/upgrades"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Manage caste upgrades →
            </Link>
          )}
          <Link
            href={`/game/tiles/${encodeURIComponent(tile.tileId)}`}
            className="text-neutral-600 dark:text-neutral-400 hover:underline"
          >
            Open full tile page →
          </Link>
        </div>
      </div>
    </div>
  );
}
