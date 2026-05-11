/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  ALL_BUILDINGS,
  CASTE_PROFILES,
  getSpellForCasteAndType,
  getUnitForCasteAndType,
} from "@/lib/game/content";
import type { Caste } from "@/lib/game/types";
import { CASTE_PRESENTATION } from "../_lib/constants";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { CatalogLore } from "@/app/game/_components/CatalogLore";

interface Props {
  caste: Caste;
  busy: boolean;
  onChoose: () => void;
}

/**
 * Caste-pick card. Shows lore + tile-cap stat + the three caste units
 * (collapsible) + the three caste spells (collapsible) + available
 * buildings (collapsible). The "Pick" button locks the caste server-side
 * — irreversible, so the parent should be confident the user has chosen.
 */
export function CastePickCard({ caste, busy, onChoose }: Props) {
  const presentation = CASTE_PRESENTATION[caste];
  const profile = CASTE_PROFILES[caste];
  const ground = getUnitForCasteAndType(caste, "ground");
  const siege = getUnitForCasteAndType(caste, "siege");
  const air = getUnitForCasteAndType(caste, "air");
  const defense = getSpellForCasteAndType(caste, "defense");
  const offense = getSpellForCasteAndType(caste, "offense");
  const production = getSpellForCasteAndType(caste, "production");
  const buildings = ALL_BUILDINGS.filter(
    (b) => b.caste === caste || b.caste === "neutral"
  );

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-950 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <CatalogImage entry={{ ...profile, name: caste }} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              aria-hidden="true"
              className="inline-block w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-700"
              style={{ background: presentation.swatch }}
            />
            <h3 className="text-lg font-semibold capitalize">{caste}</h3>
          </div>
          <span className="text-xs text-neutral-500">{presentation.tagline}</span>
        </div>
      </div>

      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-2">
        {presentation.lore}
      </p>
      <CatalogLore entry={profile} className="mb-3" />

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <Stat
          label="Tile cap"
          value={`×${profile.tileCapacityMultiplier.toFixed(2)}`}
        />
        <Stat label="Strongest unit" value={topKey(profile.unitTypeBonuses)} />
        <Stat
          label="Strongest spell"
          value={topKey(profile.spellTypeBonuses)}
        />
      </div>

      <details className="mb-2 text-sm" open>
        <summary className="cursor-pointer font-medium text-xs uppercase tracking-wide text-neutral-500">
          Units
        </summary>
        <div className="mt-2 space-y-2">
          <UnitLine unit={ground} bonus={profile.unitTypeBonuses.ground} />
          <UnitLine unit={siege} bonus={profile.unitTypeBonuses.siege} />
          <UnitLine unit={air} bonus={profile.unitTypeBonuses.air} />
        </div>
      </details>

      <details className="mb-2 text-sm">
        <summary className="cursor-pointer font-medium text-xs uppercase tracking-wide text-neutral-500">
          Spells
        </summary>
        <div className="mt-2 space-y-2">
          <SpellLine
            spell={defense}
            slot="defense"
            bonus={profile.spellTypeBonuses.defense}
          />
          <SpellLine
            spell={offense}
            slot="offense"
            bonus={profile.spellTypeBonuses.offense}
          />
          <SpellLine
            spell={production}
            slot="production"
            bonus={profile.spellTypeBonuses.production}
          />
        </div>
      </details>

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer font-medium text-xs uppercase tracking-wide text-neutral-500">
          Buildings ({buildings.length})
        </summary>
        <div className="mt-2 text-sm">
          {buildings.length === 0 ? (
            <p className="text-neutral-500 italic text-xs">
              No building upgrades yet — coming in v2. Tile improvements
              currently come from the artifact pool and from production spells.
            </p>
          ) : (
            <ul className="space-y-2">
              {buildings.map((b) => (
                <li key={b.id} className="text-xs flex gap-2">
                  <CatalogImage entry={b} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-neutral-500"> — {b.description}</span>
                    </div>
                    <CatalogLore entry={b} className="text-xs mt-0.5" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <button
        onClick={onChoose}
        disabled={busy}
        className="mt-auto w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors capitalize disabled:opacity-50"
      >
        {busy ? "Locking…" : `Pick ${caste}`}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 dark:border-neutral-800 p-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}

function UnitLine({
  unit,
  bonus,
}: {
  unit: ReturnType<typeof getUnitForCasteAndType>;
  bonus: number;
}) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 flex gap-2">
      <CatalogImage entry={unit} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{unit.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">
            {unit.type} · ×{bonus.toFixed(2)}
          </span>
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          ATK {unit.attack} · DEF {unit.defense} · HP {unit.hp}
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 italic mt-1">
          {unit.description}
        </div>
        <CatalogLore entry={unit} className="text-xs mt-1" />
      </div>
    </div>
  );
}

function SpellLine({
  spell,
  slot,
  bonus,
}: {
  spell: ReturnType<typeof getSpellForCasteAndType>;
  slot: "defense" | "offense" | "production";
  bonus: number;
}) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 flex gap-2">
      <CatalogImage entry={spell} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{spell.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">
            {slot} · ×{bonus.toFixed(2)}
          </span>
        </div>
        <div className="text-xs text-neutral-500 mt-0.5">
          Base strength {spell.baseStrength}
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 italic mt-1">
          {spell.description}
        </div>
        <CatalogLore entry={spell} className="text-xs mt-1" />
      </div>
    </div>
  );
}

function topKey(record: Record<string, number>): string {
  let bestKey = "";
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(record)) {
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}
