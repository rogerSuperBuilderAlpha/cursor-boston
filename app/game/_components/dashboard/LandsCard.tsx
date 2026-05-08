/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { LandCounts } from "../../_lib/dashboard-types";

/**
 * Stacked-bar breakdown of owned tile types (military / food / magic /
 * unassigned) plus a per-type tally underneath. Colors mirror the world
 * map's type-fill palette so the cards read as a legend at a glance.
 */
export function LandsCard({ counts }: { counts: LandCounts }) {
  const total = counts.total || 1;
  const segments: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }> = [
    { key: "military", label: "Military", value: counts.military, color: "#dc2626" },
    { key: "food", label: "Food", value: counts.food, color: "#16a34a" },
    { key: "magic", label: "Magic", value: counts.magic, color: "#2563eb" },
    {
      key: "unassigned",
      label: "Unassigned",
      value: counts.unassigned,
      color: "#737373",
    },
  ];
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Lands
        </div>
        <div className="text-2xl font-semibold tabular-nums">{counts.total}</div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-neutral-100 dark:bg-neutral-800">
        {segments.map((s) =>
          s.value === 0 ? null : (
            <div
              key={s.key}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
              title={`${s.label}: ${s.value}`}
            />
          )
        )}
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
        {segments.map((s) => (
          <div key={s.key} className="flex justify-between">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
