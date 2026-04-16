/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { after } from "next/server";
import { sendEmail } from "@/lib/mailgun";
import { emailAlreadyWon } from "@/lib/treasure-hunt-eligibility";

export type ClaimResult =
  | { ok: true; code: string; creditUrl: string; pathId: string }
  | {
      ok: false;
      reason:
        | "already_won"
        | "email_already_won"
        | "pool_empty"
        | "path_taken"
        | "no_email";
    };

/**
 * Atomically awards the first available prize in `treasureHuntPrizes` to the
 * caller. Records progress in `treasureHuntProgress/{uid}`. Sends the credit
 * email via Mailgun after the transaction commits. Idempotent per-uid.
 *
 * One winner per path enforced via an index doc at
 * `treasureHuntPathWinners/{pathId}`.
 */
export async function claimTreasureHuntPrize(
  db: Firestore,
  opts: {
    uid: string;
    email: string;
    displayName: string;
    pathId: string;
  }
): Promise<ClaimResult> {
  const { uid, email, displayName, pathId } = opts;
  const to = email.trim();
  if (!to) return { ok: false, reason: "no_email" };
  const lower = to.toLowerCase();

  if (await emailAlreadyWon(db, lower)) {
    return { ok: false, reason: "email_already_won" };
  }

  const progressRef = db.collection("treasureHuntProgress").doc(uid);
  const pathWinnerRef = db.collection("treasureHuntPathWinners").doc(pathId);

  const awarded = await db.runTransaction(async (tx) => {
    const [progressSnap, pathWinnerSnap] = await Promise.all([
      tx.get(progressRef),
      tx.get(pathWinnerRef),
    ]);
    if (progressSnap.exists && progressSnap.data()?.prizeCodeId) {
      return { status: "already_won" as const };
    }
    if (pathWinnerSnap.exists) {
      return { status: "path_taken" as const };
    }
    const poolQ = await tx.get(
      db
        .collection("treasureHuntPrizes")
        .where("status", "==", "available")
        .limit(1)
    );
    if (poolQ.empty) return { status: "pool_empty" as const };
    const prize = poolQ.docs[0]!;
    const pd = prize.data();
    tx.update(prize.ref, {
      status: "claimed",
      claimedByUid: uid,
      claimedByEmail: to,
      claimedPath: pathId,
      claimedAt: FieldValue.serverTimestamp(),
    });
    tx.set(pathWinnerRef, {
      pathId,
      winnerUid: uid,
      winnerEmail: to,
      prizeCodeId: prize.id,
      claimedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      progressRef,
      {
        uid,
        winnerEmail: to,
        winnerEmailLower: lower,
        prizeCodeId: prize.id,
        prizeCreditUrl: pd.creditUrl,
        pathsSolved: FieldValue.arrayUnion(pathId),
        firstSolveAt: FieldValue.serverTimestamp(),
        prizeEmailSentAt: null,
      },
      { merge: true }
    );
    return {
      status: "awarded" as const,
      code: prize.id,
      creditUrl: pd.creditUrl as string,
    };
  });

  if (awarded.status !== "awarded") {
    return { ok: false, reason: awarded.status };
  }

  // Clear the retry-cron "queue empty" marker so the next cron run scans.
  try {
    await db.collection("treasureHuntRuntime").doc("emailRetry").set(
      { queueEmpty: false, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch {
    // non-fatal
  }

  // Fire-and-forget the email so the user's response returns immediately.
  // The retry cron will catch any Mailgun failure: prizeEmailSentAt stays null.
  const name = displayName.trim() || "there";
  after(async () => {
    try {
      await sendEmail({
        to,
        subject: "🗺️ You found it — your Cursor credit inside",
        text:
          `Hi ${name},\n\n` +
          `You cracked the "${pathId}" path of the Cursor Boston treasure hunt. ` +
          `Here is your personal Cursor credit link (do not share it):\n\n` +
          `${awarded.creditUrl}\n\n` +
          `— Cursor Boston`,
        html:
          `<p>Hi ${name},</p>` +
          `<p>You cracked the <strong>${pathId}</strong> path of the Cursor Boston treasure hunt. ` +
          `Here is your personal Cursor credit link — <strong>do not share it</strong>:</p>` +
          `<p><a href="${awarded.creditUrl}">${awarded.creditUrl}</a></p>` +
          `<p>— Cursor Boston</p>`,
      });
      await progressRef.set(
        { prizeEmailSentAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("[treasure-hunt-claim] email send failed", err);
    }
  });

  return { ok: true, code: awarded.code, creditUrl: awarded.creditUrl, pathId };
}
