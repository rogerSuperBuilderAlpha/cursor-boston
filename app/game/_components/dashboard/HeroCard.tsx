/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { describeShieldRemaining } from "../../_lib/dashboard-helpers";
import type { ShieldStatus } from "../../_lib/dashboard-types";

interface HeroCardProps {
  turnsRemaining: number;
  turnsSpent: number;
  shield: ShieldStatus;
}

/**
 * Top hero strip: huge turn count + shield-wall status + lifetime turn
 * spend. Below 5 turns the count goes amber.
 */
export function HeroCard({ turnsRemaining, turnsSpent, shield }: HeroCardProps) {
  const lowTurns = turnsRemaining < 5;
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-neutral-950 p-6 mb-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Turns remaining
          </div>
          <div
            className={`text-5xl font-bold tabular-nums ${
              lowTurns
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {turnsRemaining}
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            spend cost: 1 explore · 1 distribute · 1 attack · 5 recruit · 5
            spell
          </div>
        </div>

        <div className="border-l border-neutral-200 dark:border-neutral-800 pl-6">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Shield wall
          </div>
          {shield.shielded ? (
            <div className="text-sm">
              <span className="text-amber-700 dark:text-amber-400">
                🛡 Active
              </span>
              <div className="text-xs text-neutral-500 mt-0.5">
                {describeShieldRemaining(shield)}
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-red-600 dark:text-red-400">Down</span>
              <div className="text-xs text-neutral-500 mt-0.5">
                You can attack and be attacked
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto text-xs text-neutral-500 text-right">
          <div>Turns spent total</div>
          <div className="font-semibold tabular-nums text-base text-neutral-700 dark:text-neutral-300">
            {turnsSpent}
          </div>
        </div>
      </div>
    </div>
  );
}
