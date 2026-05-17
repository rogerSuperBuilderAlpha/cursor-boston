/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { resolveAttack, makeSeededRng } from "@/lib/game/combat";
import {
  defaultLossPerturbations,
  runAutopsy,
  type AutopsyOutcome,
} from "@/lib/game/zero-turn";
import type {
  CombatAttackerInput,
  CombatDefenderInput,
  CombatTileInput,
  GameAttack,
} from "@/lib/game/types";

interface AttackResponse {
  success: boolean;
  attack?: GameAttack;
  error?: { message?: string } | string;
}

export default function BattleAutopsyPage({
  params,
}: {
  params: Promise<{ attackId: string }>;
}) {
  const { attackId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [attack, setAttack] = useState<GameAttack | null>(null);
  const [autopsy, setAutopsy] = useState<AutopsyOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/game/attacks/${attackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: AttackResponse = await res.json();
      if (!data.success || !data.attack) {
        setError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? `HTTP ${res.status}`
        );
        return;
      }
      setAttack(data.attack);
      // Run autopsy if the attacker lost and we have the pre-attack snapshot.
      const isLoss = data.attack.attackerId === user.uid && data.attack.outcome !== "captured";
      if (isLoss && data.attack.unitsOnTargetPreAttack) {
        const attackerInput: CombatAttackerInput = {
          caste: data.attack.casteAttacker,
          units: data.attack.unitsSent,
          offenseSpellId: data.attack.offenseSpellId,
          magicLandCount: 0,
          unitsAlive: 0, // unknown post-hoc; counterfactual is relative
        };
        const defenderInput: CombatDefenderInput = {
          caste: data.attack.casteDefender,
          unitsOnTile: data.attack.unitsOnTargetPreAttack,
          baseUnitsOnTile: data.attack.baseUnitsOnTargetPreAttack ?? {
            ground: 0,
            siege: 0,
            air: 0,
          },
          armedDefenseSpellId: data.attack.defenseSpellId,
          magicLandCount: 0,
          unitsAlive: 0,
        };
        const tileInput: CombatTileInput = {
          capacity: 9999,
          upgradeIds: [],
        };
        const perturbations = defaultLossPerturbations(data.attack.unitsSent);
        const outcomes = runAutopsy({
          attacker: attackerInput,
          defender: defenderInput,
          tile: tileInput,
          rngSeed: data.attack.rngSeed,
          originalOutcome: data.attack.outcome,
          perturbations,
          resolveAttackFn: resolveAttack,
          rngFactory: makeSeededRng,
        });
        setAutopsy(outcomes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, attackId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  if (authLoading || loading) {
    return <div className="max-w-3xl mx-auto p-6"><p>Loading…</p></div>;
  }
  if (!user) {
    return <div className="max-w-3xl mx-auto p-6"><p>Please sign in.</p></div>;
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Link href="/game/attacks" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
          ← Attack log
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }
  if (!attack) return null;

  const isAttacker = attack.attackerId === user.uid;
  const myOutcome = isAttacker
    ? attack.outcome === "captured"
      ? "victory"
      : "defeat"
    : attack.outcome === "captured"
      ? "defeat"
      : "victory";

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/game/attacks" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
          ← Attack log
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Battle autopsy</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        Attack {attack.id} · You {myOutcome}{" "}
        ({isAttacker ? "as attacker" : "as defender"}) · Outcome:{" "}
        <strong>{attack.outcome}</strong>
      </p>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 mb-4 bg-white dark:bg-neutral-950">
        <h2 className="font-semibold mb-2">Composition</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-neutral-500 uppercase">You sent</div>
            <div>G: {attack.unitsSent.ground}</div>
            <div>S: {attack.unitsSent.siege}</div>
            <div>A: {attack.unitsSent.air}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 uppercase">Defender had</div>
            {attack.unitsOnTargetPreAttack ? (
              <>
                <div>G: {attack.unitsOnTargetPreAttack.ground}</div>
                <div>S: {attack.unitsOnTargetPreAttack.siege}</div>
                <div>A: {attack.unitsOnTargetPreAttack.air}</div>
              </>
            ) : (
              <div className="text-xs text-neutral-500">No snapshot (pre-autopsy attack)</div>
            )}
          </div>
          <div>
            <div className="text-xs text-neutral-500 uppercase">Losses</div>
            <div>
              You: {attack.unitsLostAttacker.ground + attack.unitsLostAttacker.siege + attack.unitsLostAttacker.air}
            </div>
            <div>
              Them: {attack.unitsLostDefender.ground + attack.unitsLostDefender.siege + attack.unitsLostDefender.air}
            </div>
          </div>
        </div>
      </div>

      {autopsy.length > 0 ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h2 className="font-semibold mb-2">What if you had brought more?</h2>
          <ul className="space-y-2 text-sm">
            {autopsy.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={o.outcomeFlipped ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-neutral-600 dark:text-neutral-400"}>
                  {o.outcomeFlipped ? "✓" : "○"}
                </span>
                <span>{o.summary}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500 mt-3">
            Counterfactual runs use the same RNG seed as the original attack
            so the comparison isolates composition effects from luck.
          </p>
        </div>
      ) : isAttacker && attack.outcome !== "captured" ? (
        <p className="text-sm text-neutral-500">
          No autopsy available (older attack predates the snapshot field).
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          Autopsy counterfactuals run for losses; this attack resolved your way.
        </p>
      )}
    </div>
  );
}
