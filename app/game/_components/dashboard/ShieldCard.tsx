/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { ShieldStatus } from "../../_lib/dashboard-types";

/**
 * Detail-level shield card (the hero strip up top is the at-a-glance
 * version). Shows both bottlenecks side-by-side and clarifies that the
 * shield drops as soon as *either* hits zero.
 */
export function ShieldCard({ shield }: { shield: ShieldStatus }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        Shield wall
      </div>
      {shield.shielded ? (
        <>
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            🛡 Active
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 space-y-0.5">
            <div>
              <span className="tabular-nums">{shield.daysLeft}</span>d remaining
              by clock
            </div>
            <div>
              <span className="tabular-nums">{shield.turnsLeft}</span> more
              turns to spend
            </div>
            <div className="text-neutral-500 italic mt-1">
              Drops once <em>either</em> hits zero.
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">
            Down
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            You can attack and be attacked.
          </div>
        </>
      )}
    </div>
  );
}
