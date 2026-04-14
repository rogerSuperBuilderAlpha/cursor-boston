#!/usr/bin/env node
/**
 * Backfill `githubLogin` (lowercase) on `hackathonASprint2026ParticipantScores`
 * for Hack-a-Sprint 2026 so peer-average reads skip per-voter `users/{uid}` lookups.
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 *
 * Usage:
 *   npx tsx scripts/backfill-asprint-2026-participant-github-login.ts
 *   npx tsx scripts/backfill-asprint-2026-participant-github-login.ts --apply
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";

function userIdFromParticipantDoc(
  docId: string,
  data: Record<string, unknown>
): string {
  const fromField = data.userId;
  if (typeof fromField === "string" && fromField.trim()) return fromField.trim();
  const parts = docId.split("__");
  return parts.length >= 2 ? parts.slice(1).join("__") : "";
}

function docNeedsGithubLogin(data: Record<string, unknown> | undefined): boolean {
  const g = data?.githubLogin;
  return typeof g !== "string" || !g.trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getAdminDb();
  if (!db) {
    console.error(
      "No admin DB. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
    );
    process.exit(1);
  }

  const snap = await db
    .collection("hackathonASprint2026ParticipantScores")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();

  const refsByUid = new Map<string, DocumentReference[]>();
  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>;
    if (!docNeedsGithubLogin(raw)) continue;
    const uid = userIdFromParticipantDoc(d.id, raw);
    if (!uid) {
      console.warn("[skip] no userId:", d.id);
      continue;
    }
    const list = refsByUid.get(uid) ?? [];
    list.push(d.ref);
    refsByUid.set(uid, list);
  }

  const missingDocs = [...refsByUid.values()].reduce((n, a) => n + a.length, 0);
  console.log(
    `Event ${HACK_A_SPRINT_2026_EVENT_ID}: ${snap.size} docs, ${missingDocs} missing githubLogin (${refsByUid.size} unique uids).`
  );
  if (refsByUid.size === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  let updated = 0;
  let noGithub = 0;
  let batch = db.batch();
  let batchOps = 0;
  let dryRunLogged = 0;

  const flushBatch = async () => {
    if (batchOps === 0) return;
    if (apply) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const [uid, refs] of refsByUid) {
    const userSnap = await db.collection("users").doc(uid).get();
    const loginRaw = userSnap.data()?.github?.login;
    const gh =
      typeof loginRaw === "string" && loginRaw.trim()
        ? loginRaw.trim().toLowerCase()
        : "";
    if (!gh) {
      noGithub += refs.length;
      console.warn(
        `[no github.login] uid=${uid} docs=${refs.length} (user exists: ${userSnap.exists})`
      );
      continue;
    }

    for (const ref of refs) {
      if (apply) {
        batch.set(ref, { githubLogin: gh }, { merge: true });
        batchOps += 1;
        if (batchOps >= 400) await flushBatch();
      }
      updated += 1;
      if (!apply && dryRunLogged < 15) {
        console.log(`[dry-run] ${ref.path} <- githubLogin=${gh}`);
        dryRunLogged += 1;
      }
    }
  }
  await flushBatch();

  if (apply) {
    console.log(`Applied: ${updated} documents updated, ${noGithub} skipped (no GitHub on profile).`);
  } else {
    if (updated > dryRunLogged) {
      console.log(`[dry-run] … and ${updated - dryRunLogged} more (same pattern).`);
    }
    console.log(
      `Dry run: would update ${updated} documents; ${noGithub} skipped. Re-run with --apply to write.`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
