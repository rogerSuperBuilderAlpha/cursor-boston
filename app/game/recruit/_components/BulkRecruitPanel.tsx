/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { MapTile, UnitType } from "@/lib/game/types";
import { TURNS_PER_CYCLE, UNITS_PER_CYCLE } from "../_lib/constants";
import type { RecruitProgress } from "../_lib/types";
import { PlanPreview } from "./PlanPreview";
import { ProgressBar } from "./ProgressBar";

interface Props {
  militaryTiles: MapTile[];
  threatRankedMilitaryIds: string[];
  unitType: UnitType;
  setUnitType: (u: UnitType) => void;
  requestedUnits: number;
  setRequestedUnits: (n: number) => void;
  selectedTileId: string;
  setSelectedTileId: (id: string) => void;
  busy: boolean;
  maxCycles: number;
  maxUnits: number;
  effectiveUnits: number;
  planPreview: Array<{ tileId: string; cycles: number }>;
  progress: RecruitProgress | null;
  onRecruit: () => void;
}

/**
 * The recruit form: unit-type / count / target-tile selectors + the
 * recruit button + the live plan preview + the progress bar. Owns
 * nothing — every value comes from the parent (which holds the local
 * picker state and the action result).
 */
export function BulkRecruitPanel({
  militaryTiles,
  threatRankedMilitaryIds,
  unitType,
  setUnitType,
  requestedUnits,
  setRequestedUnits,
  selectedTileId,
  setSelectedTileId,
  busy,
  maxCycles,
  maxUnits,
  effectiveUnits,
  planPreview,
  progress,
  onRecruit,
}: Props) {
  return (
    <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 mb-6">
      <h2 className="font-semibold mb-3">Bulk recruit</h2>
      {militaryTiles.length === 0 ? (
        <p className="text-sm text-neutral-500">
          You have no military tiles. Distribute some unassigned tiles to{" "}
          <em>military</em> first — head to the dashboard&apos;s bulk-assign
          panel or any tile&apos;s detail page.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Unit type:{" "}
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
                disabled={busy}
                className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent capitalize"
              >
                <option value="ground">ground</option>
                <option value="siege">siege</option>
                <option value="air">air</option>
              </select>
            </label>
            <label className="text-sm">
              Units (multiple of {UNITS_PER_CYCLE}):{" "}
              <input
                type="number"
                step={UNITS_PER_CYCLE}
                min={UNITS_PER_CYCLE}
                max={Math.max(UNITS_PER_CYCLE, maxUnits)}
                value={requestedUnits}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setRequestedUnits(n);
                }}
                disabled={busy}
                className="w-24 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
              />
            </label>
            <label className="text-sm">
              Distribute to:{" "}
              <select
                value={selectedTileId}
                onChange={(e) => setSelectedTileId(e.target.value)}
                disabled={busy || militaryTiles.length === 0}
                className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
              >
                <option value="">Auto — most-threatened tiles first</option>
                {threatRankedMilitaryIds.map((tileId, idx) => (
                  <option key={tileId} value={tileId}>
                    {tileId}
                    {idx === 0 ? " (top threat)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={onRecruit}
              disabled={busy || maxCycles === 0}
              className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {busy
                ? "Training units…"
                : `Recruit ${effectiveUnits} ${unitType}`}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            {TURNS_PER_CYCLE} turns / {UNITS_PER_CYCLE} units · across{" "}
            {militaryTiles.length} military tile
            {militaryTiles.length === 1 ? "" : "s"}.
          </p>
          <PlanPreview plan={planPreview} selectedTileId={selectedTileId} />
        </div>
      )}

      {progress && <ProgressBar progress={progress} />}
    </div>
  );
}
