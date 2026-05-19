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

export interface ChangeSourceModalProps {
  candidates: ReadonlyArray<MapTile>;
  myCaste: Caste;
  /** Tile id of the currently-selected source — highlighted in the list
   *  so the player can tell at a glance what they're swapping away from. */
  currentSourceId: string;
  /** Tile id of the strongest source per threats-derive — gets a badge so
   *  the player knows the default pick was load-bearing. */
  bestSourceId: string;
  /** Enemy tile id, for context in the modal header. */
  targetTileId: string;
  onSelect: (tileId: string) => void;
  onClose: () => void;
}

/**
 * Modal picker for the Attack tab's source tile. Lists every player tile
 * that borders the enemy and lets the player pick a different launch
 * point — same card shape as SourceTileCard so the swap is visually
 * obvious.
 *
 * Closes on backdrop click, ESC, or after a selection lands.
 */
export function ChangeSourceModal(props: ChangeSourceModalProps) {
  const {
    candidates,
    myCaste,
    currentSourceId,
    bestSourceId,
    targetTileId,
    onSelect,
    onClose,
  } = props;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
              Choose source tile
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {candidates.length} of your tiles border{" "}
              <span className="font-mono">{targetTileId}</span>. Pick which
              one swings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="p-3 space-y-2">
          {candidates.map((tile) => {
            const isCurrent = tile.tileId === currentSourceId;
            const isBest = tile.tileId === bestSourceId;
            const building =
              tile.type !== "unassigned"
                ? buildingForCasteAndLand(myCaste, tile.type)
                : undefined;
            const totalUnits =
              tile.units.ground + tile.units.siege + tile.units.air;
            return (
              <button
                key={tile.tileId}
                type="button"
                onClick={() => {
                  onSelect(tile.tileId);
                  onClose();
                }}
                className={`w-full text-left flex items-stretch gap-3 px-3 py-2 rounded-md border transition-colors ${
                  isCurrent
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-400/50"
                    : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                }`}
              >
                <div className="shrink-0 flex items-center">
                  <CatalogImage
                    entry={building ?? { name: tile.type }}
                    size="md"
                    className="rounded-md"
                  />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm text-neutral-800 dark:text-neutral-100">
                      {tile.tileId}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {tile.type}
                    </span>
                    {isBest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        ✨ best
                      </span>
                    )}
                    {isCurrent && !isBest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    G{tile.units.ground} · S{tile.units.siege} · A
                    {tile.units.air}
                    {totalUnits > 0 && (
                      <span className="ml-2 text-neutral-400">
                        ({totalUnits} total)
                      </span>
                    )}
                  </div>
                  {building && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                      {building.name}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex items-center text-neutral-400 group-hover:text-neutral-600">
                  →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
