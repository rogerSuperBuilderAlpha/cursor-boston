/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { MapTile } from "@/lib/game/types";

export function MilitaryTilesList({ tiles }: { tiles: MapTile[] }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Your military tiles</h2>
      {tiles.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">
          None yet — distribute some unassigned tiles to military first.
        </p>
      ) : (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-200 dark:divide-neutral-800">
          {tiles.map((t) => (
            <Link
              key={t.tileId}
              href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <span className="font-mono">{t.tileId}</span>
              <span className="text-xs text-neutral-500">
                G {t.units.ground} · S {t.units.siege} · A {t.units.air}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
