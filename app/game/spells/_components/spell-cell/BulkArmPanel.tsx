/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { SpellDefinition } from "@/lib/game/types";

interface Props {
  spell: SpellDefinition;
  busy: boolean;
  busyForThis: boolean;
  cap: number;
  effectiveN: number;
  setBulkSpellId: (id: string | null) => void;
  setBulkN: (n: number) => void;
  previewTileIds: string[];
  onArmDefenseBulk: (spellId: string, tileIds: string[]) => void;
}

/**
 * Bulk-arm panel for a defense spell. Shows the top-N tiles ranked by
 * threat (bordering unshielded enemies first) and lets the user adjust
 * N or cancel before committing.
 */
export function BulkArmPanel({
  spell,
  busy,
  busyForThis,
  cap,
  effectiveN,
  setBulkSpellId,
  setBulkN,
  previewTileIds,
  onArmDefenseBulk,
}: Props) {
  return (
    <div className="rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`bulk-n-${spell.id}`}
          className="text-[11px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
        >
          Arm on top
        </label>
        <input
          id={`bulk-n-${spell.id}`}
          type="number"
          min={1}
          max={cap}
          value={effectiveN}
          onChange={(e) => setBulkN(Number(e.target.value) || 0)}
          className="w-16 px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
        />
        <span className="text-[11px] text-neutral-500">/ {cap} tiles</span>
      </div>
      <p className="text-[11px] text-neutral-500 leading-snug">
        Sorted by threat: tiles bordering an unshielded enemy first, then by
        hex distance to the nearest enemy. Cost:{" "}
        <strong>{effectiveN * spell.turnCost}t</strong>.
      </p>
      <div className="text-[11px] max-h-28 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-950 px-2 py-1 font-mono">
        {previewTileIds.length === 0 ? (
          <p className="italic text-neutral-400">
            No tiles in range — adjust N or close.
          </p>
        ) : (
          previewTileIds.map((id) => <div key={id}>{id}</div>)
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onArmDefenseBulk(spell.id, previewTileIds)}
          disabled={busy || effectiveN === 0}
          className="flex-1 px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busyForThis ? "Arming…" : `Arm ${effectiveN}`}
        </button>
        <button
          onClick={() => setBulkSpellId(null)}
          disabled={busy}
          className="px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
