/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { AudienceFilter } from "../_lib/types";

interface Props {
  audience: AudienceFilter;
  onChange: (next: AudienceFilter) => void;
  humanCount: number;
  npcCount: number;
}

export function AudienceFilterRow({
  audience,
  onChange,
  humanCount,
  npcCount,
}: Props) {
  const options: Array<{ key: AudienceFilter; label: string }> = [
    { key: "all", label: `All (${humanCount + npcCount})` },
    { key: "humans", label: `Humans (${humanCount})` },
    { key: "npcs", label: `NPCs (${npcCount})` },
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <span className="text-xs uppercase tracking-wide text-neutral-500 self-center mr-1">
        Audience
      </span>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            audience === opt.key
              ? "bg-emerald-500 text-white border-emerald-500"
              : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
