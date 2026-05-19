/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type {
  GamePlayer,
  MapTile,
  SpellDefinition,
  SpellType,
} from "@/lib/game/types";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { CatalogLore } from "@/app/game/_components/CatalogLore";
import { TYPE_LABEL } from "../_lib/constants";
import { DefenseControls } from "./spell-cell/DefenseControls";
import { OffenseHint } from "./spell-cell/OffenseHint";
import { ProductionControls } from "./spell-cell/ProductionControls";

interface Props {
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
  onArmDefenseSingle: (spellId: string, tileId: string) => void;
  onArmDefenseBulk: (spellId: string, tileIds: string[]) => void;
}

/**
 * Single cell in the tier × type spell-book grid. Renders the spell name
 * + description + stats and delegates the action UI to a column-specific
 * subcomponent (Production, Defense, Offense). Returns a placeholder when
 * the player's caste has no spell at this (tier, type) intersection.
 */
export function SpellCell(props: Props) {
  const {
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
  } = props;

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
  const maxByTurns = Math.floor(
    player.turnsRemaining / Math.max(1, spell.turnCost)
  );
  const maxByTiles = armableUnarmedTiles.length;
  const cap = Math.max(0, Math.min(maxByTurns, maxByTiles));
  const effectiveN = Math.max(0, Math.min(bulkN, cap));
  const previewTileIds = threatRanked.slice(0, effectiveN);

  return (
    <div className="p-4 flex flex-col gap-3 min-h-[8rem]">
      <div className="flex items-start gap-3">
        <CatalogImage entry={spell} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold text-sm">{spell.name}</h3>
            <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
              {TYPE_LABEL[column]}
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mt-1">
            {spell.description}
          </p>
        </div>
      </div>
      <CatalogLore entry={spell} className="text-xs flex-1" />
      <div className="text-[11px] text-neutral-500">
        Strength <strong>{spell.baseStrength}</strong> · cost{" "}
        <strong>{spell.turnCost}t</strong>
      </div>

      {column === "production" && (
        <ProductionControls
          spell={spell}
          busy={busy}
          busyForThis={busyForThis}
          canAct={canAct}
          buttonLabel={buttonLabel}
          onCast={onCastProduction}
        />
      )}

      {column === "defense" && (
        <DefenseControls
          spell={spell}
          busy={busy}
          busyForThis={busyForThis}
          canAct={canAct}
          unlocked={unlocked}
          buttonLabel={buttonLabel}
          cap={cap}
          effectiveN={effectiveN}
          bulkOpen={bulkOpen}
          setBulkSpellId={setBulkSpellId}
          setBulkN={setBulkN}
          previewTileIds={previewTileIds}
          armTargetTileId={armTargetTileId}
          setArmTargetTileId={setArmTargetTileId}
          armableTiles={armableTiles}
          onArmDefenseSingle={onArmDefenseSingle}
          onArmDefenseBulk={onArmDefenseBulk}
        />
      )}

      {column === "offense" && <OffenseHint />}
    </div>
  );
}
