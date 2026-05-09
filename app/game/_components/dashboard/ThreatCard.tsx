/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { ThreatSummary } from "../../_lib/dashboard-types";

interface ThreatCardProps {
  threats: ThreatSummary;
  shielded: boolean;
}

/**
 * Link the player from the threat callout into the consolidated Threats
 * action hub at /game/threats. Rendered only when there's actually
 * something on the border (skipped on the empty + shielded variants).
 */
function ViewAllThreatsLink() {
  return (
    <Link
      href="/game/threats"
      className="block text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
    >
      View all threats →
    </Link>
  );
}

/**
 * Border-pressure summary. Three cases:
 *   - shielded → "no one can attack you yet"
 *   - no foreign neighbors → "push the frontier outward"
 *   - some unshielded neighbors → red-tinted alert with names
 */
export function ThreatCard({ threats, shielded }: ThreatCardProps) {
  if (shielded) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Threat
        </div>
        <div className="text-sm">
          <span className="text-amber-700 dark:text-amber-400 font-semibold">
            Shielded
          </span>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          No one can attack you yet.
          {threats.totalForeignNeighbors > 0 && (
            <>
              {" "}
              You border {threats.totalForeignNeighbors} other general
              {threats.totalForeignNeighbors === 1 ? "" : "s"}.
            </>
          )}
        </div>
      </div>
    );
  }
  if (threats.unshieldedNeighbors === 0 && threats.totalForeignNeighbors === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Threat
        </div>
        <div className="text-sm">No bordering generals</div>
        <div className="text-xs text-neutral-500 mt-1">
          Push the frontier outward.
        </div>
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border p-4 ${
        threats.unshieldedNeighbors > 0
          ? "border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-900/10"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Threat
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {threats.unshieldedNeighbors}
        </div>
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        unshielded neighbors in range
      </div>
      {threats.topNeighborNames.length > 0 && (
        <div className="text-xs text-neutral-500 mt-1 truncate">
          {threats.topNeighborNames.join(" · ")}
        </div>
      )}
      {threats.totalForeignNeighbors > threats.unshieldedNeighbors && (
        <div className="text-xs text-neutral-500 mt-0.5">
          + {threats.totalForeignNeighbors - threats.unshieldedNeighbors}{" "}
          shielded
        </div>
      )}
      <ViewAllThreatsLink />
    </div>
  );
}
