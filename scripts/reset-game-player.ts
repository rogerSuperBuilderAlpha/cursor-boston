#!/usr/bin/env node
/**
 * One-off: wipe a player's game state so the account starts over.
 *
 * Deletes:
 *   - game_players/{uid}
 *   - all game_tiles where ownerId == uid (frees those hexes back to unrevealed)
 *   - all game_artifacts where ownerId == uid
 *   - all game_attacks where attackerId == uid OR defenderId == uid
 *
 * Idempotent — re-running on a missing uid is a no-op.
 *
 * Usage:
 *   npx tsx scripts/reset-game-player.ts <email>
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../lib/firebase-admin";

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  ARTIFACTS: "game_artifacts",
} as const;

async function resolveUidForEmail(
  db: Firestore,
  email: string
): Promise<string | null> {
  const auth = getAdminAuth();
  if (auth) {
    try {
      const u = await auth.getUserByEmail(email);
      return u.uid;
    } catch {
      /* fall through */
    }
  }
  const lookup = await db.collection("emailLookup").doc(email).get();
  if (lookup.exists) {
    const uid = lookup.data()?.uid as string | undefined;
    if (uid) return uid;
  }
  const byEmail = await db
    .collection("users")
    .where("email", "==", email)
    .limit(2)
    .get();
  if (!byEmail.empty) {
    if (byEmail.docs.length > 1) {
      console.warn(
        `[warn] Multiple users for ${email}; using first doc ${byEmail.docs[0]!.id}`
      );
    }
    return byEmail.docs[0]!.id;
  }
  return null;
}

async function deleteWhere(
  db: Firestore,
  collection: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await db.collection(collection).where(field, "==", value).get();
  if (snap.empty) return 0;
  // Firestore batches cap at 500 ops.
  const BATCH_LIMIT = 400;
  let written = 0;
  let batch: WriteBatch = db.batch();
  let inBatch = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    inBatch += 1;
    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      written += inBatch;
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) {
    await batch.commit();
    written += inBatch;
  }
  return written;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-game-player.ts <email>");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const uid = await resolveUidForEmail(db, email.toLowerCase());
  if (!uid) {
    console.error(`No user found for ${email}.`);
    process.exit(1);
  }
  console.log(`Resolved ${email} → ${uid}`);

  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(uid);
  const playerSnap = await playerRef.get();
  if (playerSnap.exists) {
    await playerRef.delete();
    console.log(`Deleted ${COLLECTIONS.PLAYERS}/${uid}`);
  } else {
    console.log(`${COLLECTIONS.PLAYERS}/${uid}: not found, skipping.`);
  }

  const tiles = await deleteWhere(db, COLLECTIONS.TILES, "ownerId", uid);
  console.log(`Deleted ${tiles} ${COLLECTIONS.TILES} doc(s).`);

  const artifacts = await deleteWhere(
    db,
    COLLECTIONS.ARTIFACTS,
    "ownerId",
    uid
  );
  console.log(`Deleted ${artifacts} ${COLLECTIONS.ARTIFACTS} doc(s).`);

  const attacksSent = await deleteWhere(
    db,
    COLLECTIONS.ATTACKS,
    "attackerId",
    uid
  );
  const attacksReceived = await deleteWhere(
    db,
    COLLECTIONS.ATTACKS,
    "defenderId",
    uid
  );
  console.log(
    `Deleted ${attacksSent} sent + ${attacksReceived} received ${COLLECTIONS.ATTACKS} doc(s).`
  );

  console.log(`Done. ${email} can now run setup again.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
