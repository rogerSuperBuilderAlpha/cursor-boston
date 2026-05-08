/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { ArmyTotals } from "../../_lib/dashboard-types";

interface ArmyCardProps {
  army: ArmyTotals;
  cap: number;
}

/**
 * Total army size + cap usage bar + per-type breakdown (ground / siege
 * / air). Cap is computed from food tiles + active production spells in
 * the parent.
 */
export function ArmyCard({ army, cap }: ArmyCardProps) {
  const pct = cap > 0 ? Math.min(100, (army.total / cap) * 100) : 0;
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Army
        </div>
        <div className="text-2xl font-semibold tabular-nums">{army.total}</div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-neutral-100 dark:bg-neutral-800">
        <div
          className="bg-emerald-500"
          style={{ width: `${pct}%` }}
          title={`${army.total} / ${cap}`}
        />
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
        <div className="flex justify-between">
          <span>Ground</span>
          <span className="tabular-nums">{army.ground}</span>
        </div>
        <div className="flex justify-between">
          <span>Siege</span>
          <span className="tabular-nums">{army.siege}</span>
        </div>
        <div className="flex justify-between">
          <span>Air</span>
          <span className="tabular-nums">{army.air}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 dark:border-neutral-800 mt-1 pt-1 text-neutral-500">
          <span>Cap</span>
          <span className="tabular-nums">{cap}</span>
        </div>
      </div>
    </div>
  );
}
