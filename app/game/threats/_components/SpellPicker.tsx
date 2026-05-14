/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CatalogImage } from "@/app/game/_components/CatalogImage";
import type { SpellDefinition } from "@/lib/game/types";

export interface SpellPickerProps {
  spells: ReadonlyArray<SpellDefinition>;
  /** Map of spellId → expected magnitude midpoint (atk-power add) for label. */
  expectedById: ReadonlyMap<string, number>;
  selectedSpellId: string;
  onSelect: (spellId: string) => void;
}

/**
 * Card-style offensive spell picker. Renders the player's castable
 * offense spells as visual cards — image + name + tier + expected effect
 * + flavor — and a "no spell" card at the front so the player can opt
 * out without digging in a dropdown. The selected card glows red to
 * mirror the artifact-pick styling in BoostPanel.
 *
 * Lives in its own box (parent renders the section header) so it can
 * sit alongside the projected-outcome panel without competing for
 * vertical space inside the attack form.
 */
export function SpellPicker(props: SpellPickerProps) {
  const { spells, expectedById, selectedSpellId, onSelect } = props;
  return (
    <section className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10 overflow-hidden h-full flex flex-col">
      <header className="px-3 py-2 border-b border-red-200 dark:border-red-900 flex items-baseline justify-between shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
          🪄 Offensive spell
        </h3>
        <span className="text-[10px] text-red-700/60 dark:text-red-300/60">
          optional · +5t when cast with the attack
        </span>
      </header>

      <div className="px-3 py-3 flex-1">
        {spells.length === 0 ? (
          <p className="text-xs italic text-neutral-500">
            No offensive spells unlocked yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <NoneCard
              selected={selectedSpellId === ""}
              onSelect={() => onSelect("")}
            />
            {spells.map((s) => {
              const expected = expectedById.get(s.id);
              const isSelected = selectedSpellId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? "" : s.id)}
                  title={s.description}
                  className={`flex items-start gap-2 p-2 text-left text-xs border rounded-md transition-colors ${
                    isSelected
                      ? "border-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-400/60"
                      : "border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                  }`}
                >
                  <CatalogImage entry={s} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">
                        T{s.tier} {s.name}
                      </span>
                      {expected !== undefined && (
                        <span className="text-[10px] text-red-700 dark:text-red-300 shrink-0">
                          ~+{Math.round(expected)} atk
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">
                      {s.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function NoneCard({
  selected,
  onSelect,
}: {
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 text-left text-xs border rounded-md transition-colors ${
        selected
          ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-900/40 ring-1 ring-neutral-400/60"
          : "border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/30"
      }`}
    >
      <span className="w-8 h-8 rounded-md bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 text-base shrink-0">
        ∅
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">No spell</div>
        <p className="text-[11px] text-neutral-500">
          Save 5 turns — swing on raw force.
        </p>
      </div>
    </button>
  );
}
