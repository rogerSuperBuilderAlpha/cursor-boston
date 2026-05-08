/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { MapTile, SpellDefinition } from "@/lib/game/types";
import { BulkArmPanel } from "./BulkArmPanel";

interface Props {
  spell: SpellDefinition;
  busy: boolean;
  busyForThis: boolean;
  canAct: boolean;
  unlocked: boolean;
  buttonLabel: string;
  cap: number;
  effectiveN: number;
  bulkOpen: boolean;
  setBulkSpellId: (id: string | null) => void;
  setBulkN: (n: number) => void;
  previewTileIds: string[];
  armTargetTileId: string;
  setArmTargetTileId: (id: string) => void;
  armableTiles: MapTile[];
  onArmDefenseSingle: (spellId: string, tileId: string) => void;
  onArmDefenseBulk: (spellId: string, tileIds: string[]) => void;
}

export function DefenseControls(props: Props) {
  const {
    spell,
    busy,
    canAct,
    unlocked,
    buttonLabel,
    cap,
    bulkOpen,
    setBulkSpellId,
    setBulkN,
    armTargetTileId,
    setArmTargetTileId,
    armableTiles,
    onArmDefenseSingle,
  } = props;

  if (bulkOpen) {
    return <BulkArmPanel {...props} />;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => {
          // Default N: as many as the player can afford and has unarmed
          // tiles to receive — typical "arm everything I can" intent.
          setBulkSpellId(spell.id);
          setBulkN(cap);
        }}
        disabled={busy || !canAct || cap === 0}
        className="w-full px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {!canAct
          ? buttonLabel || "Bulk-arm"
          : cap === 0
            ? "All tiles already armed"
            : `Bulk-arm top tiles (max ${cap})`}
      </button>
      <details className="text-[11px]">
        <summary className="cursor-pointer text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
          Or arm one tile manually…
        </summary>
        <div className="mt-2 space-y-2">
          <select
            value={armTargetTileId}
            onChange={(e) => setArmTargetTileId(e.target.value)}
            disabled={busy || !unlocked}
            className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          >
            <option value="">Pick a tile…</option>
            {armableTiles.map((t) => (
              <option key={t.tileId} value={t.tileId}>
                {t.tileId} ({t.type})
                {t.armedDefenseSpellId ? " · armed" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => onArmDefenseSingle(spell.id, armTargetTileId)}
            disabled={busy || !canAct || !armTargetTileId}
            className="w-full px-3 py-1 text-xs border border-emerald-500 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Arm one
          </button>
        </div>
      </details>
    </div>
  );
}
