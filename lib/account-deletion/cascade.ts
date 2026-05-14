/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Account-deletion cascade executor.
 *
 * Reads `userOwnedCollections` from `./registry.ts` and applies the
 * declared deletion behavior to every document keyed to the user.
 *
 * Why batched writes instead of a single transaction:
 *   Firestore transactions cap at 500 writes per commit; a multi-collection
 *   user cascade can exceed that. Batched writes commit in 500-op chunks and
 *   are durable, while progress is recorded in `accountDeletions/{uid}` so a
 *   retry skips already-completed steps.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  userOwnedCollections,
  type UserOwnedCollection,
} from "./registry";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 500;
const PROGRESS_COLLECTION = "accountDeletions";

export type DeletionStepReport = {
  collection: string;
  mode: UserOwnedCollection["mode"];
  scanned: number;
  deleted: number;
  anonymized: number;
  skipped: boolean; // true when this step was already completed in a prior pass
};

export type DeletionReport = {
  uid: string;
  startedAt: number;
  finishedAt: number;
  steps: DeletionStepReport[];
  errors: { collection: string; message: string }[];
};

/**
 * Execute the deletion cascade for a user.
 *
 * Idempotent: safe to retry. Each completed step is recorded in
 * `accountDeletions/{uid}.completedSteps`. Subsequent passes skip those.
 */
export async function deleteUserData(
  uid: string,
  db: Firestore
): Promise<DeletionReport> {
  const startedAt = Date.now();
  const progressRef = db.collection(PROGRESS_COLLECTION).doc(uid);
  const progressSnap = await progressRef.get();
  const completed = new Set<string>(
    progressSnap.exists ? (progressSnap.data()?.completedSteps as string[] ?? []) : []
  );

  // Ensure progress doc exists. Subsequent updates are arrayUnion so we
  // never accidentally truncate the completedSteps list.
  if (!progressSnap.exists) {
    await progressRef.set(
      {
        uid,
        deletedAt: FieldValue.serverTimestamp(),
        completedSteps: [] as string[],
      },
      { merge: true }
    );
  }

  const steps: DeletionStepReport[] = [];
  const errors: { collection: string; message: string }[] = [];

  for (const entry of userOwnedCollections) {
    const stepKey = entry.collection;
    if (completed.has(stepKey)) {
      steps.push({
        collection: entry.collection,
        mode: entry.mode,
        scanned: 0,
        deleted: 0,
        anonymized: 0,
        skipped: true,
      });
      continue;
    }

    try {
      const result = await runStep(uid, entry, db);
      steps.push({ ...result, skipped: false });
      await progressRef.update({
        completedSteps: FieldValue.arrayUnion(stepKey),
        [`stepCounts.${stepKey}`]: {
          scanned: result.scanned,
          deleted: result.deleted,
          anonymized: result.anonymized,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ collection: entry.collection, message });
      logger.logError(err, {
        endpoint: "account-deletion-cascade",
        area: "account-deletion",
        step: entry.collection,
        uid,
      });
      // Continue with other steps; this is the idempotent-resume design —
      // a transient failure in one collection should not stall the others.
    }
  }

  return {
    uid,
    startedAt,
    finishedAt: Date.now(),
    steps,
    errors,
  };
}

async function runStep(
  uid: string,
  entry: UserOwnedCollection,
  db: Firestore
): Promise<Omit<DeletionStepReport, "skipped">> {
  switch (entry.mode) {
    case "docIdIsUid":
      return runDocIdIsUid(uid, entry.collection, db);
    case "fieldEqualsUid":
      return runFieldEquals(uid, entry, db);
    case "twoSidedField":
      return runTwoSided(uid, entry, db);
    case "arrayContains":
      return runArrayContains(uid, entry, db);
  }
}

async function runDocIdIsUid(
  uid: string,
  collection: string,
  db: Firestore
): Promise<Omit<DeletionStepReport, "skipped">> {
  const ref = db.collection(collection).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return { collection, mode: "docIdIsUid", scanned: 0, deleted: 0, anonymized: 0 };
  }
  await ref.delete();
  return { collection, mode: "docIdIsUid", scanned: 1, deleted: 1, anonymized: 0 };
}

async function runFieldEquals(
  uid: string,
  entry: Extract<UserOwnedCollection, { mode: "fieldEqualsUid" }>,
  db: Firestore
): Promise<Omit<DeletionStepReport, "skipped">> {
  const query = db.collection(entry.collection).where(entry.field, "==", uid);
  return drainQuery(query, entry, db);
}

async function runTwoSided(
  uid: string,
  entry: Extract<UserOwnedCollection, { mode: "twoSidedField" }>,
  db: Firestore
): Promise<Omit<DeletionStepReport, "skipped">> {
  const [fieldA, fieldB] = entry.fields;
  // Run two queries; dedupe by doc path.
  const seen = new Set<string>();
  let scanned = 0;
  let deleted = 0;
  let anonymized = 0;

  for (const field of [fieldA, fieldB]) {
    const query = db.collection(entry.collection).where(field, "==", uid);
    const result = await drainQuery(query, { ...entry, mode: "fieldEqualsUid", field } as
      Extract<UserOwnedCollection, { mode: "fieldEqualsUid" }>,
      db,
      seen
    );
    scanned += result.scanned;
    deleted += result.deleted;
    anonymized += result.anonymized;
  }

  return { collection: entry.collection, mode: "twoSidedField", scanned, deleted, anonymized };
}

async function runArrayContains(
  uid: string,
  entry: Extract<UserOwnedCollection, { mode: "arrayContains" }>,
  db: Firestore
): Promise<Omit<DeletionStepReport, "skipped">> {
  const query = db.collection(entry.collection).where(entry.field, "array-contains", uid);
  return drainQuery(query, entry, db);
}

/**
 * Walk a query in BATCH_SIZE-page chunks, applying the entry's behavior.
 * `seen` is optional — used by `twoSidedField` to dedupe across two queries.
 */
async function drainQuery(
  query: FirebaseFirestore.Query,
  entry: Extract<
    UserOwnedCollection,
    { mode: "fieldEqualsUid" | "arrayContains" }
  >,
  db: Firestore,
  seen?: Set<string>
): Promise<Omit<DeletionStepReport, "skipped">> {
  let scanned = 0;
  let deleted = 0;
  let anonymized = 0;

  // Paginate using `startAfter` on the last doc reference. We avoid using
  // a `limit + offset` because Firestore charges per skipped doc.
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let pageQuery = query.limit(BATCH_SIZE);
    if (lastDoc) pageQuery = pageQuery.startAfter(lastDoc);
    const snap = await pageQuery.get();
    if (snap.empty) break;

    const batch = db.batch();
    let writes = 0;
    for (const doc of snap.docs) {
      if (seen && seen.has(doc.ref.path)) continue;
      seen?.add(doc.ref.path);
      scanned++;

      if (entry.behavior.type === "delete") {
        batch.delete(doc.ref);
        deleted++;
        writes++;
      } else {
        const update: Record<string, unknown> = {
          [entry.field]: "deleted-user",
          deletedUserAnonymizedAt: FieldValue.serverTimestamp(),
        };
        for (const f of entry.behavior.scrubFields ?? []) {
          update[f] = null;
        }
        batch.update(doc.ref, update);
        anonymized++;
        writes++;
      }
    }

    if (writes > 0) await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  return { collection: entry.collection, mode: entry.mode, scanned, deleted, anonymized };
}

/**
 * Resume any incomplete cascades. Used by the 30-day purge job in
 * `app/api/account/purge/route.ts`.
 *
 * Returns the list of UIDs whose deletion was completed (or already done).
 */
export async function resumeStaleDeletions(
  db: Firestore,
  olderThanMs: number
): Promise<string[]> {
  const cutoff = Date.now() - olderThanMs;
  const snap = await db
    .collection(PROGRESS_COLLECTION)
    .where("deletedAt", "<", new Date(cutoff))
    .get();

  const completed: string[] = [];
  for (const doc of snap.docs) {
    const uid = (doc.data().uid as string) ?? doc.id;
    const report = await deleteUserData(uid, db);
    const allDone = report.steps.every((s) => s.skipped || true);
    if (allDone && report.errors.length === 0) {
      completed.push(uid);
      // Final cleanup: drop the progress doc itself.
      await doc.ref.delete();
    }
  }
  return completed;
}
