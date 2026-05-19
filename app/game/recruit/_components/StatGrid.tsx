/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

interface Stats {
  militaryTiles: number;
  cap: number;
  unitsAlive: number;
  availableCap: number;
  turnsRemaining: number;
  maxUnits: number;
  maxCycles: number;
  foodTiles: number;
  magicTiles: number;
}

export function StatGrid(stats: Stats) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Stat label="Military tiles" value={String(stats.militaryTiles)} />
      <Stat label="Unit cap" value={String(stats.cap)} />
      <Stat label="Units alive" value={String(stats.unitsAlive)} />
      <Stat label="Available cap" value={String(stats.availableCap)} />
      <Stat label="Turns remaining" value={String(stats.turnsRemaining)} />
      <Stat
        label="Max units this session"
        value={String(stats.maxUnits)}
        hint={`(${stats.maxCycles} cycles)`}
      />
      <Stat label="Food lands" value={String(stats.foodTiles)} />
      <Stat label="Magic lands" value={String(stats.magicTiles)} />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold">
        {value}
        {hint && (
          <span className="text-xs text-neutral-500 ml-2 font-normal">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
