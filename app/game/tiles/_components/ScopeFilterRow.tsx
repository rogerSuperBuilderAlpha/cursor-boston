/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { ScopeFilter } from "../_lib/types";

interface Props {
  scope: ScopeFilter;
  onChange: (next: ScopeFilter) => void;
  totalCount: number;
  ownCount: number;
}

export function ScopeFilterRow({ scope, onChange, totalCount, ownCount }: Props) {
  const options: Array<{ key: ScopeFilter; label: string }> = [
    { key: "everyone", label: `Everyone (${totalCount})` },
    { key: "mine", label: `Mine (${ownCount})` },
    { key: "foreign", label: `Foreign (${totalCount - ownCount})` },
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <span className="text-xs uppercase tracking-wide text-neutral-500 self-center mr-1">
        Show
      </span>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            scope === opt.key
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
