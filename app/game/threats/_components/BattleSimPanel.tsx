/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { SPELLS_BY_ID } from "@/lib/game/content";
import type { SpellDefinition, UnitStack } from "@/lib/game/types";
import type { AttackPreview } from "../_lib/use-attack-preview";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { CatalogLore } from "@/app/game/_components/CatalogLore";

export interface BattleSimPanelProps {
  preview: AttackPreview | null;
  loading: boolean;
  error: string | null;
  // True when the calling row has determined the attack is structurally
  // impossible (e.g. enemy shielded). The panel renders a muted "preview
  // unavailable" state instead of stale numbers.
  disabled?: boolean;
  disabledReason?: string;
  /**
   * The offense spell the player currently has staged for the attack (the
   * value of the offense-spell `<select>` in ThreatRow). When set, the
   * panel renders a "Selected offense spell" block with the spell's full
   * description, lore, and expected attack-power boost so the player can
   * see what they're committing to before they swing.
   */
  selectedOffenseSpell?: {
    spell: SpellDefinition;
    /** Midpoint-dice attack-power boost (already caste/magic-multiplied). */
    expectedMagnitude: number;
  } | null;
}

// Pre-attack actions (spy / siege / flyover / cast spell) live in the new
// BoostPanel — this component is a pure projection now. Artifacts also live
// outside this panel (BoostPanel for offense+intel, ManageSourcePanel for
// defense) so the "Selected offense spell" block is the only action-adjacent
// element here, and even that's a *display* of the picker upstream, not a
// click target.

function totalUnits(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

function fmtStack(s: UnitStack): string {
  return `${s.ground}g ${s.siege}s ${s.air}a`;
}

/**
 * Inline live battle simulation panel for the ThreatRow attack form.
 * Renders the projected combat outcome (midpoint RNG, no commitment).
 *
 * Pure-preview: contains no action buttons. Pre-attack actions live in
 * the sibling BoostPanel; source-side actions live in ManageSourcePanel.
 */
export function BattleSimPanel({
  preview,
  loading,
  error,
  disabled,
  disabledReason,
  selectedOffenseSpell,
}: BattleSimPanelProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-600 dark:text-neutral-300">
          📊 Projected outcome
        </h4>
        <span className="text-[10px] text-neutral-500">
          midpoint projection · no turns spent
        </span>
      </div>

      <div className="px-3 py-3 space-y-3 text-xs text-neutral-700 dark:text-neutral-200">
        {disabled ? (
          <p className="text-neutral-500 italic">
            {disabledReason ?? "Preview unavailable for this configuration."}
          </p>
        ) : loading && !preview ? (
          <p className="text-neutral-500">Computing projection…</p>
        ) : error ? (
          <p className="text-red-600 dark:text-red-400">
            Preview failed: {error}
          </p>
        ) : !preview ? (
          <p className="text-neutral-500 italic">
            Select units to see a battle projection.
          </p>
        ) : (
          <PreviewBody preview={preview} stale={loading} />
        )}

        {selectedOffenseSpell ? (
          <SelectedOffenseSpellBlock
            spell={selectedOffenseSpell.spell}
            expectedMagnitude={selectedOffenseSpell.expectedMagnitude}
          />
        ) : null}
      </div>
    </div>
  );
}

function PreviewBody({
  preview,
  stale,
}: {
  preview: AttackPreview;
  stale: boolean;
}) {
  const { combat, target, effects } = preview;

  const banner = (() => {
    if (combat.outcome === "captured") {
      return {
        label: "Projected: Captured",
        classes:
          "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200",
      };
    }
    if (combat.outcome === "repelled") {
      return {
        label: "Projected: Repelled",
        classes:
          "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
      };
    }
    return {
      label: "Projected: Stalemate",
      classes:
        "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
    };
  })();

  const activePreps = buildActivePreps(effects);

  return (
    <div className={`space-y-2 ${stale ? "opacity-60" : ""}`}>
      <div
        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${banner.classes}`}
      >
        {banner.label}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <span className="text-neutral-500">Attack power · </span>
          <span className="font-mono">{combat.attackPower.toFixed(0)}</span>
        </div>
        <div>
          <span className="text-neutral-500">Defense power · </span>
          <span className="font-mono">{combat.defensePower.toFixed(0)}</span>
        </div>
        <div>
          <span className="text-neutral-500">You&apos;d lose · </span>
          <span className="font-mono">
            {fmtStack(combat.attackerLosses)} (
            {totalUnits(combat.attackerLosses)})
          </span>
        </div>
        <div>
          <span className="text-neutral-500">They&apos;d lose · </span>
          <span className="font-mono">
            {fmtStack(combat.defenderLosses)} (
            {totalUnits(combat.defenderLosses)})
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-neutral-500">Defender on tile · </span>
          <span className="font-mono">
            {fmtStack(target.units)} ({totalUnits(target.units)})
          </span>
        </div>
      </div>

      {activePreps.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
            Active prep
          </div>
          <ul className="space-y-0.5">
            {activePreps.map((p) => (
              <li key={p.label} className="font-mono text-[11px]">
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PreviewModifiers preview={preview} />
    </div>
  );
}

function SelectedOffenseSpellBlock({
  spell,
  expectedMagnitude,
}: {
  spell: SpellDefinition;
  expectedMagnitude: number;
}) {
  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex gap-3">
      <CatalogImage entry={spell} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Offense spell · T{spell.tier} {spell.name}
          </span>
          <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300 shrink-0">
            ~+{Math.round(expectedMagnitude)} atk power
          </span>
        </div>
        <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {spell.description}
        </p>
        <CatalogLore entry={spell} className="text-xs" />
        <p className="text-[10px] text-neutral-500">
          Cost +5 turns · midpoint dice 1.0× (actual roll 0.5–1.5×)
        </p>
      </div>
    </div>
  );
}

function PreviewModifiers({ preview }: { preview: AttackPreview }) {
  const { combat } = preview;
  const lines: string[] = [];
  if (combat.sourceLandTypeMultiplier !== 1) {
    lines.push(
      `Source tile · ×${combat.sourceLandTypeMultiplier.toFixed(2)} attack`
    );
  }
  if (combat.targetLandTypeMultiplier !== 1) {
    lines.push(
      `Target tile · ×${combat.targetLandTypeMultiplier.toFixed(2)} defense`
    );
  }
  if (combat.standingDefenseAdded > 0) {
    lines.push(
      `Standing defense · +${combat.standingDefenseAdded.toFixed(0)} (tile garrison)`
    );
  }
  if (combat.supplyMultiplier !== 1) {
    lines.push(`Defender supply · ×${combat.supplyMultiplier.toFixed(2)}`);
  }
  if (combat.appliedSpells.offenseId) {
    const s = SPELLS_BY_ID.get(combat.appliedSpells.offenseId);
    lines.push(`Offense spell · ${s?.name ?? combat.appliedSpells.offenseId}`);
  }
  if (combat.appliedSpells.defenseId) {
    const s = SPELLS_BY_ID.get(combat.appliedSpells.defenseId);
    lines.push(
      `Defender's armed spell · ${s?.name ?? combat.appliedSpells.defenseId}`
    );
  }
  if (lines.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
        Modifiers (this projection)
      </div>
      <ul className="space-y-0.5">
        {lines.map((l) => (
          <li key={l} className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildActivePreps(effects: AttackPreview["effects"]): {
  label: string;
}[] {
  const out: { label: string }[] = [];
  if (effects.forgeSightOffenseBonus > 0) {
    out.push({
      label: `⚔ Forge Sight · +${(effects.forgeSightOffenseBonus * 100).toFixed(
        0
      )}% offense`,
    });
  }
  if (effects.alertVsCasterDefenseBonus > 0) {
    out.push({
      label: `🚨 Defender alert · +${(
        effects.alertVsCasterDefenseBonus * 100
      ).toFixed(0)}% defense vs you`,
    });
  }
  if (effects.siegeDebuffMagnitude > 0) {
    out.push({
      label: `🏰 Siege debuff · −${(effects.siegeDebuffMagnitude * 100).toFixed(
        0
      )}% standing floor`,
    });
  }
  if (effects.preCastOffenseBonus > 0) {
    out.push({
      label: `🪄 Pre-cast offense · +${effects.preCastOffenseBonus.toFixed(
        0
      )} attack power (consumed on attack)`,
    });
  }
  if (effects.defenseDisarmFraction > 0) {
    out.push({
      label: `✨ Disarm queued · ${(effects.defenseDisarmFraction * 100).toFixed(
        0
      )}% nullification (consumed on attack)`,
    });
  }
  return out;
}
