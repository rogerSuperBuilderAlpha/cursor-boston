/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { SPELLS_BY_ID } from "@/lib/game/content";
import type {
  CombatResult,
  GameTile,
  TurnReport,
  UnitStack,
} from "@/lib/game/types";

export interface BattleReportProps {
  /** The full combat resolution (RNG, modifiers, applied spells, intel). */
  combat: CombatResult;
  /** The TurnReport produced by the same attack — used for the prose
   *  narrative and the cost-in-turns banner. */
  report: TurnReport;
  /** Post-combat enemy tile state. For repelled/stalemate we derive defender
   *  pre-attack units as `targetTile.units + combat.defenderLosses`. For a
   *  captured tile, `targetTile.units` is the attacker's survivors so we
   *  fall back to `combat.defenderLosses` directly (which combat.ts sets to
   *  the defender's full pre-attack stack on capture). */
  targetTile: GameTile;
  /** Click-to-dismiss handler. The card persists until cleared (or the
   *  next attack on the same row overwrites it). */
  onDismiss: () => void;
}

const UNDERDOG_DEFENSE_BONUS = 0.25; // mirrors lib/game/combat.ts:59

function totalUnits(stack: UnitStack): number {
  return stack.ground + stack.siege + stack.air;
}

function fmtRoll(n: number): string {
  return `${n.toFixed(2)}×`;
}

/**
 * Inline structured battle readout shown on a Threat row after an attack.
 * Replaces the legacy one-line toast. Persists until dismissed; the next
 * attack on the same row overwrites it via the parent's local state.
 *
 * Sections rendered:
 *   - Outcome banner (Captured / Repelled / Stalemate, color-coded)
 *   - Forces (you sent / defender had — derived for the latter)
 *   - Losses (per unit type for both sides)
 *   - Modifiers (only the lines that actually applied + the always-on RNG)
 *   - Narrative (the existing 2-line prose from buildAttackReport)
 */
export function BattleReport({
  combat,
  report,
  targetTile,
  onDismiss,
}: BattleReportProps) {
  // BASE+SUPER: defenderUnitsPreAttack is the composite stack (garrison +
  // reinforcements) the defender held entering combat. Surfaced by
  // resolveAttack so we don't have to back-derive from post-attack state.
  // Optional-with-fallback so older test fixtures + legacy CombatResult
  // shapes still render: on captures the targetTile now belongs to the
  // attacker so `defenderLosses` alone reconstructs the pre-attack stack;
  // on repels/stalemates we add surviving units to lost ones.
  const defenderPreAttack: UnitStack =
    combat.defenderUnitsPreAttack ??
    (combat.outcome === "captured"
      ? { ...combat.defenderLosses }
      : {
          ground: targetTile.units.ground + combat.defenderLosses.ground,
          siege: targetTile.units.siege + combat.defenderLosses.siege,
          air: targetTile.units.air + combat.defenderLosses.air,
        });
  const defenderBasePreAttack: UnitStack = combat.defenderBasePreAttack ?? {
    ground: 0,
    siege: 0,
    air: 0,
  };
  const sent = combat.unitsDeployed;
  const sentTotal = totalUnits(sent);
  const defenderHadTotal = totalUnits(defenderPreAttack);
  const attackerLost = combat.attackerLosses;
  const defenderLost = combat.defenderLosses;

  // Decisiveness label for the banner sub-title. Maps the lossCurveTag from
  // combat to player-facing prose.
  const decisivenessLabel = (() => {
    switch (combat.lossCurveTag) {
      case "decisive-capture":
        return "Decisive";
      case "close-capture":
        return "Narrow";
      case "stalemate":
        return "Stalemate";
      case "close-repel":
        return "Pyrrhic loss";
      case "decisive-repel":
        return "Crushed";
      default:
        return null;
    }
  })();

  const banner = (() => {
    if (combat.outcome === "captured") {
      return {
        label: `Captured ${report.outcome?.targetTileId ?? targetTile.tileId}`,
        tone: "emerald",
        classes:
          "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200",
      };
    }
    if (combat.outcome === "repelled") {
      return {
        label: `Repelled at ${report.outcome?.targetTileId ?? targetTile.tileId}`,
        tone: "red",
        classes:
          "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200",
      };
    }
    return {
      label: `Stalemate at ${report.outcome?.targetTileId ?? targetTile.tileId}`,
      tone: "amber",
      classes:
        "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200",
    };
  })();

  // Modifier lines — only emit the ones that actually applied. RNG always
  // shows because there's always a roll.
  const modifiers: string[] = [];
  // Tile-type combat modifiers (May 2026 mechanics rework).
  if (
    combat.sourceLandTypeMultiplier !== undefined &&
    combat.sourceLandTypeMultiplier !== 1
  ) {
    modifiers.push(
      `Source tile · ×${combat.sourceLandTypeMultiplier.toFixed(2)} on attack`
    );
  }
  if (
    combat.targetLandTypeMultiplier !== undefined &&
    combat.targetLandTypeMultiplier !== 1
  ) {
    modifiers.push(
      `Target tile · ×${combat.targetLandTypeMultiplier.toFixed(2)} on defense`
    );
  }
  if (combat.standingDefenseAdded && combat.standingDefenseAdded > 0) {
    modifiers.push(
      `Standing defense · +${combat.standingDefenseAdded.toFixed(0)} (tile garrison)`
    );
  }
  if (combat.underdogApplied) {
    modifiers.push(
      `Underdog bonus active · ×${(1 + UNDERDOG_DEFENSE_BONUS).toFixed(2)} on defense`
    );
  }
  if (combat.supplyMultiplier !== 1) {
    modifiers.push(
      `Defender supply · ×${combat.supplyMultiplier.toFixed(2)}`
    );
  }
  if (combat.appliedSpells.offenseId) {
    const s = SPELLS_BY_ID.get(combat.appliedSpells.offenseId);
    const magicBonus = combat.magicTileOffenseSpellBonusApplied
      ? " (magic-tile ×1.25)"
      : "";
    modifiers.push(
      s
        ? `Offense spell · ${s.name} · T${s.tier}${magicBonus}`
        : `Offense spell · ${combat.appliedSpells.offenseId}${magicBonus}`
    );
  }
  if (combat.appliedSpells.defenseId) {
    const s = SPELLS_BY_ID.get(combat.appliedSpells.defenseId);
    const magicBonus = combat.magicTileDefenseSpellBonusApplied
      ? " (magic-tile ×1.25)"
      : "";
    modifiers.push(
      s
        ? `Defense spell triggered · ${s.name} · T${s.tier}${magicBonus}`
        : `Defense spell triggered · ${combat.appliedSpells.defenseId}${magicBonus}`
    );
  }
  if (combat.airIntel?.weakFace) {
    modifiers.push(`Forge Sight · led with ${combat.airIntel.weakFace}`);
  }
  if (combat.airIntel?.defenseSpellTier !== undefined) {
    modifiers.push(
      `Hawks Eye · revealed defense-spell tier ${combat.airIntel.defenseSpellTier}`
    );
  }
  if (combat.unitsClampedFromCapacity > 0) {
    modifiers.push(
      `Capacity dropped ${combat.unitsClampedFromCapacity} pre-combat`
    );
  }
  modifiers.push(
    `RNG · attacker ${fmtRoll(combat.rng.attackerRoll)} / defender ${fmtRoll(combat.rng.defenderRoll)}`
  );
  modifiers.push(
    `Power · attack ${combat.attackPower.toFixed(0)} vs defense ${combat.defensePower.toFixed(0)}`
  );

  return (
    <div className={`rounded-lg border-2 ${banner.classes}`}>
      <div className="flex items-baseline justify-between px-3 py-2">
        <h3 className="font-semibold uppercase tracking-wide text-xs">
          {banner.label}
          {decisivenessLabel && (
            <span className="normal-case font-semibold ml-2 opacity-90">
              · {decisivenessLabel}
            </span>
          )}
          <span className="text-neutral-500 normal-case font-normal ml-2">
            · {report.cost} turn{report.cost === 1 ? "" : "s"} spent
          </span>
        </h3>
        <button
          onClick={onDismiss}
          aria-label="Dismiss battle report"
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
        >
          ✕ dismiss
        </button>
      </div>

      <div className="px-3 pb-3 space-y-3 text-xs text-neutral-700 dark:text-neutral-200">
        {/* ─── Forces ─────────────────────────────────────────────── */}
        <section>
          <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-500 mb-1">
            Forces
          </h4>
          <div className="grid grid-cols-[max-content_1fr_max-content] gap-x-3 font-mono">
            <span className="text-neutral-500">You sent</span>
            <span>
              G{sent.ground} · S{sent.siege} · A{sent.air}
            </span>
            <span className="text-neutral-500">({sentTotal} total)</span>
            <span className="text-neutral-500">Defender had</span>
            <span>
              G{defenderPreAttack.ground} · S{defenderPreAttack.siege} · A
              {defenderPreAttack.air}
            </span>
            <span className="text-neutral-500">({defenderHadTotal} total)</span>
            {totalUnits(defenderBasePreAttack) > 0 && (
              <>
                <span className="text-neutral-500">↳ garrison</span>
                <span className="text-neutral-500 italic">
                  G{defenderBasePreAttack.ground} · S
                  {defenderBasePreAttack.siege} · A
                  {defenderBasePreAttack.air}
                </span>
                <span className="text-neutral-500 italic">
                  ({totalUnits(defenderBasePreAttack)} base)
                </span>
              </>
            )}
            {totalUnits(defenderBasePreAttack) > 0 &&
              defenderHadTotal - totalUnits(defenderBasePreAttack) > 0 && (
                <>
                  <span className="text-neutral-500">↳ reinforcements</span>
                  <span className="text-neutral-500 italic">
                    G
                    {defenderPreAttack.ground - defenderBasePreAttack.ground}
                    {" · "}S
                    {defenderPreAttack.siege - defenderBasePreAttack.siege}
                    {" · "}A
                    {defenderPreAttack.air - defenderBasePreAttack.air}
                  </span>
                  <span className="text-neutral-500 italic">
                    ({defenderHadTotal - totalUnits(defenderBasePreAttack)}{" "}
                    recruited)
                  </span>
                </>
              )}
          </div>
        </section>

        {/* ─── Losses ─────────────────────────────────────────────── */}
        <section>
          <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-500 mb-1">
            Losses
          </h4>
          <div className="grid grid-cols-[max-content_1fr_max-content] gap-x-3 font-mono">
            <span className="text-neutral-500">You lost</span>
            <span>
              G{attackerLost.ground} · S{attackerLost.siege} · A
              {attackerLost.air}
            </span>
            <span className="text-neutral-500">
              ({totalUnits(attackerLost)})
            </span>
            <span className="text-neutral-500">Defender lost</span>
            <span>
              G{defenderLost.ground} · S{defenderLost.siege} · A
              {defenderLost.air}
            </span>
            <span className="text-neutral-500">
              ({totalUnits(defenderLost)})
            </span>
          </div>
        </section>

        {/* ─── Modifiers ─────────────────────────────────────────── */}
        <section>
          <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-500 mb-1">
            Modifiers
          </h4>
          <ul className="list-disc list-inside space-y-0.5">
            {modifiers.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>

        {/* ─── Narrative ─────────────────────────────────────────── */}
        {report.narrative.length > 0 && (
          <section>
            <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-500 mb-1">
              Narrative
            </h4>
            <p className="italic leading-relaxed text-neutral-600 dark:text-neutral-300">
              {report.narrative.join(" ")}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
