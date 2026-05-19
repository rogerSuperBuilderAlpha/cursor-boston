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
  canAct: boolean;
  buttonLabel: string;
  onCast: (spellId: string) => void;
}

export function ProductionControls({
  spell,
  busy,
  busyForThis,
  canAct,
  buttonLabel,
  onCast,
}: Props) {
  return (
    <button
      onClick={() => onCast(spell.id)}
      disabled={busy || !canAct}
      className="w-full px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {busyForThis
        ? "Casting…"
        : canAct
          ? `Cast (${spell.turnCost}t)`
          : buttonLabel || "Cast"}
    </button>
  );
}
