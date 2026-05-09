/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Caste, CombatResult, GameTile } from "@/lib/game/types";

export interface AttackPreviewEffects {
  forgeSightOffenseBonus: number;
  alertVsCasterDefenseBonus: number;
  siegeDebuffMagnitude: number;
  preCastOffenseBonus: number;
  defenseDisarmFraction: number;
}

export interface AttackPreview {
  combat: CombatResult;
  source: GameTile;
  target: GameTile;
  defender: {
    userId: string;
    displayName: string;
    caste: Caste | null;
    shielded: boolean;
  };
  effects: AttackPreviewEffects;
}

interface PreviewArgs {
  sourceTileId: string;
  targetTileId: string;
  units: { ground: number; siege: number; air: number };
  offenseSpellId: string | null;
  // When true, the hook skips the fetch entirely (e.g. attack is gated for
  // a non-recoverable reason like the enemy being shielded). Returns the
  // last good preview or null.
  disabled?: boolean;
  // Bump this key any time a side-effect could have changed server state
  // that the preview reads (siege landed, spell cast, intel-effect
  // expired). The hook will re-fetch whenever this value changes, even
  // when the form-state primitives haven't.
  refreshKey?: number;
}

interface PreviewState {
  preview: AttackPreview | null;
  loading: boolean;
  error: string | null;
}

// Debounce window before we fire the preview fetch. Picked to feel snappy
// while letting users finish dragging a slider before incurring the
// roundtrip.
const DEBOUNCE_MS = 250;

/**
 * Owns the `/api/game/attack/preview` lifecycle for a single ThreatRow.
 * Debounces form-state changes and cancels in-flight requests so a fast
 * scrubber doesn't render an out-of-order projection.
 */
export function useAttackPreview(args: PreviewArgs): PreviewState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PreviewState>({
    preview: null,
    loading: false,
    error: null,
  });

  // Request counter so a slower in-flight preview can't overwrite a newer
  // one when both resolve out of order (a fast scrubber on the units
  // sliders is the realistic stress case).
  const reqIdRef = useRef(0);

  // Compute "should we fetch" outside the effect so the effect body itself
  // is purely a fetch+cleanup loop with no early-return setState calls
  // (which the react-hooks/set-state-in-effect rule rightly flags).
  const totalUnits = args.units.ground + args.units.siege + args.units.air;
  const shouldFetch =
    !authLoading &&
    !!user &&
    !args.disabled &&
    totalUnits > 0 &&
    !!args.sourceTileId &&
    !!args.targetTileId;

  useEffect(() => {
    if (!shouldFetch) return;

    const myReqId = ++reqIdRef.current;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/game/attack/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sourceTileId: args.sourceTileId,
            targetTileId: args.targetTileId,
            units: args.units,
            ...(args.offenseSpellId
              ? { offenseSpellId: args.offenseSpellId }
              : {}),
          }),
        });
        const data = (await res.json()) as
          | (AttackPreview & { success: true })
          | { success: false; error: string };
        // Stale-result guard: if a newer request fired while we waited,
        // discard this response.
        if (cancelled || myReqId !== reqIdRef.current) return;
        if (!data.success) {
          setState({ preview: null, loading: false, error: data.error });
          return;
        }
        setState({
          preview: {
            combat: data.combat,
            source: data.source,
            target: data.target,
            defender: data.defender,
            effects: data.effects,
          },
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled || myReqId !== reqIdRef.current) return;
        setState({
          preview: null,
          loading: false,
          error: e instanceof Error ? e.message : "Preview failed",
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // We deliberately depend on the *primitive* fields rather than the
    // `args` object identity so a parent re-render with the same form
    // values doesn't re-fire the preview. eslint-react-hooks can't see
    // through the destructured primitive deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shouldFetch,
    args.sourceTileId,
    args.targetTileId,
    args.units.ground,
    args.units.siege,
    args.units.air,
    args.offenseSpellId,
    args.refreshKey,
  ]);

  // Separate effect: when fetching is gated off (zero units, disabled, no
  // user), drop any in-flight loading state so the panel doesn't sit
  // forever on "Computing projection…". The no-op short-circuit
  // (`prev.loading ? new : prev`) returns the same prev when not loading,
  // so React skips the update — no cascade. eslint-react-hooks can't see
  // through the short-circuit.
  useEffect(() => {
    if (shouldFetch) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no-op short-circuit on prev.loading prevents the cascade the rule warns about
    setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
  }, [shouldFetch]);

  return state;
}
