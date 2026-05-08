/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { SPELLS_BY_ID } from "@/lib/game/content";
import type { MapTile } from "@/lib/game/types";

export function ArmedTilesList({ tiles }: { tiles: MapTile[] }) {
  const armed = tiles.filter((t) => t.armedDefenseSpellId);
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Tiles with defense armed</h2>
      {armed.length === 0 ? (
        <p className="text-sm text-neutral-500 italic mb-8">
          No tiles armed yet. Use the bulk-arm panel on a defense spell — it
          sorts your tiles by threat (bordering enemies first).
        </p>
      ) : (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg mb-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {armed.map((t) => {
            const def = t.armedDefenseSpellId
              ? SPELLS_BY_ID.get(t.armedDefenseSpellId)
              : null;
            return (
              <Link
                key={t.tileId}
                href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span className="font-mono">{t.tileId}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {def?.name ?? t.armedDefenseSpellId}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
