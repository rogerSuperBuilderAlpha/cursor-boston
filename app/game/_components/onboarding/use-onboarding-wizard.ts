/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type {
  ArmyTotals,
  LandCounts,
} from "@/app/game/_lib/dashboard-types";
import type { Caste, GamePlayer, MapTile } from "@/lib/game/types";

export type OnboardingStep =
  | "explore"
  | "distribute"
  | "caste"
  | "recruit"
  | "done";

/**
 * Pure step-derivation. Given the current player + derived counts/army,
 * returns which wizard page should render. Used by the wizard component
 * AND by tests to assert the funnel logic without mounting React.
 *
 * Order matches the user's onboarding ramp:
 *   1. explore   — fog of war over claimed tiles (phase === "explore")
 *   2. distribute — assign land types (any unassigned remaining)
 *   3. caste     — pick a starter caste
 *   4. recruit   — first build cycle to plant an army
 *   5. done      — graduated; wizard hides
 */
export function pickCurrentStep(
  player: GamePlayer,
  counts: LandCounts,
  army: ArmyTotals
): OnboardingStep {
  if (player.phase === "explore") return "explore";
  if (player.phase === "distribute" && counts.unassigned > 0) {
    return "distribute";
  }
  if (player.caste === null) return "caste";
  if (
    player.phase === "play" &&
    army.total === 0 &&
    counts.military > 0
  ) {
    return "recruit";
  }
  return "done";
}

interface Args {
  user: User | null;
  player: GamePlayer | null;
  counts: LandCounts;
  army: ArmyTotals;
  tiles: ReadonlyArray<MapTile>;
  /** Refresh callback from useDashboardData — rerun after each successful
   *  action so the player/tiles/counts reflect the new state. */
  onRefresh: () => Promise<void>;
}

export interface OnboardingWizardState {
  /** Whether the modal should be rendered as open. */
  isOpen: boolean;
  /** Current page (deterministic; recomputed on every render from
   *  player+counts+army). */
  step: OnboardingStep;
  /** True while an in-flight API call is processing. */
  busy: boolean;
  /** Most-recent error from a failed action, surfaced inline. */
  error: string | null;
  /** Per-batch progress for the explore step. */
  exploreProgress: { done: number; total: number } | null;
  /** Soft-dismiss the modal for the current page-load (re-pops on
   *  reload until the player graduates). */
  dismiss: () => void;
  /** Reveal `count` tiles via /api/game/setup/explore. */
  runExplore: (count: number) => Promise<void>;
  /** One-click 33/33/34 split via 3 sequential POSTs to
   *  /api/game/distribute/bulk. */
  runAutoBalance: () => Promise<void>;
  /** Lock initial caste via /api/game/setup/caste. */
  pickCaste: (caste: Caste) => Promise<void>;
  /** Recruit one cycle of ground units on the first owned military
   *  tile via /api/game/build. */
  runRecruit: () => Promise<void>;
}

/**
 * Onboarding-wizard state machine. Combines the rising-edge auto-open
 * behaviour from SetupReadinessModal with action helpers that wrap the
 * existing setup endpoints. Designed to mount once at the dashboard
 * root and observe player state — no localStorage, no per-step
 * navigation state (the step is derived from the canonical phase +
 * caste + counts).
 */
export function useOnboardingWizard({
  user,
  player,
  counts,
  army,
  tiles,
  onRefresh,
}: Args): OnboardingWizardState {
  const step: OnboardingStep = player
    ? pickCurrentStep(player, counts, army)
    : "done";
  const shouldBeOpen = player !== null && step !== "done";

  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exploreProgress, setExploreProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // Rising-edge: only auto-open when shouldBeOpen flips false → true.
  // Once the user soft-dismisses, isOpen stays false even if shouldBeOpen
  // is still true; another reload (which resets this hook) will re-open.
  // Mirrors SetupReadinessModal's rising-edge pattern; the lint rule
  // flags setState-in-effect which is correct for the auto-close branch
  // — that branch is the canonical "external state changed, mirror into
  // local state" case.
  const wasOpenRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (shouldBeOpen && !wasOpenRef.current) {
      setIsOpen(true);
      wasOpenRef.current = true;
    } else if (!shouldBeOpen) {
      setIsOpen(false);
      wasOpenRef.current = false;
    }
  }, [shouldBeOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dismiss = useCallback(() => {
    setIsOpen(false);
  }, []);

  const callApi = useCallback(
    async (path: string, body?: unknown) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(
            data.error?.message ?? data.error ?? "Action failed"
          );
        }
        await onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [user, onRefresh]
  );

  const runExplore = useCallback(
    async (count: number) => {
      if (!user) return;
      const total = Math.max(1, Math.min(100, Math.floor(count)));
      setBusy(true);
      setError(null);
      setExploreProgress({ done: 0, total });
      try {
        const token = await user.getIdToken();
        for (let i = 0; i < total; i++) {
          const res = await fetch("/api/game/setup/explore", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (!data.success) {
            const msg =
              data.error?.message ?? data.error ?? "Exploration failed";
            setError(`Stopped at ${i} / ${total}: ${msg}`);
            break;
          }
          setExploreProgress({ done: i + 1, total });
        }
        await onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
        setExploreProgress(null);
      }
    },
    [user, onRefresh]
  );

  const runAutoBalance = useCallback(async () => {
    // Determine target counts for ~33/33/34 (military/food/magic) across
    // the player's distributable tiles. Uses the post-explore tile set
    // from the dashboard data (revealed tiles only — `unrevealed` should
    // not exist at this point, but skip them defensively).
    const distributable = tiles.filter(
      (t) => t.type !== "unrevealed" && t.ownerId === player?.userId
    );
    const ids = distributable.map((t) => t.tileId);
    const n = ids.length;
    if (n === 0) {
      setError("No tiles available to distribute");
      return;
    }
    // Split into three buckets — remainder rolls into magic so the sum
    // equals N exactly.
    const milN = Math.floor(n / 3);
    const foodN = Math.floor(n / 3);
    const military = ids.slice(0, milN);
    const food = ids.slice(milN, milN + foodN);
    const magic = ids.slice(milN + foodN);
    setBusy(true);
    setError(null);
    try {
      // Three sequential POSTs — the bulk endpoint accepts up to 100
      // tile ids per call which fits since we cap at NEW_PLAYER_TILE_COUNT
      // = 100 total.
      const token = await user!.getIdToken();
      const callBulk = async (
        tileIds: string[],
        type: "military" | "food" | "magic"
      ) => {
        if (tileIds.length === 0) return;
        const res = await fetch("/api/game/distribute/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tileIds, type }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(
            data.error?.message ?? data.error ?? "Distribute failed"
          );
        }
      };
      await callBulk(military, "military");
      await callBulk(food, "food");
      await callBulk(magic, "magic");
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, [user, player, tiles, onRefresh]);

  const pickCaste = useCallback(
    async (caste: Caste) => {
      await callApi("/api/game/setup/caste", { caste });
    },
    [callApi]
  );

  const runRecruit = useCallback(async () => {
    // Pick the first owned military tile and run one build cycle of
    // ground units (5 turns → +10 ground per BUILD_UNITS_PER_TURN_BY_LAND).
    const target = tiles.find(
      (t) => t.ownerId === player?.userId && t.type === "military"
    );
    if (!target) {
      setError("No military tile found — assign one first");
      return;
    }
    await callApi("/api/game/build", {
      tileId: target.tileId,
      unitType: "ground",
    });
  }, [tiles, player, callApi]);

  return {
    isOpen,
    step,
    busy,
    error,
    exploreProgress,
    dismiss,
    runExplore,
    runAutoBalance,
    pickCaste,
    runRecruit,
  };
}
