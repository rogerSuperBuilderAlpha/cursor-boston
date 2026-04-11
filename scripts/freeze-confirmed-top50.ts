#!/usr/bin/env node
/**
 * Freeze the top 50 registrants as permanently confirmed by setting
 * `confirmedAt` on their Firestore docs (website signups OR Luma-only).
 *
 * Ranking: PRs desc → website signup before Luma → registration time asc.
 * Top 50 from that combined list are confirmed. Everyone else is waitlisted.
 *
 * Also clears `confirmedAt` from anyone outside the top 50 who has it
 * (e.g. from a previous run with different logic).
 *
 * Usage:
 *   npx tsx scripts/freeze-confirmed-top50.ts --dry-run
 *   npx tsx scripts/freeze-confirmed-top50.ts --write
 *   npx tsx scripts/freeze-confirmed-top50.ts --dry-run --recalculate
 *   npx tsx scripts/freeze-confirmed-top50.ts --write --recalculate
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * and GITHUB_TOKEN (for accurate PR counts). Load from .env.local.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  compareUnifiedHackathonRanking,
  CURSOR_CREDIT_TOP_N,
  DECLINED_EMAILS,
  JUDGE_EMAILS,
} from "../lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";
import { fetchMergedPrCountsForLogins } from "../lib/github-merged-pr-count";
import { getGithubRepoPair } from "../lib/github-recent-merged-prs";
import { getAdminDb } from "../lib/firebase-admin";

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;

function signedUpAtToMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function fetchUserDataMap(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, DocumentData>> {
  const map = new Map<string, DocumentData>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db.collection("users").where("__name__", "in", chunk).get();
    for (const doc of snap.docs) map.set(doc.id, doc.data());
  }
  return map;
}

const USER_ID_IN_CHUNK = 10;

async function countMergedCommunityPrsByUserIds(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const id of unique) counts.set(id, 0);
  if (unique.length === 0) return counts;

  const { owner, repo } = getGithubRepoPair();
  const expectedRepo = `${owner}/${repo}`;

  for (let i = 0; i < unique.length; i += USER_ID_IN_CHUNK) {
    const chunk = unique.slice(i, i + USER_ID_IN_CHUNK);
    const snap = await db
      .collection("pullRequests")
      .where("userId", "in", chunk)
      .where("state", "==", "merged")
      .get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const uid = data.userId as string | undefined;
      if (!uid) continue;
      const repoField = data.repository;
      if (
        typeof repoField === "string" &&
        repoField.length > 0 &&
        repoField !== expectedRepo
      ) {
        continue;
      }
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
  }
  return counts;
}

type UnifiedEntry = {
  collection: "hackathonEventSignups" | "hackathonLumaRegistrants";
  docId: string;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAtMs: number;
  source: "website" | "luma_only";
  alreadyConfirmed: boolean;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const write = process.argv.includes("--write");
  const recalculate = process.argv.includes("--recalculate");
  if (!dryRun && !write) {
    console.error("Specify exactly one of: --dry-run | --write");
    process.exit(1);
  }
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // ── Website signups ──
  console.log(`Fetching signups for ${EVENT_ID}…`);
  const snap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();

  const userIds = snap.docs.map((d) => d.data().userId as string).filter(Boolean);
  console.log(`Found ${userIds.length} website signups.`);

  const userMap = await fetchUserDataMap(db, userIds);
  const firestoreMergedCounts = await countMergedCommunityPrsByUserIds(db, userIds);

  const websiteGithubLogins: string[] = [];
  const websiteEmails = new Set<string>();
  const websiteGhSet = new Set<string>();
  for (const uid of userIds) {
    const profile = userMap.get(uid);
    if (typeof profile?.email === "string") websiteEmails.add(profile.email.toLowerCase());
    const login =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof login === "string" && login.trim()) {
      websiteGithubLogins.push(login.trim());
      websiteGhSet.add(login.trim().toLowerCase());
    }
  }
  const githubMergedByLogin = await fetchMergedPrCountsForLogins(websiteGithubLogins);

  const unified: UnifiedEntry[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const userId = data.userId as string;
    if (!userId) continue;
    const profile = userMap.get(userId);
    const gh =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    const githubLogin = typeof gh === "string" ? gh : null;
    let pr = firestoreMergedCounts.get(userId) ?? 0;
    if (githubLogin) {
      const fromApi = githubMergedByLogin.get(githubLogin.toLowerCase());
      if (fromApi !== undefined) pr = fromApi;
    }
    unified.push({
      collection: "hackathonEventSignups",
      docId: doc.id,
      displayName: typeof profile?.displayName === "string" ? profile.displayName : null,
      githubLogin,
      mergedPrCount: pr,
      signedUpAtMs: signedUpAtToMs(data.signedUpAt),
      source: "website",
      alreadyConfirmed: !!data.confirmedAt,
    });
  }

  // ── Luma-only registrants ──
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();

  const lumaGithubLogins: string[] = [];
  const lumaEntries: { doc: FirebaseFirestore.QueryDocumentSnapshot; ghLogin: string | null }[] = [];

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string || "").toLowerCase();
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (JUDGE_EMAILS.has(email) || DECLINED_EMAILS.has(email)) continue;
    if (websiteEmails.has(email)) continue;
    if (ghLogin && websiteGhSet.has(ghLogin.toLowerCase())) continue;
    if (ghLogin) lumaGithubLogins.push(ghLogin);
    lumaEntries.push({ doc, ghLogin });
  }

  let lumaPrCounts = new Map<string, number>();
  if (lumaGithubLogins.length > 0) {
    lumaPrCounts = await fetchMergedPrCountsForLogins(lumaGithubLogins);
  }

  for (const { doc, ghLogin } of lumaEntries) {
    const d = doc.data();
    const pr = ghLogin ? (lumaPrCounts.get(ghLogin.toLowerCase()) ?? 0) : 0;
    unified.push({
      collection: "hackathonLumaRegistrants",
      docId: doc.id,
      displayName: typeof d.name === "string" ? d.name : null,
      githubLogin: ghLogin,
      mergedPrCount: pr,
      signedUpAtMs: typeof d.lumaCreatedAt === "string" ? new Date(d.lumaCreatedAt).getTime() : 0,
      source: "luma_only",
      alreadyConfirmed: !!d.confirmedAt,
    });
  }

  console.log(`Found ${lumaEntries.length} Luma-only registrants.`);
  console.log(`Total: ${unified.length} combined.`);

  if (recalculate) {
    const ranked = [...unified].sort(compareUnifiedHackathonRanking);
    const top = ranked.slice(0, CURSOR_CREDIT_TOP_N);
    const topSet = new Set(top.map((r) => `${r.collection}\0${r.docId}`));

    console.log(`\n--recalculate: top ${CURSOR_CREDIT_TOP_N} by merged PRs (competition order):`);
    for (const [i, r] of top.entries()) {
      const src = r.source === "website" ? "web" : "luma";
      console.log(
        `  ${String(i + 1).padStart(3)}. ${(r.displayName || "?").padEnd(25)} @${(r.githubLogin || "?").padEnd(20)} PRs=${r.mergedPrCount} (${src})`
      );
    }

    if (dryRun) {
      console.log("\n--dry-run --recalculate: no writes. Use --write --recalculate to apply.");
      return;
    }

    console.log("\nApplying confirmedAt to all signups + Luma rows for this event…");
    for (const doc of snap.docs) {
      const key = `hackathonEventSignups\0${doc.id}`;
      const inTop = topSet.has(key);
      await db.collection("hackathonEventSignups").doc(doc.id).update(
        inTop ? { confirmedAt: FieldValue.serverTimestamp() } : { confirmedAt: FieldValue.delete() }
      );
    }
    for (const doc of lumaSnap.docs) {
      const key = `hackathonLumaRegistrants\0${doc.id}`;
      const inTop = topSet.has(key);
      await db.collection("hackathonLumaRegistrants").doc(doc.id).update(
        inTop ? { confirmedAt: FieldValue.serverTimestamp() } : { confirmedAt: FieldValue.delete() }
      );
    }
    console.log(`Done. Top ${top.length} confirmed; others cleared.`);
    return;
  }

  // Sort: PRs desc → website before luma → registration time asc
  unified.sort(compareUnifiedHackathonRanking);

  // Already-frozen users stay frozen (confirmedAt is permanent).
  // Only fill remaining spots up to CURSOR_CREDIT_TOP_N with unfrozen users.
  const alreadyFrozen = unified.filter((r) => r.alreadyConfirmed);
  const unfrozen = unified.filter((r) => !r.alreadyConfirmed);
  const spotsLeft = Math.max(0, CURSOR_CREDIT_TOP_N - alreadyFrozen.length);
  const top = [...alreadyFrozen, ...unfrozen.slice(0, spotsLeft)];
  const toFreeze = unfrozen.slice(0, spotsLeft);

  console.log(`\nTop ${CURSOR_CREDIT_TOP_N} (to be confirmed):`);
  for (const [i, r] of top.entries()) {
    const src = r.source === "website" ? "web" : "luma";
    const tag = r.alreadyConfirmed ? " [already frozen]" : " ← will freeze";
    console.log(
      `  ${String(i + 1).padStart(3)}. ${(r.displayName || "?").padEnd(25)} @${(r.githubLogin || "?").padEnd(20)} PRs=${r.mergedPrCount} (${src})${tag}`
    );
  }

  console.log(`\n${alreadyFrozen.length} already frozen, ${toFreeze.length} to freeze.`);

  if (dryRun) {
    console.log("--dry-run: no writes. Use --write to apply.");
    return;
  }

  if (toFreeze.length > 0) {
    console.log("\nSetting confirmedAt…");
    for (const r of toFreeze) {
      await db.collection(r.collection).doc(r.docId).update({
        confirmedAt: FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ ${r.displayName} (${r.collection}/${r.docId})`);
    }
  }

  console.log(`\nDone. ${toFreeze.length} frozen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
