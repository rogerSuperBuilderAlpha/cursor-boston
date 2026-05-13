/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { unitsPerCycleForLand } from "@/app/game/recruit/_lib/constants";
import type {
  ArtifactDefinition,
  GameArtifact,
  GamePlayer,
  LandType,
  MapTile,
  SpellDefinition,
  UnitType,
} from "@/lib/game/types";

const LAND_TYPES: { type: LandType; label: string }[] = [
  { type: "military", label: "Military" },
  { type: "food", label: "Food" },
  { type: "magic", label: "Magic" },
  { type: "unassigned", label: "Unassigned" },
];

const UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];

export interface ManageSourcePanelProps {
  source: MapTile;
  player: GamePlayer;
  busy?: boolean;

  defenseSpells: ReadonlyArray<SpellDefinition>;
  defensiveArtifacts: ReadonlyArray<{
    artifact: GameArtifact;
    definition: ArtifactDefinition | null;
  }>;

  onAssign: (type: LandType) => void;
  onRecruit: (type: UnitType) => void;
  onArmDefenseSpell: (spellId: string) => void;
  onUseDefensiveArtifact: (artifactId: string) => void;
}

/**
 * Defense tab content for a ThreatRow: every action that beefs up the
 * source tile. Always expanded (no disclosure) — when the player picks
 * this tab they want every defense lever in front of them.
 *
 * Sections, top → bottom: source summary, assign land type, recruit
 * units, arm defense spell, defense artifacts. Each section gates
 * itself by player resources and skips empty inventories.
 */
export function ManageSourcePanel(props: ManageSourcePanelProps) {
  const {
    source,
    player,
    busy,
    defenseSpells,
    defensiveArtifacts,
    onAssign,
    onRecruit,
    onArmDefenseSpell,
    onUseDefensiveArtifact,
  } = props;

  const yieldPerCycle = unitsPerCycleForLand(source.type);

  return (
    <div className="space-y-4 text-xs">
      {/* Source summary — single line at top so the player always knows
          which of their tiles they're configuring. */}
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
        <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-200">
          {source.tileId}
        </span>
        <span className="text-neutral-500 capitalize">{source.type}</span>
        <span className="font-mono text-neutral-500">
          G{source.units.ground + (source.baseUnits?.ground ?? 0)} S
          {source.units.siege + (source.baseUnits?.siege ?? 0)} A
          {source.units.air + (source.baseUnits?.air ?? 0)}
        </span>
      </div>

      {/* Assign tile type */}
      <Section
        title="Assign tile type"
        meta="1 turn"
        description="Change what this tile produces. Military recruits ground/siege/air; food and magic feed kingdom-wide bonuses."
      >
        <div className="flex flex-wrap gap-1.5">
          {LAND_TYPES.map((a) => {
            const isCurrent = source.type === a.type;
            const cantSpend = player.turnsRemaining < 1;
            const reason = isCurrent
              ? `Already ${a.label.toLowerCase()}`
              : cantSpend
                ? "Need 1 turn"
                : null;
            return (
              <button
                key={a.type}
                onClick={() => onAssign(a.type)}
                disabled={busy || reason !== null}
                title={reason ?? `Set source to ${a.label.toLowerCase()}`}
                className={`px-3 py-1.5 rounded border text-sm ${
                  isCurrent
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                } disabled:opacity-50`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Recruit */}
      <Section
        title="Recruit units"
        meta="5 turns each"
        description={
          yieldPerCycle > 0
            ? `+${yieldPerCycle} of the chosen unit type per cycle on this tile.`
            : "This tile cannot recruit until you assign it a land type above."
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {UNIT_TYPES.map((u) => {
            const reason =
              yieldPerCycle <= 0
                ? "Assign a land type first"
                : player.turnsRemaining < 5
                  ? "Need 5 turns"
                  : null;
            return (
              <button
                key={u}
                onClick={() => onRecruit(u)}
                disabled={busy || reason !== null}
                title={reason ?? `Recruit +${yieldPerCycle} ${u} on source`}
                className="px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 capitalize text-sm"
              >
                +{yieldPerCycle || 10} {u}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Arm defense spell */}
      {defenseSpells.length > 0 && (
        <Section
          title="Arm a defense spell"
          meta="5 turns · triggers when attacked"
          description="Stage one of your caste's defense spells on this tile. It auto-casts the moment an enemy attacks."
        >
          <div className="flex flex-wrap gap-1.5">
            {defenseSpells.map((s) => {
              const reason =
                source.armedDefenseSpellId === s.id
                  ? "Already armed"
                  : player.turnsRemaining < 5
                    ? "Need 5 turns"
                    : player.stats.tilesHeld < s.minTilesRequired
                      ? `Need ${s.minTilesRequired} tiles`
                      : null;
              const armed = source.armedDefenseSpellId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onArmDefenseSpell(s.id)}
                  disabled={busy || reason !== null}
                  title={reason ?? s.description}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded border ${
                    armed
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                      : "border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  } disabled:opacity-50 text-sm`}
                >
                  <CatalogImage entry={s} size="xs" />
                  <span>
                    T{s.tier} {s.name}
                  </span>
                  {armed && (
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      armed
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Defense artifacts */}
      {defensiveArtifacts.length > 0 && (
        <Section
          title="Defense artifacts"
          meta="one-time use"
          description="Bind a defensive artifact to this tile. The bonus consumes the next time you're attacked."
        >
          <div className="flex flex-wrap gap-1.5">
            {defensiveArtifacts.map(({ artifact, definition }) => (
              <button
                key={artifact.id}
                type="button"
                disabled={busy}
                onClick={() => onUseDefensiveArtifact(artifact.id)}
                title={definition?.description ?? artifact.definitionId}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 text-sm"
              >
                <CatalogImage
                  entry={definition ?? { name: artifact.definitionId }}
                  size="xs"
                />
                <span>{definition?.name ?? artifact.definitionId}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  meta,
  description,
  children,
}: {
  title: string;
  meta?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <header className="flex items-baseline gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
          {title}
        </h4>
        {meta && (
          <span className="text-[10px] text-neutral-500">· {meta}</span>
        )}
      </header>
      {description && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}
      {children}
    </section>
  );
}
