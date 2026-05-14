/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  SIEGE_DEBUFF_MAX_MAGNITUDE,
  type IntelEffect,
  type IntelEffectKind,
} from "./types";

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
  // Sum of "siege-debuff" magnitudes (clamped to SIEGE_DEBUFF_MAX_MAGNITUDE)
  // owned by `attackerId` against `defenderTileId`. Subtracted from the
  // tile's standing-defense floor in resolveAttack. NOT consumed on attack.
  siegeDebuffMagnitude: number;
  // Realized power from "pre-cast-offense-spell" effects owned by
  // `attackerId` targeting `defenderTileId`. Added flat to attackPower.
  // SINGLE-USE: ids returned in `consumeEffectIds` should be deleted by
  // the attack transaction.
  preCastOffenseBonus: number;
  // Fraction in [0, 1] from "defense-disarm" effects owned by `attackerId`
  // targeting `defenderTileId`. Reduces defender spell contribution
  // proportionally. SINGLE-USE: combined fraction is clamped to 1; ids
  // returned in `consumeEffectIds` should be deleted.
  defenseDisarmFraction: number;
  // Document ids of single-use effects (pre-cast-offense-spell,
  // defense-disarm) that should be deleted in the attack transaction.
  consumeEffectIds: string[];
}

/**
 * Read intel effects relevant to a single attack. Run OUTSIDE the attack
 * transaction — slight staleness is acceptable since effects decay naturally
 * and the caster's own turn count is the trigger for expiry.
 *
 * Aggregates five effect classes:
 *   - "forge-sight-offense" — caster armed against the target tile.
 *   - "alert-vs-caster" — defender alerted by the attacker (Black/Green spy).
 *   - "siege-debuff" — sum of attacker's siege actions / spells against tile.
 *   - "pre-cast-offense-spell" — attacker's queued offense spells (single-use).
 *   - "defense-disarm" — attacker's queued disarm rolls (single-use).
 *
 * `consumeEffectIds` lists the doc ids of single-use effects that the
 * attack transaction should delete via `deleteIntelEffectsInTx`.
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

  // Two attacker-owned kinds against the target tile, plus the defender's
  // alert against the attacker. We could merge attacker queries via
  // `kind in [...]`, but Firestore counts that as 4 fan-outs; parallel
  // single-kind queries stay cheap and let us reuse single-field indexes.
  const [forgeSnap, alertSnap, siegeSnap, preCastSnap, disarmSnap] =
    await Promise.all([
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
      db
        .collection(COLLECTION)
        .where("ownerId", "==", attackerId)
        .where("kind", "==", "siege-debuff")
        .get(),
      db
        .collection(COLLECTION)
        .where("ownerId", "==", attackerId)
        .where("kind", "==", "pre-cast-offense-spell")
        .get(),
      db
        .collection(COLLECTION)
        .where("ownerId", "==", attackerId)
        .where("kind", "==", "defense-disarm")
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

  let siegeDebuffMagnitude = 0;
  for (const d of siegeSnap.docs) {
    const e = d.data() as IntelEffect;
    if (e.targetTileId !== defenderTileId) continue;
    if (attackerTurnsSpentTotal < e.expiresAtCasterTurn) {
      siegeDebuffMagnitude += e.magnitude;
    }
  }
  // Clamp accumulated debuff to the documented cap. Cast-time recorders
  // also clamp per-effect, but multi-effect totals can exceed if recorders
  // are buggy — defense in depth.
  if (siegeDebuffMagnitude > SIEGE_DEBUFF_MAX_MAGNITUDE) {
    siegeDebuffMagnitude = SIEGE_DEBUFF_MAX_MAGNITUDE;
  }

  let preCastOffenseBonus = 0;
  const preCastIds: string[] = [];
  for (const d of preCastSnap.docs) {
    const e = d.data() as IntelEffect;
    if (e.targetTileId !== defenderTileId) continue;
    if (attackerTurnsSpentTotal < e.expiresAtCasterTurn) {
      preCastOffenseBonus += e.magnitude;
      preCastIds.push(d.id);
    }
  }

  // Disarm effects combine multiplicatively if multiple are stacked on the
  // same target: each one nullifies a fraction of what's left. Combined
  // fraction = 1 - prod(1 - m_i). Clamped to [0, 1].
  let disarmRemaining = 1;
  const disarmIds: string[] = [];
  for (const d of disarmSnap.docs) {
    const e = d.data() as IntelEffect;
    if (e.targetTileId !== defenderTileId) continue;
    if (attackerTurnsSpentTotal < e.expiresAtCasterTurn) {
      const m = Math.min(1, Math.max(0, e.magnitude));
      disarmRemaining *= 1 - m;
      disarmIds.push(d.id);
    }
  }
  const defenseDisarmFraction = Math.max(0, Math.min(1, 1 - disarmRemaining));

  return {
    forgeSightOffenseBonus,
    alertVsCasterDefenseBonus,
    siegeDebuffMagnitude,
    preCastOffenseBonus,
    defenseDisarmFraction,
    consumeEffectIds: [...preCastIds, ...disarmIds],
  };
}

/**
 * Delete a list of intel-effect docs inside an active transaction. Used
 * by attackTileServer to consume single-use effects (pre-cast offense,
 * disarm) once they've been read into combat. No-op for an empty list.
 */
export function deleteIntelEffectsInTx(args: {
  tx: Transaction;
  db: Firestore;
  effectIds: ReadonlyArray<string>;
}): void {
  for (const id of args.effectIds) {
    args.tx.delete(args.db.collection(COLLECTION).doc(id));
  }
}

/**
 * Record a siege-debuff effect against a target tile. Magnitude is the
 * fraction subtracted from the tile's standing-defense floor; capped at
 * SIEGE_DEBUFF_MAX_MAGNITUDE per record. TTL: INTEL_EFFECT_DURATION_CASTER_TURNS.
 *
 * Multiple records stack additively (read-time clamps the sum to the cap).
 */
export function recordSiegeDebuffInTx(args: {
  tx: Transaction;
  db: Firestore;
  attackerId: string;
  targetTileId: string;
  magnitude: number;
  attackerTurnsSpentTotal: number;
  now: Date;
}): IntelEffect {
  const clamped = Math.max(0, Math.min(SIEGE_DEBUFF_MAX_MAGNITUDE, args.magnitude));
  return recordIntelEffectInTx({
    tx: args.tx,
    db: args.db,
    kind: "siege-debuff",
    ownerId: args.attackerId,
    casterId: args.attackerId,
    targetTileId: args.targetTileId,
    magnitude: clamped,
    casterTurnsSpentTotalAtCast: args.attackerTurnsSpentTotal,
    now: args.now,
  });
}

/**
 * Record a pre-cast offense-spell effect against a target tile. Magnitude
 * is the realized power (already × magicMultiplier × caste bonus × dice).
 * Single-use: consumed by next attack against the target.
 */
export function recordPreCastOffenseInTx(args: {
  tx: Transaction;
  db: Firestore;
  attackerId: string;
  targetTileId: string;
  realizedPower: number;
  attackerTurnsSpentTotal: number;
  now: Date;
}): IntelEffect {
  return recordIntelEffectInTx({
    tx: args.tx,
    db: args.db,
    kind: "pre-cast-offense-spell",
    ownerId: args.attackerId,
    casterId: args.attackerId,
    targetTileId: args.targetTileId,
    magnitude: Math.max(0, args.realizedPower),
    casterTurnsSpentTotalAtCast: args.attackerTurnsSpentTotal,
    now: args.now,
  });
}

/**
 * Record a defense-disarm effect against a target tile. Magnitude is the
 * disarm fraction in [0, 1] rolled at cast time. Single-use: consumed by
 * next attack against the target.
 */
export function recordDefenseDisarmInTx(args: {
  tx: Transaction;
  db: Firestore;
  attackerId: string;
  targetTileId: string;
  disarmFraction: number;
  attackerTurnsSpentTotal: number;
  now: Date;
}): IntelEffect {
  const clamped = Math.max(0, Math.min(1, args.disarmFraction));
  return recordIntelEffectInTx({
    tx: args.tx,
    db: args.db,
    kind: "defense-disarm",
    ownerId: args.attackerId,
    casterId: args.attackerId,
    targetTileId: args.targetTileId,
    magnitude: clamped,
    casterTurnsSpentTotalAtCast: args.attackerTurnsSpentTotal,
    now: args.now,
  });
}
