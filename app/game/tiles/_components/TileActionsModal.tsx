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
import { STAMINA_CONVERSION_THRESHOLD } from "@/lib/game/content/heroes";
import type {
  GameHero,
  GamePlayer,
  GameTile,
  HeroBattleAction,
  MapTile,
} from "@/lib/game/types";
import {
  EnemyTilePanel,
  OwnTilePanel,
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
    ...(t.hero ? { hero: t.hero } : {}),
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
  // Hero kill/spare/convert chooser state. Only meaningful when the target
  // tile has a hero and the player is attacking (foreign tile path).
  const [heroAction, setHeroAction] = useState<HeroBattleAction>("kill");
  const [heroActionOnConvertFail, setHeroActionOnConvertFail] = useState<
    "kill" | "spare"
  >("kill");

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-lg font-bold font-mono">{tile.tileId}</h2>
            <span className="text-sm text-neutral-500 capitalize">
              {isOwn
                ? "yours"
                : tile.ownerId
                  ? ownerName
                    ? `held by ${ownerName}`
                    : "foreign"
                  : "unclaimed"}
              {" · "}
              {tile.type}
            </span>
            <span className="text-sm font-mono">
              G{tile.units.ground} S{tile.units.siege} A{tile.units.air}
            </span>
            {tile.armedDefenseSpellId && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                ⛨ {tile.armedDefenseSpellId}
              </span>
            )}
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
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && message !== "Done." && (
          <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

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
          <>
            {tile.hero && (
              <HeroOnTileCard
                hero={tile.hero}
                isForeign
                heroAction={heroAction}
                onHeroActionChange={setHeroAction}
                heroActionOnConvertFail={heroActionOnConvertFail}
                onHeroActionOnConvertFailChange={setHeroActionOnConvertFail}
              />
            )}
            <EnemyTilePanel
              tile={tile}
              player={player}
              ownedTiles={ownedTiles}
              busy={busy}
              onAttack={(sourceTileId, units, offenseSpellId, dispatch) =>
                callApi("/api/game/attack", {
                  sourceTileId,
                  targetTileId: tile.tileId,
                  units,
                  offenseSpellId,
                  ...(dispatch ? { dispatch } : {}),
                  // Only forward hero choices when the target actually has a
                  // hero — keeps the request shape clean for normal tiles.
                  ...(tile.hero ? { heroAction } : {}),
                  ...(tile.hero && heroAction === "convert"
                    ? { heroActionOnConvertFail }
                    : {}),
                })
              }
            />
          </>
        )}
        {isOwn && tile.hero && (
          <HeroOnTileCard hero={tile.hero} isForeign={false} />
        )}

        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-x-4 gap-y-2 text-xs">
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

/**
 * Hero-on-tile card. For the owner view, this is read-only — class,
 * specialty, stamina bar. For an enemy attack view, it adds the
 * kill / spare / convert chooser; "convert" is disabled when the hero's
 * stamina is above STAMINA_CONVERSION_THRESHOLD (the server would reject
 * it anyway).
 */
function HeroOnTileCard({
  hero,
  isForeign,
  heroAction,
  onHeroActionChange,
  heroActionOnConvertFail,
  onHeroActionOnConvertFailChange,
}: {
  hero: GameHero;
  isForeign: boolean;
  heroAction?: HeroBattleAction;
  onHeroActionChange?: (next: HeroBattleAction) => void;
  heroActionOnConvertFail?: "kill" | "spare";
  onHeroActionOnConvertFailChange?: (next: "kill" | "spare") => void;
}) {
  const staminaPct = Math.max(
    0,
    Math.min(100, Math.round((hero.stamina / hero.staminaMax) * 100))
  );
  const classGlyph =
    hero.class === "military" ? "⚔" : hero.class === "farm" ? "⚘" : "✦";
  const classColor =
    hero.class === "military"
      ? "text-red-600 dark:text-red-400"
      : hero.class === "farm"
        ? "text-amber-600 dark:text-amber-400"
        : "text-violet-600 dark:text-violet-400";
  const convertAvailable = hero.stamina <= STAMINA_CONVERSION_THRESHOLD;
  return (
    <section className="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-lg font-semibold ${classColor}`}>
          {classGlyph} {hero.name}
        </span>
        <span className="text-xs text-neutral-500 capitalize">
          {hero.specialty.replace(/-/g, " ")} {hero.class} hero
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-neutral-500 w-20">Stamina</span>
        <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${staminaPct < 30 ? "bg-red-500" : staminaPct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${staminaPct}%` }}
          />
        </div>
        <span className="text-xs font-mono w-12 text-right">
          {hero.stamina}/{hero.staminaMax}
        </span>
      </div>
      {isForeign && onHeroActionChange && (
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            If you win this combat:
          </div>
          <div className="flex flex-wrap gap-2">
            {(["kill", "spare", "convert"] as const).map((action) => {
              const disabled = action === "convert" && !convertAvailable;
              const selected = heroAction === action;
              const label =
                action === "kill"
                  ? "Kill + take tile"
                  : action === "spare"
                    ? "Spare (wear down, tile stays)"
                    : "Attempt conversion";
              return (
                <button
                  key={action}
                  onClick={() => onHeroActionChange(action)}
                  disabled={disabled}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    selected
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={
                    disabled
                      ? `Convert is unavailable until stamina ≤ ${STAMINA_CONVERSION_THRESHOLD}.`
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          {heroAction === "convert" && onHeroActionOnConvertFailChange && (
            <div className="text-xs text-neutral-500">
              If conversion fails →{" "}
              {(["kill", "spare"] as const).map((fb) => (
                <button
                  key={fb}
                  onClick={() => onHeroActionOnConvertFailChange(fb)}
                  className={`ml-1 px-2 py-0.5 rounded border ${
                    heroActionOnConvertFail === fb
                      ? "bg-neutral-700 text-white border-neutral-700"
                      : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {fb}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
