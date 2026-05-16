/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { GameHero, MapTile } from "@/lib/game/types";
import { STAMINA_CONVERSION_THRESHOLD } from "@/lib/game/content/heroes";

interface HeroesRosterCardProps {
  tiles: ReadonlyArray<MapTile>;
}

/**
 * Lists the player's heroes (one per tile). Heroes live on `tile.hero` so
 * we derive the roster by scanning the tile list the dashboard already
 * loads (avoids a second query). Each row shows class, specialty, name,
 * stamina bar, and a link to the tile.
 *
 * Distinct from the existing `HeroCard.tsx` (turn-count strip) — keep the
 * names different to avoid confusion.
 */
export function HeroesRosterCard({ tiles }: HeroesRosterCardProps) {
  const heroes = useMemo(() => {
    const out: GameHero[] = [];
    for (const t of tiles) {
      if (t.hero) out.push(t.hero);
    }
    return out;
  }, [tiles]);

  if (heroes.length === 0) return null;

  const counts = {
    military: heroes.filter((h) => h.class === "military").length,
    farm: heroes.filter((h) => h.class === "farm").length,
    magic: heroes.filter((h) => h.class === "magic").length,
  };

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Heroes
        </h2>
        <span className="text-xs text-neutral-500">
          ⚔ {counts.military} · ⚘ {counts.farm} · ✦ {counts.magic}
        </span>
      </div>
      <ul className="space-y-2">
        {heroes.map((h) => {
          const pct = Math.max(
            0,
            Math.min(100, Math.round((h.stamina / h.staminaMax) * 100))
          );
          const glyph =
            h.class === "military" ? "⚔" : h.class === "farm" ? "⚘" : "✦";
          const color =
            h.class === "military"
              ? "text-red-600 dark:text-red-400"
              : h.class === "farm"
                ? "text-amber-600 dark:text-amber-400"
                : "text-violet-600 dark:text-violet-400";
          return (
            <li
              key={h.id}
              className="flex items-center gap-3 text-sm"
            >
              <span className={`text-lg ${color}`}>{glyph}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold truncate">{h.name}</span>
                  <span className="text-xs text-neutral-500 capitalize">
                    {h.specialty.replace(/-/g, " ")}
                  </span>
                  <Link
                    href={`/game/tiles/${encodeURIComponent(h.tileId)}`}
                    className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {h.tileId} →
                  </Link>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono w-12 text-right text-neutral-500">
                    {h.stamina}/{h.staminaMax}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-neutral-500">
        Stamina regens when idle; drops when the hero&apos;s tile is engaged.
        Conversion attempts unlock at stamina ≤ {STAMINA_CONVERSION_THRESHOLD}.
      </p>
    </section>
  );
}
