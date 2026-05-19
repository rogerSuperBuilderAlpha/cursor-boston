/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { LandType, MapTile } from "@/lib/game/types";
import { LAND_FILTERS } from "../_lib/constants";

interface Props {
  filter: LandType | "all";
  onChange: (next: LandType | "all") => void;
  visibleTiles: MapTile[];
}

export function LandTypeFilterRow({ filter, onChange, visibleTiles }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {LAND_FILTERS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-lg text-sm capitalize border ${
            filter === t
              ? "bg-emerald-500 text-white border-emerald-500"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {t} (
          {t === "all"
            ? visibleTiles.length
            : visibleTiles.filter((x) => x.type === t).length}
          )
        </button>
      ))}
    </div>
  );
}
