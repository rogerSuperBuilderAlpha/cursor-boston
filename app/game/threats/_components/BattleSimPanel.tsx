/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { SPELLS_BY_ID } from "@/lib/game/content";
import type {
  ArtifactDefinition,
  GameArtifact,
  SpellDefinition,
  UnitStack,
} from "@/lib/game/types";
import type { AttackPreview } from "../_lib/use-attack-preview";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { CatalogLore } from "@/app/game/_components/CatalogLore";

export interface BattleSimPanelProps {
  preview: AttackPreview | null;
  loading: boolean;
  error: string | null;
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
  // True when the calling row has determined the attack is structurally
  // impossible (e.g. enemy shielded). The panel renders a muted "preview
  // unavailable" state instead of stale numbers.
  disabled?: boolean;
  disabledReason?: string;
  // Action handlers. Each is independently optional — Phase 4 will wire
  // onCastSpell after Phase 3's spy/siege/flyover ship. Disabled reasons
  // come pre-computed from the parent (turn budget, unit availability,
  // shield, busy) so the panel just renders.
  busy?: boolean;
  spy?: { onClick: () => void; turnCost: number; disabledReason: string | null };
  siege?: { onClick: () => void; turnCost: number; disabledReason: string | null };
  flyover?: {
    onClick: () => void;
    turnCost: number;
    disabledReason: string | null;
    airUnits: number;
  };
  // Expandable spell-cast picker. The player sees three options (siege /
  // disarm / attrition) populated by the parent. Clicking the parent
  // button toggles the picker; clicking a spell row fires onCast.
  castSpell?: {
    spells: ReadonlyArray<{
      spell: SpellDefinition;
      // Pre-computed midpoint magnitude (dice=1.0) so the picker can
      // show the player what to expect on average.
      expectedMagnitude: number;
      // Already-disabled tooltip if the player can't cast this spell
      // (turn budget, tile minimum, etc.). null = clickable.
      disabledReason: string | null;
    }>;
    onCast: (spellId: string) => void;
    turnCost: number;
    disabledReason: string | null;
  };
  // Expandable artifact-use picker. Lets the player spend a relevant
  // offensive/intel artifact from within the attack flow rather than
  // hunting for it in a separate panel — these are one-time-use items
  // whose effects fold into the very next attack.
  useArtifact?: {
    artifacts: ReadonlyArray<{
      artifact: GameArtifact;
      definition: ArtifactDefinition | null;
    }>;
    onUse: (artifactId: string) => void;
    disabledReason: string | null;
  };
}

function totalUnits(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

function fmtStack(s: UnitStack): string {
  return `${s.ground}g ${s.siege}s ${s.air}a`;
}

/**
 * Inline live battle simulation panel for the ThreatRow attack form.
 * Renders the projected combat outcome (midpoint RNG, no commitment) plus
 * a strip of pre-attack action buttons.
 *
 * V1: read-only — the action buttons are present but disabled with a
 * "Coming soon" tooltip. Phases 3 and 4 wire them up.
 */
export function BattleSimPanel({
  preview,
  loading,
  error,
  disabled,
  disabledReason,
  busy,
  spy,
  siege,
  flyover,
  castSpell,
  useArtifact,
  selectedOffenseSpell,
}: BattleSimPanelProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 my-3">
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
        <h4 className="font-semibold uppercase tracking-wide text-[11px] text-neutral-600 dark:text-neutral-300">
          Battle simulation
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

        <ActionButtonStrip
          disabled={disabled}
          busy={busy}
          spy={spy}
          siege={siege}
          flyover={flyover}
          castSpell={castSpell}
          useArtifact={useArtifact}
        />
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

      {/* Tile-type modifiers — only show when non-neutral. Same vocab as
          BattleReport so post-attack and pre-attack copy match. */}
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

interface ActionButton {
  key: string;
  label: string;
  onClick?: () => void;
  disabled: boolean;
  title: string;
}

function ActionButtonStrip({
  disabled,
  busy,
  spy,
  siege,
  flyover,
  castSpell,
  useArtifact,
}: {
  disabled?: boolean;
  busy?: boolean;
  spy?: BattleSimPanelProps["spy"];
  siege?: BattleSimPanelProps["siege"];
  flyover?: BattleSimPanelProps["flyover"];
  castSpell?: BattleSimPanelProps["castSpell"];
  useArtifact?: BattleSimPanelProps["useArtifact"];
}) {
  const [castOpen, setCastOpen] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);

  const wholePanelDisabledReason = disabled
    ? "Preview disabled — pre-actions unavailable."
    : busy
      ? "Another action is in progress…"
      : null;

  const buttons: ActionButton[] = [];
  if (spy) {
    const reason = wholePanelDisabledReason ?? spy.disabledReason;
    buttons.push({
      key: "spy",
      label: `Spy +${spy.turnCost}T`,
      onClick: reason ? undefined : spy.onClick,
      disabled: reason !== null,
      title: reason ?? `Cast intel spell · ${spy.turnCost} turns`,
    });
  }
  if (siege) {
    const reason = wholePanelDisabledReason ?? siege.disabledReason;
    buttons.push({
      key: "siege",
      label: `Siege +${siege.turnCost}T`,
      onClick: reason ? undefined : siege.onClick,
      disabled: reason !== null,
      title: reason ?? `Soften standing defense · ${siege.turnCost} turns`,
    });
  }
  if (flyover) {
    const reason = wholePanelDisabledReason ?? flyover.disabledReason;
    buttons.push({
      key: "flyover",
      label: `Flyover (${flyover.airUnits}a) +${flyover.turnCost}T`,
      onClick: reason ? undefined : flyover.onClick,
      disabled: reason !== null,
      title:
        reason ??
        `Send ${flyover.airUnits} air to attrit defenders · 2× attacker losses · ${flyover.turnCost} turn`,
    });
  }
  if (castSpell) {
    const reason = wholePanelDisabledReason ?? castSpell.disabledReason;
    buttons.push({
      key: "cast",
      label: `Cast +${castSpell.turnCost}T ${castOpen ? "▾" : "▸"}`,
      onClick: reason ? undefined : () => setCastOpen((o) => !o),
      disabled: reason !== null,
      title:
        reason ??
        `Pick a siege/disarm/attrition spell · ${castSpell.turnCost} turns`,
    });
  }
  if (useArtifact && useArtifact.artifacts.length > 0) {
    const reason = wholePanelDisabledReason ?? useArtifact.disabledReason;
    buttons.push({
      key: "artifact",
      label: `Artifact (${useArtifact.artifacts.length}) ${
        artifactOpen ? "▾" : "▸"
      }`,
      onClick: reason ? undefined : () => setArtifactOpen((o) => !o),
      disabled: reason !== null,
      title:
        reason ??
        `Spend a one-time artifact whose effect rolls into your next attack`,
    });
  }
  if (buttons.length === 0) {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {[
          { label: "Spy +5T", note: "Not wired" },
          { label: "Siege +5T", note: "Not wired" },
          { label: "Flyover ▸", note: "Not wired" },
          { label: "Cast ▸", note: "Not wired" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            disabled
            title={b.note}
            className="px-3 py-1 text-[11px] rounded border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 cursor-not-allowed"
          >
            {b.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 pt-1">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={b.onClick}
            disabled={b.disabled}
            title={b.title}
            className={`px-3 py-1 text-[11px] rounded border transition-colors ${
              b.disabled
                ? "border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 cursor-not-allowed"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {castOpen && castSpell && (
        <CastSpellPicker
          castSpell={castSpell}
          wholePanelDisabledReason={wholePanelDisabledReason}
          onAfterCast={() => setCastOpen(false)}
        />
      )}
      {artifactOpen && useArtifact && (
        <UseArtifactPicker
          useArtifact={useArtifact}
          wholePanelDisabledReason={wholePanelDisabledReason}
          onAfterUse={() => setArtifactOpen(false)}
        />
      )}
    </div>
  );
}

function UseArtifactPicker({
  useArtifact,
  wholePanelDisabledReason,
  onAfterUse,
}: {
  useArtifact: NonNullable<BattleSimPanelProps["useArtifact"]>;
  wholePanelDisabledReason: string | null;
  onAfterUse: () => void;
}) {
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
        Spend an artifact · one-time use · effect rolls into your next attack
      </div>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
        {useArtifact.artifacts.map((entry) => {
          const blocked = wholePanelDisabledReason !== null;
          const def = entry.definition;
          const kindLabel =
            def?.type === "offense"
              ? "⚔ Offense"
              : def?.type === "intel"
                ? "🔎 Intel"
                : def?.type === "defense"
                  ? "🛡 Defense"
                  : "✨ Artifact";
          return (
            <li key={entry.artifact.id}>
              <button
                type="button"
                disabled={blocked}
                title={wholePanelDisabledReason ?? def?.description ?? entry.artifact.definitionId}
                onClick={() => {
                  if (blocked) return;
                  useArtifact.onUse(entry.artifact.id);
                  onAfterUse();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[11px] transition-colors ${
                  blocked
                    ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <CatalogImage
                  entry={def ?? { name: entry.artifact.definitionId }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium shrink-0">{kindLabel}</span>
                    <span className="truncate">
                      · {def?.name ?? entry.artifact.definitionId}
                    </span>
                    <span className="ml-auto font-mono text-neutral-500 shrink-0 capitalize">
                      {entry.artifact.rarity}
                    </span>
                  </div>
                  {def?.description ? (
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                      {def.description}
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CastSpellPicker({
  castSpell,
  wholePanelDisabledReason,
  onAfterCast,
}: {
  castSpell: NonNullable<BattleSimPanelProps["castSpell"]>;
  wholePanelDisabledReason: string | null;
  onAfterCast: () => void;
}) {
  function fmtMagnitude(spell: SpellDefinition, expected: number): string {
    if (spell.type === "siege") {
      return `~−${(expected * 100).toFixed(0)}% standing floor`;
    }
    if (spell.type === "disarm") {
      return `~${(Math.min(1, expected) * 100).toFixed(0)}% disarm`;
    }
    if (spell.type === "attrition") {
      return `~${Math.round(expected)} enemies lost`;
    }
    return "";
  }
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
        Choose spell · {castSpell.turnCost} turns each · dice 0.5–1.5×
      </div>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
        {castSpell.spells.map((entry) => {
          const reason = wholePanelDisabledReason ?? entry.disabledReason;
          const blocked = reason !== null;
          const labelKind =
            entry.spell.type === "siege"
              ? "🏰 Siege"
              : entry.spell.type === "disarm"
                ? "✨ Disarm"
                : "☠ Attrition";
          return (
            <li key={entry.spell.id}>
              <button
                type="button"
                disabled={blocked}
                title={reason ?? "Cast this spell on the target"}
                onClick={() => {
                  if (blocked) return;
                  castSpell.onCast(entry.spell.id);
                  onAfterCast();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[11px] transition-colors ${
                  blocked
                    ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="font-medium shrink-0">{labelKind}</span>
                  <span className="truncate">· {entry.spell.name}</span>
                </span>
                <span className="font-mono text-neutral-500 shrink-0">
                  {fmtMagnitude(entry.spell, entry.expectedMagnitude)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
