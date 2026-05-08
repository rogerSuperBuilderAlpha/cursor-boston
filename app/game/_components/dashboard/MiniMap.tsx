/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { LandType, MapTile } from "@/lib/game/types";

const MINI_HEX = 8;
const MINI_SQRT3 = Math.sqrt(3);
const MINI_PADDING = MINI_HEX * 1.5;

const MINI_FILL: Record<LandType, string> = {
  unrevealed: "#262626",
  unassigned: "#525252",
  military: "#dc2626",
  food: "#16a34a",
  magic: "#2563eb",
};

interface MiniMapProps {
  tiles: MapTile[];
  userId: string;
}

/**
 * Tiny fit-to-content SVG of just the player's own territory. Click
 * anywhere → opens the full world map at /game/tiles. The full map page
 * has its own MiniMap-equivalent for cross-page consistency.
 */
export function MiniMap({ tiles, userId }: MiniMapProps) {
  const own = tiles.filter((t) => t.ownerId === userId);
  const viewBox = useMemo(() => {
    if (own.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const t of own) {
      const x = MINI_HEX * MINI_SQRT3 * (t.q + t.r / 2);
      const y = MINI_HEX * (3 / 2) * t.r;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      x: minX - MINI_PADDING,
      y: minY - MINI_PADDING,
      width: maxX - minX + 2 * MINI_PADDING,
      height: maxY - minY + 2 * MINI_PADDING,
    };
  }, [own]);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50 dark:bg-neutral-950">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Your territory
        </div>
        <Link
          href="/game/tiles"
          className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
        >
          Open map →
        </Link>
      </div>
      {viewBox ? (
        <Link href="/game/tiles" className="block">
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className="w-full h-auto"
            style={{ maxHeight: 240 }}
          >
            {own.map((t) => {
              const cx = MINI_HEX * MINI_SQRT3 * (t.q + t.r / 2);
              const cy = MINI_HEX * (3 / 2) * t.r;
              const dx = (MINI_HEX * MINI_SQRT3) / 2;
              const dy = MINI_HEX / 2;
              const points = [
                [cx, cy - MINI_HEX],
                [cx + dx, cy - dy],
                [cx + dx, cy + dy],
                [cx, cy + MINI_HEX],
                [cx - dx, cy + dy],
                [cx - dx, cy - dy],
              ]
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join(" ");
              return (
                <polygon
                  key={t.tileId}
                  points={points}
                  fill={MINI_FILL[t.type]}
                  stroke="#171717"
                  strokeWidth={0.5}
                />
              );
            })}
          </svg>
        </Link>
      ) : (
        <p className="text-xs text-neutral-500 py-8 text-center">
          No tiles yet.
        </p>
      )}
    </div>
  );
}
