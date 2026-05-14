/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { TABS, type TabId } from "../_lib/tabs";

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Help sections"
      className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-8"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-400 font-medium"
                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
