/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import type {
  ArtifactDefinition,
  GameArtifact,
  SpellDefinition,
} from "@/lib/game/types";

type TabId = "artifact" | "spy" | "siege" | "flyover";

export interface BoostPanelProps {
  busy?: boolean;

  /** Artifacts the player can spend before this attack. Each row carries
   *  both the instance + its definition so the picker can render image,
   *  name, rarity, description. Buckets are kept separate so we can
   *  surface "intel" under the Spy tab and "offense" under Artifacts. */
  offensiveArtifacts: ReadonlyArray<{
    artifact: GameArtifact;
    definition: ArtifactDefinition | null;
  }>;
  intelArtifacts: ReadonlyArray<{
    artifact: GameArtifact;
    definition: ArtifactDefinition | null;
  }>;
  /** The artifact id currently *queued* for the upcoming attack. Empty
   *  string means nothing queued. The parent owns this state and clears
   *  it once the attack actually fires (consuming the artifact). */
  queuedArtifactId: string;
  /** Toggles which offensive artifact is queued. Click the same card
   *  again to clear. Queuing does NOT consume the artifact — the
   *  consumption only happens when the parent fires the attack. */
  onQueueArtifact: (artifactId: string) => void;
  /** Intel-tab artifacts (under Spy intel) are reveals — they fire
   *  immediately because the player needs the info before deciding to
   *  attack. Distinct path from queueable offensive artifacts. */
  onUseIntelArtifact: (artifactId: string) => void;

  /** Spy intel spell (single-spell action, distinct from intel artifacts). */
  spy?: {
    spell: SpellDefinition;
    onClick: () => void;
    disabledReason: string | null;
  };

  /** Pre-attack siege action — reduces the enemy tile's standing defense. */
  siege?: {
    onClick: () => void;
    turnCost: number;
    disabledReason: string | null;
  };

  /** Alternate air-only attack that attrits defenders without committing
   *  the rest of the army. Air units available on the source tile drive
   *  whether this is castable. */
  flyover?: {
    onClick: () => void;
    turnCost: number;
    airUnits: number;
    disabledReason: string | null;
  };
}

/**
 * Unified "boost your odds" panel. Replaces three older pieces — the
 * action button strip inside BattleSimPanel, the offensive-artifact grid,
 * and the intel-artifact grid — with a single tabbed picker. Each tab
 * is only surfaced when there's actually something castable inside,
 * so a row with no spy spell + no air units + no spells doesn't render
 * a wall of empty buttons.
 */
export function BoostPanel(props: BoostPanelProps) {
  const tabs = buildTabList(props);
  const [active, setActive] = useState<TabId | null>(tabs[0]?.id ?? null);

  if (tabs.length === 0) {
    return null;
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <section className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden h-full flex flex-col">
      <header className="px-3 py-2 border-b border-amber-200 dark:border-amber-900 flex items-baseline justify-between shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          ✨ Boost your odds
        </h3>
        <span className="text-[10px] text-amber-700/60 dark:text-amber-300/60">
          optional · spent before the attack
        </span>
      </header>

      <div className="flex flex-wrap gap-1 px-2 pt-2 border-b border-amber-200/60 dark:border-amber-900/60 shrink-0">
        {tabs.map((tab) => {
          const isActive = current?.id === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`px-3 py-1 text-xs rounded-t-md font-medium transition-colors ${
                isActive
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-x border-t border-amber-200 dark:border-amber-900"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-1.5 text-[10px] text-neutral-400">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-3 flex-1">
        {current?.id === "artifact" && (
          <ArtifactTab
            artifacts={props.offensiveArtifacts}
            busy={props.busy}
            mode="queue"
            selectedId={props.queuedArtifactId}
            onSelect={props.onQueueArtifact}
            emptyLabel="No offensive artifacts in your inventory."
            kindLabel="Offensive"
            accent="red"
          />
        )}
        {current?.id === "spy" && (
          <SpyTab
            spy={props.spy}
            intelArtifacts={props.intelArtifacts}
            busy={props.busy}
            onUseArtifact={props.onUseIntelArtifact}
          />
        )}
        {current?.id === "siege" && props.siege && (
          <SimpleActionTab
            label={`Siege (+${props.siege.turnCost}T)`}
            description="Reduce the enemy tile's standing defense floor before your next swing. Stacks with offensive spells."
            onClick={props.siege.onClick}
            disabledReason={props.siege.disabledReason}
            busy={props.busy}
            tone="amber"
          />
        )}
        {current?.id === "flyover" && props.flyover && (
          <SimpleActionTab
            label={`Flyover (${props.flyover.airUnits}a, +${props.flyover.turnCost}T)`}
            description={`Send your ${props.flyover.airUnits} air units to attrit the defenders without committing your ground/siege. Attacker losses are 2× by design.`}
            onClick={props.flyover.onClick}
            disabledReason={props.flyover.disabledReason}
            busy={props.busy}
            tone="sky"
          />
        )}
      </div>
    </section>
  );
}

interface Tab {
  id: TabId;
  label: string;
  badge?: number | string;
}

function buildTabList(props: BoostPanelProps): Tab[] {
  const list: Tab[] = [];
  if (props.offensiveArtifacts.length > 0) {
    list.push({
      id: "artifact",
      label: "Artifacts",
      badge: props.offensiveArtifacts.length,
    });
  }
  if (props.spy || props.intelArtifacts.length > 0) {
    const badge =
      (props.spy ? 1 : 0) + props.intelArtifacts.length;
    list.push({
      id: "spy",
      label: "Spy intel",
      badge: badge > 0 ? badge : undefined,
    });
  }
  if (props.siege) {
    list.push({ id: "siege", label: "Siege" });
  }
  if (props.flyover && props.flyover.airUnits > 0) {
    list.push({ id: "flyover", label: "Flyover" });
  }
  return list;
}

/**
 * Artifact grid. Two modes:
 *   - `mode="queue"` — clicking toggles `selectedId`; the artifact is
 *     NOT consumed until the parent fires the attack. Used for the
 *     offensive Artifacts tab.
 *   - `mode="use"`  — clicking fires `onSelect` once as an immediate
 *     server action (the parent calls the use-artifact API). Used for
 *     intel artifacts under the Spy tab — those reveal info now.
 */
function ArtifactTab({
  artifacts,
  busy,
  mode,
  selectedId,
  onSelect,
  emptyLabel,
  kindLabel,
  accent,
}: {
  artifacts: ReadonlyArray<{
    artifact: GameArtifact;
    definition: ArtifactDefinition | null;
  }>;
  busy?: boolean;
  mode: "queue" | "use";
  selectedId?: string;
  onSelect: (artifactId: string) => void;
  emptyLabel: string;
  kindLabel: string;
  accent: "red" | "violet";
}) {
  if (artifacts.length === 0) {
    return <p className="text-xs text-neutral-500 italic">{emptyLabel}</p>;
  }
  const baseTone =
    accent === "red"
      ? "border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
      : "border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30";
  const selectedTone =
    accent === "red"
      ? "border-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-400/60"
      : "border-violet-400 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-400/60";
  const blurb =
    mode === "queue"
      ? "Queue one — the bonus consumes when you click Attack."
      : "One-time use — fires immediately and reveals intel.";
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
        {blurb}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {artifacts.map(({ artifact, definition }) => {
          const isSelected = mode === "queue" && selectedId === artifact.id;
          return (
            <button
              key={artifact.id}
              type="button"
              disabled={busy}
              // In queue mode, clicking the already-selected card clears
              // the selection. In use mode, every click fires once.
              onClick={() =>
                onSelect(mode === "queue" && isSelected ? "" : artifact.id)
              }
              title={definition?.description ?? artifact.definitionId}
              className={`flex items-start gap-2 p-2 text-left text-xs border rounded-md transition-colors disabled:opacity-50 ${
                isSelected ? selectedTone : baseTone
              }`}
            >
              <CatalogImage entry={definition ?? { name: artifact.definitionId }} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium truncate">
                    {definition?.name ?? artifact.definitionId}
                  </span>
                  <span className="text-[10px] capitalize text-neutral-500 shrink-0">
                    {isSelected ? "queued" : `${kindLabel} · ${artifact.rarity}`}
                  </span>
                </div>
                {definition?.description && (
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">
                    {definition.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpyTab({
  spy,
  intelArtifacts,
  busy,
  onUseArtifact,
}: {
  spy: BoostPanelProps["spy"];
  intelArtifacts: BoostPanelProps["intelArtifacts"];
  busy?: boolean;
  onUseArtifact: (id: string) => void;
}) {
  const empty = !spy && intelArtifacts.length === 0;
  if (empty) {
    return (
      <p className="text-xs text-neutral-500 italic">
        No caste intel spell or intel artifacts available.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {spy && (
        <div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1.5">
            Cast your caste intel spell on the enemy tile.
          </p>
          <button
            type="button"
            disabled={busy || spy.disabledReason !== null}
            title={spy.disabledReason ?? spy.spell.description}
            onClick={spy.onClick}
            className="flex items-start gap-2 p-2 text-left text-xs border rounded-md border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50 w-full"
          >
            <CatalogImage entry={spy.spell} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  🔎 Spy · T{spy.spell.tier} {spy.spell.name}
                </span>
                <span className="text-[10px] text-violet-700 dark:text-violet-300 shrink-0">
                  +{spy.spell.turnCost}T
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">
                {spy.spell.description}
              </p>
            </div>
          </button>
        </div>
      )}
      {intelArtifacts.length > 0 && (
        <ArtifactTab
          artifacts={intelArtifacts}
          busy={busy}
          mode="use"
          onSelect={onUseArtifact}
          emptyLabel=""
          kindLabel="Intel"
          accent="violet"
        />
      )}
    </div>
  );
}

function SimpleActionTab({
  label,
  description,
  onClick,
  disabledReason,
  busy,
  tone,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabledReason: string | null;
  busy?: boolean;
  tone: "amber" | "sky";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
      : "border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/30";
  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-700 dark:text-neutral-300">{description}</p>
      <button
        type="button"
        disabled={busy || disabledReason !== null}
        title={disabledReason ?? label}
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors disabled:opacity-50 ${cls}`}
      >
        {label}
      </button>
      {disabledReason && (
        <p className="text-[11px] text-neutral-500">{disabledReason}</p>
      )}
    </div>
  );
}
