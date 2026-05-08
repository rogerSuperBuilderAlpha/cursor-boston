/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { UNITS_PER_CYCLE } from "../_lib/constants";

interface Props {
  plan: Array<{ tileId: string; cycles: number }>;
  selectedTileId: string;
}

export function PlanPreview({ plan, selectedTileId }: Props) {
  if (plan.length === 0) return null;
  return (
    <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-neutral-950 px-3 py-2 text-xs">
      <div className="font-medium mb-1">
        {selectedTileId ? "Routing to" : "Auto-routing units"}
      </div>
      <ul className="font-mono text-[11px] space-y-0.5 text-neutral-700 dark:text-neutral-300">
        {plan.map(({ tileId, cycles }, idx) => (
          <li key={tileId}>
            {tileId} +{cycles * UNITS_PER_CYCLE}
            {!selectedTileId && idx === 0 && plan.length > 1
              ? "  (most-threatened)"
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
