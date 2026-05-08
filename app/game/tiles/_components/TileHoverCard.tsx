/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { MapTile } from "@/lib/game/types";
import type { OwnerSummary } from "../_lib/types";

interface Props {
  hovered: MapTile;
  hoveredOwner: OwnerSummary | null;
  isOwnTile: boolean;
}

export function TileHoverCard({ hovered, hoveredOwner, isOwnTile }: Props) {
  return (
    <div className="absolute bottom-3 right-3 max-w-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs shadow-lg pointer-events-none">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono font-semibold">{hovered.tileId}</span>
        <span className="capitalize text-neutral-500">{hovered.type}</span>
      </div>
      <div className="text-neutral-600 dark:text-neutral-400">
        G {hovered.units.ground} · S {hovered.units.siege} · A{" "}
        {hovered.units.air}
      </div>
      {hovered.armedDefenseSpellId && (
        <div className="text-blue-600 dark:text-blue-400 mt-1">
          Armed: {hovered.armedDefenseSpellId}
        </div>
      )}
      {hovered.ownerId && !isOwnTile && (
        <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div className="font-semibold">
            {hoveredOwner?.displayName || "Unnamed general"}
          </div>
          <div className="text-neutral-500 capitalize">
            {hoveredOwner?.caste ?? "no caste"}
          </div>
          {hoveredOwner?.shielded ? (
            <div className="text-amber-600 dark:text-amber-400 mt-1">
              🛡 Shielded — can&apos;t be attacked yet
            </div>
          ) : (
            <div className="text-red-600 dark:text-red-400 mt-1">
              Targetable
            </div>
          )}
        </div>
      )}
      {hovered.ownerId && (
        <div className="text-neutral-500 mt-1 italic">
          {isOwnTile ? "click to manage" : "click to attack"}
        </div>
      )}
    </div>
  );
}
