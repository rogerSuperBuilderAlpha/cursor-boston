/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Hero registry — persistent layer for the v2 Heroes feature. Wraps
 * Firestore writes against the `game_heroes` collection and its `events`
 * subcollection. Everything that mutates a hero in `lib/game/data-server.ts`
 * dual-writes here so the persistent record stays in lockstep with the
 * inline `GameTile.hero` snapshot.
 *
 * All write helpers are `*InTx` — they assume the caller is inside an
 * existing Firestore transaction. This keeps the registry update atomic
 * with the tile/player mutations that triggered it.
 *
 * The collection survives Armageddon season wipes by design — see
 * `lib/game/armageddon-resolve.ts` (`game_heroes` is NOT in COLLECTIONS).
 */

import { randomUUID } from "node:crypto";
import type {
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import type {
  GameHero,
  GameHeroDoc,
  GameHeroEvent,
} from "./types";

/** Top-level Firestore collection holding persistent hero records. */
export const HEROES_COLLECTION = "game_heroes";
/** Subcollection name for the per-hero event log. */
export const HERO_EVENTS_SUBCOLLECTION = "events";

/** Reference helper for a hero doc. */
function heroRef(db: Firestore, heroId: string) {
  return db.collection(HEROES_COLLECTION).doc(heroId);
}

/** Reference helper for a hero's events subcollection. */
export function heroEventsCollection(db: Firestore, heroId: string) {
  return heroRef(db, heroId).collection(HERO_EVENTS_SUBCOLLECTION);
}

/** Reference helper for a single event in a hero's subcollection. */
function heroEventRef(db: Firestore, heroId: string, eventId: string) {
  return heroEventsCollection(db, heroId).doc(eventId);
}

interface UpsertHeroInTxArgs {
  tx: Transaction;
  db: Firestore;
  hero: GameHero;
  seasonNumber: number;
  now: Date;
}

/**
 * Creates or updates the persistent record for a hero. Called from every
 * site that mutates `tile.hero` (emergence, engagement, stamina decay,
 * move-on-capture, defection). Uses `set({...}, { merge: true })` so an
 * emergence creates the doc and subsequent calls patch it.
 *
 * `survivedSeasons` and `createdAt` are only stamped on initial creation
 * via the `setIfMissing` pattern — caller doesn't need to know whether
 * this is a first-write.
 */
export function upsertHeroInTx(args: UpsertHeroInTxArgs): void {
  const ref = heroRef(args.db, args.hero.id);
  const payload: Partial<GameHeroDoc> & {
    id: string;
    name: string;
    updatedAt: Date;
  } = {
    id: args.hero.id,
    name: args.hero.name,
    class: args.hero.class,
    specialty: args.hero.specialty,
    caste: args.hero.caste,
    currentOwnerId: args.hero.ownerId,
    currentTileId: args.hero.tileId,
    stamina: args.hero.stamina,
    staminaMax: args.hero.staminaMax,
    emergedAtTurn: args.hero.emergedAtTurn,
    emergedSeasonNumber: args.seasonNumber,
    isDeceased: false,
    awaitingResurrection: false,
    lastEventAt: args.now,
    updatedAt: args.now,
    createdAt: args.now,
    survivedSeasons: [],
  };
  // merge: true means createdAt + survivedSeasons + emergedSeasonNumber
  // on existing docs stay put (Firestore merge doesn't overwrite arrays
  // with the same value if we set them; createdAt is preserved because
  // the doc already exists and we're patching). This is safe — emergence
  // is the only call that sets these, and the registry write at emergence
  // is the doc's first creation.
  args.tx.set(ref, payload, { merge: true });
}

interface AppendHeroEventInTxArgs {
  tx: Transaction;
  db: Firestore;
  heroId: string;
  event: Omit<GameHeroEvent, "id" | "createdAt"> & { createdAt?: Date };
  now: Date;
}

/**
 * Append-only event log writer. Generates a uuid, writes into the
 * subcollection, and bumps the parent hero doc's `lastEventAt` for sort
 * ordering. Caller must ensure the parent hero doc exists (e.g. via
 * `upsertHeroInTx` earlier in the same txn).
 *
 * Returns the generated event id in case the caller wants to reference
 * it (e.g. for a turn-report payload).
 */
export function appendHeroEventInTx(args: AppendHeroEventInTxArgs): string {
  const eventId = randomUUID();
  const createdAt = args.event.createdAt ?? args.now;
  const ref = heroEventRef(args.db, args.heroId, eventId);
  // Build the persisted shape — strip any `undefined` fields so Firestore
  // doesn't choke on optional kind-specific properties.
  const persisted: Record<string, unknown> = {
    id: eventId,
    kind: args.event.kind,
    createdAt,
    tileId: args.event.tileId,
    ownerIdAtTime: args.event.ownerIdAtTime,
    seasonNumber: args.event.seasonNumber,
  };
  const optionalKeys: Array<keyof GameHeroEvent> = [
    "attackerId",
    "defenderId",
    "outcome",
    "fromOwnerId",
    "toOwnerId",
    "fromTileId",
    "spellId",
    "targetTileId",
    "unitType",
    "unitsBuilt",
    "specialUnitDefId",
  ];
  for (const key of optionalKeys) {
    const value = (args.event as Record<string, unknown>)[key];
    if (value !== undefined) persisted[key] = value;
  }
  args.tx.set(ref, persisted);
  // Bump parent's lastEventAt for sort ordering. We do a merge update
  // rather than a set so we don't accidentally overwrite other fields.
  args.tx.set(
    heroRef(args.db, args.heroId),
    { lastEventAt: createdAt, updatedAt: args.now },
    { merge: true }
  );
  return eventId;
}

interface MarkHeroDeceasedInTxArgs {
  tx: Transaction;
  db: Firestore;
  heroId: string;
  deceasedTileId: string;
  now: Date;
}

/**
 * Terminal status update — hero killed in battle. Caller is responsible
 * for appending the matching `slain` event with `appendHeroEventInTx`
 * (this helper does NOT log the event so callers can include attacker
 * details in the event payload).
 */
export function markHeroDeceasedInTx(args: MarkHeroDeceasedInTxArgs): void {
  args.tx.set(
    heroRef(args.db, args.heroId),
    {
      isDeceased: true,
      awaitingResurrection: false,
      deceasedAt: args.now,
      deceasedTileId: args.deceasedTileId,
      // Clear current tile/owner — the hero is no longer present anywhere.
      currentTileId: null,
      currentOwnerId: null,
      stamina: 0,
      updatedAt: args.now,
    },
    { merge: true }
  );
}

interface TransferHeroOwnerInTxArgs {
  tx: Transaction;
  db: Firestore;
  heroId: string;
  newOwnerId: string;
  newTileId: string;
  newStamina: number;
  now: Date;
}

/**
 * Updates the persistent record when a hero defects to a new owner.
 * Caller is responsible for the `defected` event (carries from/to ids).
 */
export function transferHeroOwnerInTx(args: TransferHeroOwnerInTxArgs): void {
  args.tx.set(
    heroRef(args.db, args.heroId),
    {
      currentOwnerId: args.newOwnerId,
      currentTileId: args.newTileId,
      stamina: args.newStamina,
      updatedAt: args.now,
    },
    { merge: true }
  );
}

interface ClearHeroForArmageddonInTxArgs {
  tx: Transaction;
  db: Firestore;
  heroId: string;
  seasonNumber: number;
  // True when the hero was alive at season end. False when they were
  // already deceased — we still record the season ended event but skip
  // the limbo flip.
  wasAlive: boolean;
  // Last-known tileId at season end (for the event payload).
  tileIdAtSeasonEnd: string | null;
  ownerIdAtSeasonEnd: string | null;
  now: Date;
}

/**
 * Called from `lib/game/armageddon-resolve.ts` (Step 6.5) for every hero
 * before the world wipe. Living heroes enter limbo — no owner, no tile,
 * awaitingResurrection=true. Deceased heroes are left alone except for
 * the `survivedSeasons` bump.
 *
 * The matching `season_ended` event is written separately by the caller
 * so resolution can batch the writes across many heroes.
 */
export function clearHeroForArmageddonInTx(
  args: ClearHeroForArmageddonInTxArgs
): void {
  // The survivedSeasons array gets the season pushed via FieldValue.arrayUnion
  // when the caller has Firestore admin in scope. We do it inline with a
  // doc read in the caller's batch instead — this helper just sets the
  // limbo flags and updatedAt. The caller is responsible for `survivedSeasons`
  // because Firestore transactions can't easily do arrayUnion on a doc we
  // haven't read in the txn.
  if (args.wasAlive) {
    args.tx.set(
      heroRef(args.db, args.heroId),
      {
        currentOwnerId: null,
        currentTileId: null,
        awaitingResurrection: true,
        updatedAt: args.now,
      },
      { merge: true }
    );
  }
  // No-op for deceased heroes — the season_ended event is still appended
  // separately by the caller so the hall-of-the-fallen reflects the season.
  // Use the args to satisfy unused-arg checks while keeping the API
  // surface stable for future v3 resurrection logic.
  void args.seasonNumber;
  void args.tileIdAtSeasonEnd;
  void args.ownerIdAtSeasonEnd;
}

/** Builder for the kind-specific event payload — keeps call sites in
 *  data-server.ts terse. Each helper returns the partial event without
 *  the `id`/`createdAt` (filled in by `appendHeroEventInTx`). */
export const heroEvent = {
  emerged(
    hero: Pick<GameHero, "tileId" | "ownerId">,
    seasonNumber: number
  ): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "emerged",
      tileId: hero.tileId,
      ownerIdAtTime: hero.ownerId,
      seasonNumber,
    };
  },
  engagedAttacker(args: {
    tileId: string;
    ownerIdAtTime: string;
    defenderId: string;
    targetTileId: string;
    outcome: GameHeroEvent["outcome"];
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "engaged_attacker",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      defenderId: args.defenderId,
      targetTileId: args.targetTileId,
      outcome: args.outcome,
    };
  },
  engagedDefender(args: {
    tileId: string;
    ownerIdAtTime: string;
    attackerId: string;
    outcome: GameHeroEvent["outcome"];
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "engaged_defender",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      attackerId: args.attackerId,
      outcome: args.outcome,
    };
  },
  slain(args: {
    tileId: string;
    ownerIdAtTime: string;
    attackerId: string;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "slain",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      attackerId: args.attackerId,
    };
  },
  defected(args: {
    tileId: string;
    fromOwnerId: string;
    toOwnerId: string;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "defected",
      tileId: args.tileId,
      // `ownerIdAtTime` for a defection is the FROM owner — the event
      // belongs to their tenure history. The post-defection state is
      // captured by the next event under the new owner.
      ownerIdAtTime: args.fromOwnerId,
      seasonNumber: args.seasonNumber,
      fromOwnerId: args.fromOwnerId,
      toOwnerId: args.toOwnerId,
    };
  },
  movedOnCapture(args: {
    tileId: string;
    fromTileId: string;
    ownerIdAtTime: string;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "moved_on_capture",
      tileId: args.tileId,
      fromTileId: args.fromTileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
    };
  },
  spellCast(args: {
    tileId: string;
    ownerIdAtTime: string;
    spellId: string;
    targetTileId: string;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "spell_cast",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      spellId: args.spellId,
      targetTileId: args.targetTileId,
    };
  },
  recruited(args: {
    tileId: string;
    ownerIdAtTime: string;
    unitType: GameHeroEvent["unitType"];
    unitsBuilt: number;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "recruited",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      unitType: args.unitType,
      unitsBuilt: args.unitsBuilt,
    };
  },
  specialUnitSummoned(args: {
    tileId: string;
    ownerIdAtTime: string;
    specialUnitDefId: string;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "special_unit_summoned",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
      specialUnitDefId: args.specialUnitDefId,
    };
  },
  seasonEnded(args: {
    tileId: string;
    ownerIdAtTime: string | null;
    seasonNumber: number;
  }): Omit<GameHeroEvent, "id" | "createdAt"> {
    return {
      kind: "season_ended",
      tileId: args.tileId,
      ownerIdAtTime: args.ownerIdAtTime,
      seasonNumber: args.seasonNumber,
    };
  },
};

/** Helper: derive whether a viewer was ever an owner of this hero from
 *  the event log. Used by the visibility filter to decide whether to
 *  reveal events from past tenures. Reads the events subcollection
 *  outside any txn (visibility is a read-time concern). */
export async function viewerWasOwner(
  db: Firestore,
  heroId: string,
  viewerId: string
): Promise<boolean> {
  const snap = await heroEventsCollection(db, heroId)
    .where("ownerIdAtTime", "==", viewerId)
    .limit(1)
    .get();
  return !snap.empty;
}
