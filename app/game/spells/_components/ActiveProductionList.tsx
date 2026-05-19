/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { SPELLS_BY_ID } from "@/lib/game/content";
import type { GamePlayer } from "@/lib/game/types";

export function ActiveProductionList({ player }: { player: GamePlayer }) {
  const active = player.productionSpellsActive ?? [];
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Active production spells</h2>
      {active.length === 0 ? (
        <p className="text-sm text-neutral-500 italic mb-8">
          No production spells active. Cast one above to boost your unit cap or
          magic multiplier for 100 turns.
        </p>
      ) : (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg mb-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {active.map((p) => {
            const def = SPELLS_BY_ID.get(p.spellId);
            return (
              <div
                key={p.spellId + p.expiresAtTurn}
                className="px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="font-medium">{def?.name ?? p.spellId}</span>
                <span className="text-xs text-neutral-500">
                  Expires at turn {p.expiresAtTurn}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
