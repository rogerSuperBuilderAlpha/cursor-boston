/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type {
  GamePlayer,
  MapTile,
  SpellDefinition,
} from "@/lib/game/types";
import { TYPE_COLUMNS } from "../_lib/constants";
import { SpellCell } from "./SpellCell";

interface Props {
  tier: 1 | 2 | 3 | 4 | 5;
  minTiles: number;
  tilesHeld: number;
  player: GamePlayer;
  spellByTierAndType: Map<string, SpellDefinition>;
  busyId: string | null;
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
  onArmDefenseSingle: (spellId: string, tileId: string) => void;
  onArmDefenseBulk: (spellId: string, tileIds: string[]) => void;
}

/**
 * One tier row: header with unlock state + three columns (defense /
 * offense / production). Always renders all three even if the caste has
 * no spell at a given (tier, type) — the cell shows a placeholder.
 */
export function TierSection({
  tier,
  minTiles,
  tilesHeld,
  player,
  spellByTierAndType,
  busyId,
  ...rest
}: Props) {
  const tierUnlocked = tilesHeld >= minTiles;
  return (
    <section
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
              busyForThis={spell ? busyId === spell.id : false}
              {...rest}
            />
          );
        })}
      </div>
    </section>
  );
}
