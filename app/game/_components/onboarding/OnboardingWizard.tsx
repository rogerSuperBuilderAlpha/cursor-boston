/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { CheckCircle2, Compass, Map, Sparkles, Sword, X } from "lucide-react";
import type { User } from "firebase/auth";
import { CastePickCard } from "@/app/game/setup/_components/CastePickCard";
import { CASTES } from "@/app/game/setup/_lib/constants";
import type {
  ArmyTotals,
  LandCounts,
} from "@/app/game/_lib/dashboard-types";
import type { Caste, GamePlayer, MapTile } from "@/lib/game/types";
import {
  pickCurrentStep,
  useOnboardingWizard,
  type OnboardingStep,
} from "./use-onboarding-wizard";

interface Props {
  user: User | null;
  player: GamePlayer | null;
  counts: LandCounts;
  army: ArmyTotals;
  tiles: ReadonlyArray<MapTile>;
  onRefresh: () => Promise<void>;
}

const STEP_LABELS: Record<Exclude<OnboardingStep, "done">, string> = {
  explore: "Explore",
  distribute: "Distribute",
  caste: "Caste",
  recruit: "Recruit",
};

const STEP_ORDER: ReadonlyArray<Exclude<OnboardingStep, "done">> = [
  "explore",
  "distribute",
  "caste",
  "recruit",
];

/**
 * First-run modal wizard mounted on the dashboard. Walks new players
 * through:
 *
 *   1. Explore — reveal claimed tiles via /api/game/setup/explore
 *   2. Distribute — auto-balance 33/33/34 across military/food/magic
 *   3. Caste — pick a starting caste
 *   4. Recruit — first build cycle on a military tile
 *
 * Auto-derives the current step from `player.phase`/`caste` + counts.
 * Soft-dismiss only — re-pops on each visit until the player graduates.
 */
export function OnboardingWizard({
  user,
  player,
  counts,
  army,
  tiles,
  onRefresh,
}: Props) {
  const wizard = useOnboardingWizard({
    user,
    player,
    counts,
    army,
    tiles,
    onRefresh,
  });

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (wizard.isOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [wizard.isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && wizard.isOpen) wizard.dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wizard]);

  const handleDismiss = useCallback(() => wizard.dismiss(), [wizard]);

  if (!wizard.isOpen || !player) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl md:p-8">
        <button
          ref={closeButtonRef}
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Dismiss onboarding wizard"
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>

        <h2
          id="onboarding-wizard-title"
          className="pr-8 text-xl font-bold text-white md:text-2xl"
        >
          Build your kingdom
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Four quick steps. We&apos;ll leave you with about 100 turns to
          actually play.
        </p>

        <StepRibbon current={wizard.step} />

        <div className="mt-6">
          {wizard.step === "explore" && (
            <ExploreStep
              tilesExplored={player.tilesExplored}
              turnsRemaining={player.turnsRemaining}
              busy={wizard.busy}
              progress={wizard.exploreProgress}
              onExplore={wizard.runExplore}
            />
          )}
          {wizard.step === "distribute" && (
            <DistributeStep
              counts={counts}
              busy={wizard.busy}
              onAutoBalance={wizard.runAutoBalance}
            />
          )}
          {wizard.step === "caste" && (
            <CasteStep busy={wizard.busy} onPickCaste={wizard.pickCaste} />
          )}
          {wizard.step === "recruit" && (
            <RecruitStep
              busy={wizard.busy}
              counts={counts}
              turnsRemaining={player.turnsRemaining}
              onRecruit={wizard.runRecruit}
            />
          )}
        </div>

        {wizard.error && (
          <p className="mt-4 rounded-lg border border-red-700/60 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {wizard.error}
          </p>
        )}

        <button
          onClick={handleDismiss}
          className="mt-6 w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-300 focus-visible:text-white focus-visible:underline focus-visible:outline-none"
        >
          I&apos;ll come back to this
        </button>
      </div>
    </div>
  );
}

// Re-export so other code (DashboardView) only needs to import from the
// wizard file itself.
export { pickCurrentStep };

// ---------------------------------------------------------------------------
// Step ribbon — shows [1 Explore] [2 Distribute] [3 Caste] [4 Recruit] with
// the current step highlighted and earlier steps marked complete.
// ---------------------------------------------------------------------------

function StepRibbon({ current }: { current: OnboardingStep }) {
  const currentIdx =
    current === "done" ? STEP_ORDER.length : STEP_ORDER.indexOf(current);
  return (
    <ol className="mt-4 flex items-center gap-2 text-xs">
      {STEP_ORDER.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <li
            key={step}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
              isCurrent
                ? "bg-emerald-500 text-white"
                : isDone
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-neutral-800 text-neutral-500"
            }`}
          >
            {isDone ? (
              <CheckCircle2
                className="h-3.5 w-3.5"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            ) : (
              <span className="font-mono">{idx + 1}</span>
            )}
            <span className="font-semibold">{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Explore
// ---------------------------------------------------------------------------

interface ExploreStepProps {
  tilesExplored: number;
  turnsRemaining: number;
  busy: boolean;
  progress: { done: number; total: number } | null;
  onExplore: (count: number) => Promise<void>;
}

function ExploreStep({
  tilesExplored,
  turnsRemaining,
  busy,
  progress,
  onExplore,
}: ExploreStepProps) {
  const remaining = Math.max(0, 100 - tilesExplored);
  const canExploreAll = turnsRemaining >= remaining && remaining > 0;
  const canExplore25 = turnsRemaining >= Math.min(25, remaining) && remaining > 0;
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Compass className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Step 1 — Reveal your starting lands
      </header>
      <p className="text-sm leading-relaxed text-neutral-300">
        You&apos;ve claimed 100 hex tiles, but they&apos;re hidden under fog.
        Reveal them so you can decide what to do with each. Each reveal
        costs <strong>1 turn</strong>.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
        <Stat label="Tiles revealed" value={`${tilesExplored} / 100`} />
        <Stat label="Tiles remaining" value={`${remaining}`} />
        <Stat label="Turns left" value={`${turnsRemaining}`} />
      </div>
      {progress ? (
        <p className="mt-4 text-center text-sm text-emerald-300">
          Revealing… {progress.done} / {progress.total}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => void onExplore(Math.min(25, remaining))}
          disabled={busy || !canExplore25}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Explore 25 tiles
        </button>
        <button
          onClick={() => void onExplore(remaining)}
          disabled={busy || !canExploreAll}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reveal all {remaining} tiles
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Distribute (auto-balance)
// ---------------------------------------------------------------------------

interface DistributeStepProps {
  counts: LandCounts;
  busy: boolean;
  onAutoBalance: () => Promise<void>;
}

function DistributeStep({ counts, busy, onAutoBalance }: DistributeStepProps) {
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Map className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Step 2 — Set up your land
      </header>
      <p className="text-sm leading-relaxed text-neutral-300">
        Each tile becomes a <strong>military</strong> (recruits faster),{" "}
        <strong>food</strong> (raises your unit cap), or{" "}
        <strong>magic</strong> (boosts your spells). A balanced 1/3 split is
        a strong default — you can always re-balance later.
      </p>
      <div className="mt-4 grid grid-cols-4 gap-3 text-center text-xs">
        <Stat label="Military" value={`${counts.military}`} />
        <Stat label="Food" value={`${counts.food}`} />
        <Stat label="Magic" value={`${counts.magic}`} />
        <Stat label="Unassigned" value={`${counts.unassigned}`} />
      </div>
      <div className="mt-5">
        <button
          onClick={() => void onAutoBalance()}
          disabled={busy || counts.unassigned === 0}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Auto-balance 33 / 33 / 34
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Or fine-tune any time on{" "}
        <span className="font-mono">/game/setup</span>.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Caste
// ---------------------------------------------------------------------------

interface CasteStepProps {
  busy: boolean;
  onPickCaste: (caste: Caste) => Promise<void>;
}

function CasteStep({ busy, onPickCaste }: CasteStepProps) {
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Step 3 — Pick your caste
      </header>
      <p className="text-sm leading-relaxed text-neutral-300">
        Each caste has its own units, spells, and identity. Pick the
        playstyle that calls to you — this first pick is{" "}
        <strong>experimental</strong>: once you reach{" "}
        <strong>1,000 tiles</strong>, you can switch castes one time, and
        that second pick is permanent.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {CASTES.map((c) => (
          <CastePickCard
            key={c}
            caste={c}
            busy={busy}
            onChoose={() => void onPickCaste(c)}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Recruit
// ---------------------------------------------------------------------------

interface RecruitStepProps {
  busy: boolean;
  counts: LandCounts;
  turnsRemaining: number;
  onRecruit: () => Promise<void>;
}

function RecruitStep({
  busy,
  counts,
  turnsRemaining,
  onRecruit,
}: RecruitStepProps) {
  const canRecruit = counts.military > 0 && turnsRemaining >= 5;
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Sword className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        Step 4 — Plant your first army
      </header>
      <p className="text-sm leading-relaxed text-neutral-300">
        Run one recruit cycle on a military tile —{" "}
        <strong>5 turns → +10 ground units</strong>. They&apos;ll defend
        your tile and let you start attacking neighbors.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-xs">
        <Stat label="Military tiles" value={`${counts.military}`} />
        <Stat label="Turns left" value={`${turnsRemaining}`} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => void onRecruit()}
          disabled={busy || !canRecruit}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Recruit +10 ground (5 turns)
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Or close this and recruit on your own at{" "}
        <span className="font-mono">/game/recruit</span>.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiny shared stat tile
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}
