/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { MapTile } from "@/lib/game/types";
import { unitsPerCycleForLand } from "../_lib/constants";

const TYPE_LABEL: Record<string, string> = {
  military: "Military",
  food: "Food",
  magic: "Magic",
};

const TYPE_BADGE: Record<string, string> = {
  military:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  food:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  magic:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

export function RecruitableTilesList({ tiles }: { tiles: MapTile[] }) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Your recruitable tiles</h2>
      {tiles.length === 0 ? (
        <p className="text-sm text-neutral-500 italic">
          None yet — distribute some unassigned tiles first. Military tiles
          train 10 units/cycle; food and magic tiles train 5/cycle.
        </p>
      ) : (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-200 dark:divide-neutral-800">
          {tiles.map((t) => {
            const yieldPerCycle = unitsPerCycleForLand(t.type);
            return (
              <Link
                key={t.tileId}
                href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono truncate">{t.tileId}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      TYPE_BADGE[t.type] ?? "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {TYPE_LABEL[t.type] ?? t.type} · +{yieldPerCycle}/cycle
                  </span>
                </span>
                <span className="text-xs text-neutral-500 shrink-0">
                  G {t.units.ground} · S {t.units.siege} · A {t.units.air}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
