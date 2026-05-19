/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { buildingForCasteAndLand } from "@/lib/game/content";
import type { Caste, MapTile } from "@/lib/game/types";

export interface SourceTileCardProps {
  source: MapTile;
  myCaste: Caste;
  candidateCount: number;
  isBest: boolean;
  onOpenPicker: () => void;
}

/**
 * Inline "source tile" card sized to match the height of the G/S/A
 * input + recruit-button column to its right. Compact two-line layout:
 * row 1 = tile id + land type + badges, row 2 = unit counts. A
 * "⚙ Change (N)" pill on the right opens the source picker when the
 * player has more than one candidate tile bordering this enemy.
 */
export function SourceTileCard(props: SourceTileCardProps) {
  const { source, myCaste, candidateCount, isBest, onOpenPicker } = props;
  const building =
    source.type !== "unassigned"
      ? buildingForCasteAndLand(myCaste, source.type)
      : undefined;
  // BASE+SUPER: source card reflects the full deployable pool — garrison +
  // recruited — since the attack form drafts from both.
  const sourceBase = source.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  const totalGround = source.units.ground + sourceBase.ground;
  const totalSiege = source.units.siege + sourceBase.siege;
  const totalAir = source.units.air + sourceBase.air;
  const totalUnits = totalGround + totalSiege + totalAir;
  return (
    <div className="rounded-md border border-emerald-300/70 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/10 px-2.5 py-1.5 h-full flex items-center gap-2.5 min-h-0">
      <CatalogImage
        entry={building ?? { name: source.type }}
        size="sm"
        className="rounded shrink-0"
      />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono font-semibold text-sm text-neutral-800 dark:text-neutral-100">
            {source.tileId}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">
            {building?.name ?? source.type}
          </span>
          {isBest && (
            <span className="text-[10px] px-1.5 py-px rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              ✨ best
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
          G{totalGround} · S{totalSiege} · A{totalAir}
          {totalUnits > 0 && (
            <span className="ml-1.5 text-neutral-400">({totalUnits})</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={candidateCount <= 1}
        title={
          candidateCount <= 1
            ? "Only one of your tiles borders this enemy."
            : `Pick a different source (${candidateCount} candidates)`
        }
        className="shrink-0 px-2.5 py-1 text-[11px] rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        ⚙ Change
        {candidateCount > 1 && (
          <span className="ml-1 opacity-70">({candidateCount})</span>
        )}
      </button>
    </div>
  );
}
