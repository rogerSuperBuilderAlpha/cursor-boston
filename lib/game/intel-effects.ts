/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { IntelEffect, IntelEffectKind } from "./types";

// Effects live in their own top-level collection so we can index by ownerId
// + kind without bloating the player or tile docs. Lifetimes are bounded
// (≤5 caster turns) so the collection stays small in practice; expired rows
// can be GC'd by a follow-up sweep job.
const COLLECTION = "game_intel_effects";

// All currently-defined intel-spell debuffs/buffs persist for this many of
// the caster's turns past cast time. Centralized so the spy spells stay in
// step with combat reads.
export const INTEL_EFFECT_DURATION_CASTER_TURNS = 5;

interface RecordArgs {
  tx: Transaction;
  db: Firestore;
  kind: IntelEffectKind;
  ownerId: string;
  casterId: string;
  targetTileId?: string;
  magnitude: number;
  casterTurnsSpentTotalAtCast: number;
  now: Date;
}

/**
 * Persist a new intel effect inside an active transaction. Used by
 * castIntelSpellServer at the moment of cast.
 */
export function recordIntelEffectInTx(args: RecordArgs): IntelEffect {
  const id = randomUUID();
  const expiresAtCasterTurn =
    args.casterTurnsSpentTotalAtCast + INTEL_EFFECT_DURATION_CASTER_TURNS;
  const effect: IntelEffect = {
    id,
    kind: args.kind,
    ownerId: args.ownerId,
    casterId: args.casterId,
    ...(args.targetTileId ? { targetTileId: args.targetTileId } : {}),
    magnitude: args.magnitude,
    expiresAtCasterTurn,
    createdAt: args.now,
  };
  args.tx.set(args.db.collection(COLLECTION).doc(id), effect);
  return effect;
}

interface AttackContextEffects {
  // Sum of `magnitude` values for currently-active "forge-sight-offense"
  // effects owned by `attackerId`, targeting `defenderTileId`. Treat as an
  // additive multiplier: 0.10 → +10% offense.
  forgeSightOffenseBonus: number;
  // Sum of magnitudes for currently-active "alert-vs-caster" effects owned
  // by `defenderId` against `attackerId`. Additive: 0.30 → +30% defense.
  alertVsCasterDefenseBonus: number;
}

/**
 * Read intel effects relevant to a single attack. Run OUTSIDE the attack
 * transaction — slight staleness is acceptable since alerts decay naturally
 * and the caster's own turn count is the trigger for expiry.
 *
 * Two effect classes are aggregated:
 *   - Forge Sight: caster armed against the target tile they're now attacking.
 *   - Alert-vs-caster: defender was alerted by the attacker (Black/Green spy).
 */
export async function readAttackContextEffects(args: {
  db: Firestore;
  attackerId: string;
  attackerTurnsSpentTotal: number;
  defenderId: string;
  defenderTileId: string;
}): Promise<AttackContextEffects> {
  const { db, attackerId, attackerTurnsSpentTotal, defenderId, defenderTileId } =
    args;

  // Two equality clauses each — within Firestore's single-field index defaults,
  // no composite index needed. The remaining filters (targetTileId, casterId)
  // are applied client-side; the result sets are tiny (≤5-turn lifetimes,
  // small per-player effect counts).
  const [forgeSnap, alertSnap] = await Promise.all([
    db
      .collection(COLLECTION)
      .where("ownerId", "==", attackerId)
      .where("kind", "==", "forge-sight-offense")
      .get(),
    db
      .collection(COLLECTION)
      .where("ownerId", "==", defenderId)
      .where("kind", "==", "alert-vs-caster")
      .get(),
  ]);

  let forgeSightOffenseBonus = 0;
  for (const d of forgeSnap.docs) {
    const e = d.data() as IntelEffect;
    if (e.targetTileId !== defenderTileId) continue;
    if (e.casterId !== attackerId) continue;
    if (attackerTurnsSpentTotal < e.expiresAtCasterTurn) {
      forgeSightOffenseBonus += e.magnitude;
    }
  }

  let alertVsCasterDefenseBonus = 0;
  for (const d of alertSnap.docs) {
    const e = d.data() as IntelEffect;
    if (e.casterId !== attackerId) continue;
    if (attackerTurnsSpentTotal < e.expiresAtCasterTurn) {
      alertVsCasterDefenseBonus += e.magnitude;
    }
  }

  return { forgeSightOffenseBonus, alertVsCasterDefenseBonus };
}
